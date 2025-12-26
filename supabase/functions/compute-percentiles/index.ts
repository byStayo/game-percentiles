import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { date } = await req.json()
    const targetDate = date || new Date().toISOString().split('T')[0]

    console.log(`Computing percentiles for games on ${targetDate}`)

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ job_name: 'compute', details: { date: targetDate } })
      .select()
      .single()

    // Get all games for the target date
    const startOfDay = `${targetDate}T00:00:00Z`
    const endOfDay = `${targetDate}T23:59:59Z`

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .gte('start_time_utc', startOfDay)
      .lte('start_time_utc', endOfDay)

    if (gamesError) {
      throw gamesError
    }

    console.log(`Found ${games?.length || 0} games to compute`)

    let processedCount = 0

    for (const game of games || []) {
      // Determine team_low and team_high (sorted for consistent lookup)
      const [teamLowId, teamHighId] = [game.home_team_id, game.away_team_id].sort()

      // Get or compute matchup stats
      let { data: stats } = await supabase
        .from('matchup_stats')
        .select('*')
        .eq('sport_id', game.sport_id)
        .eq('team_low_id', teamLowId)
        .eq('team_high_id', teamHighId)
        .maybeSingle()

      // If no stats exist or they're stale, compute from matchup_games
      if (!stats) {
        const { data: matchupGames } = await supabase
          .from('matchup_games')
          .select('total')
          .eq('sport_id', game.sport_id)
          .eq('team_low_id', teamLowId)
          .eq('team_high_id', teamHighId)
          .order('total', { ascending: true })

        if (matchupGames && matchupGames.length > 0) {
          const totals = matchupGames.map(mg => Number(mg.total)).sort((a, b) => a - b)
          const n = totals.length

          // Calculate percentiles using nearest-rank method
          const p05Index = Math.max(1, Math.ceil(0.05 * n)) - 1
          const p95Index = Math.max(1, Math.ceil(0.95 * n)) - 1
          const medianIndex = Math.floor(n / 2)

          const newStats = {
            sport_id: game.sport_id,
            team_low_id: teamLowId,
            team_high_id: teamHighId,
            n_games: n,
            p05: totals[p05Index],
            p95: totals[p95Index],
            median: n % 2 === 0 ? (totals[medianIndex - 1] + totals[medianIndex]) / 2 : totals[medianIndex],
            min_total: totals[0],
            max_total: totals[n - 1],
            updated_at: new Date().toISOString(),
          }

          const { data: upsertedStats } = await supabase
            .from('matchup_stats')
            .upsert(newStats, { onConflict: 'sport_id,league_id,team_low_id,team_high_id' })
            .select()
            .single()

          stats = upsertedStats
        }
      }

      // Upsert daily_edge
      const dailyEdge = {
        date_local: targetDate,
        sport_id: game.sport_id,
        league_id: game.league_id,
        game_id: game.id,
        n_h2h: stats?.n_games || 0,
        p05: stats?.p05 || null,
        p95: stats?.p95 || null,
        updated_at: new Date().toISOString(),
      }

      await supabase
        .from('daily_edges')
        .upsert(dailyEdge, { onConflict: 'date_local,game_id' })

      processedCount++
    }

    // Update job run
    if (jobRun) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          details: { date: targetDate, games_processed: processedCount }
        })
        .eq('id', jobRun.id)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: targetDate,
        games_processed: processedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Compute error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
