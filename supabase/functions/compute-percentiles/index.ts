import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get today's date in America/New_York timezone
function getTodayET(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let jobRunId: number | null = null
  const counters = { computed: 0, visible: 0, hidden: 0, errors: 0 }

  try {
    let requestBody: { date?: string } = {}
    try {
      requestBody = await req.json()
    } catch {
      // Empty body is OK
    }
    
    const { date } = requestBody
    const targetDate = date || getTodayET()

    console.log(`[COMPUTE] Computing percentiles for ${targetDate}`)

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ job_name: 'compute', details: { date: targetDate } })
      .select()
      .single()

    jobRunId = jobRun?.id || null

    // Get all games for the target date (using ET date range)
    // Convert ET date to UTC range
    const startOfDayET = new Date(`${targetDate}T00:00:00-05:00`)
    const endOfDayET = new Date(`${targetDate}T23:59:59-05:00`)

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .gte('start_time_utc', startOfDayET.toISOString())
      .lte('start_time_utc', endOfDayET.toISOString())

    if (gamesError) {
      throw gamesError
    }

    console.log(`[COMPUTE] Found ${games?.length || 0} games for ${targetDate}`)

    for (const game of games || []) {
      try {
        // Canonical team ordering for matchup lookup
        const [teamLowId, teamHighId] = [game.home_team_id, game.away_team_id].sort()

        // Get H2H totals from matchup_games
        const { data: matchupGames } = await supabase
          .from('matchup_games')
          .select('total')
          .eq('sport_id', game.sport_id)
          .eq('team_low_id', teamLowId)
          .eq('team_high_id', teamHighId)

        const n = matchupGames?.length || 0
        let p05: number | null = null
        let p95: number | null = null
        let isVisible = false

        if (n >= 5) {
          // Sort totals and compute nearest-rank quantiles
          const totals = matchupGames!.map(mg => Number(mg.total)).sort((a, b) => a - b)
          
          // P05 = totals[ceil(0.05*n) - 1]
          const p05Index = Math.max(1, Math.ceil(0.05 * n)) - 1
          // P95 = totals[ceil(0.95*n) - 1]
          const p95Index = Math.max(1, Math.ceil(0.95 * n)) - 1
          const medianIndex = Math.floor(n / 2)

          p05 = totals[p05Index]
          p95 = totals[p95Index]
          isVisible = true

          // Also update/create matchup_stats cache
          // Find existing matchup_stats
          const { data: existingStats } = await supabase
            .from('matchup_stats')
            .select('id')
            .eq('sport_id', game.sport_id)
            .eq('team_low_id', teamLowId)
            .eq('team_high_id', teamHighId)
            .is('league_id', null)
            .maybeSingle()

          const statsData = {
            n_games: n,
            p05: totals[p05Index],
            p95: totals[p95Index],
            median: n % 2 === 0 ? (totals[medianIndex - 1] + totals[medianIndex]) / 2 : totals[medianIndex],
            min_total: totals[0],
            max_total: totals[n - 1],
            updated_at: new Date().toISOString(),
          }

          if (existingStats) {
            await supabase
              .from('matchup_stats')
              .update(statsData)
              .eq('id', existingStats.id)
          } else {
            await supabase
              .from('matchup_stats')
              .insert({
                sport_id: game.sport_id,
                team_low_id: teamLowId,
                team_high_id: teamHighId,
                ...statsData,
              })
          }

          counters.visible++
        } else {
          counters.hidden++
        }

        // Find or update daily_edge
        const { data: existingEdge } = await supabase
          .from('daily_edges')
          .select('id')
          .eq('date_local', targetDate)
          .eq('game_id', game.id)
          .maybeSingle()

        const edgeData = {
          sport_id: game.sport_id,
          n_h2h: n,
          p05,
          p95,
          is_visible: isVisible,
          updated_at: new Date().toISOString(),
        }

        if (existingEdge) {
          await supabase
            .from('daily_edges')
            .update(edgeData)
            .eq('id', existingEdge.id)
        } else {
          await supabase
            .from('daily_edges')
            .insert({
              date_local: targetDate,
              game_id: game.id,
              ...edgeData,
            })
        }

        counters.computed++
      } catch (gameErr) {
        console.error(`[COMPUTE] Error for game ${game.id}:`, gameErr)
        counters.errors++
      }
    }

    // Update job run as success
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          details: { date: targetDate, counters }
        })
        .eq('id', jobRunId)
    }

    console.log(`[COMPUTE] Complete: ${JSON.stringify(counters)}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: targetDate,
        counters
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[COMPUTE] Fatal error:', error)
    
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'fail',
          details: { error: error instanceof Error ? error.message : 'Unknown error', counters }
        })
        .eq('id', jobRunId)
    }
    
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
