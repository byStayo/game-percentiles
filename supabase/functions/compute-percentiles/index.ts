import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Segment selection ladder - try in order until n >= MIN_SAMPLE
// PRIORITIZE recent data as it's most relevant (team composition similarity)
const SEGMENT_LADDER = [
  { key: 'h2h_1y', yearsBack: 1 },
  { key: 'h2h_3y', yearsBack: 3 },
  { key: 'h2h_5y', yearsBack: 5 },
  { key: 'h2h_10y', yearsBack: 10 },
  { key: 'h2h_20y', yearsBack: 20 },
  { key: 'h2h_all', yearsBack: null },
]

// Recency weights for the weighted segment
// More recent games get higher weight
const RECENCY_WEIGHTS = {
  0: 1.0,   // Current year
  1: 0.9,   // 1 year ago
  2: 0.7,   // 2 years ago
  3: 0.5,   // 3 years ago
  4: 0.3,   // 4+ years ago
}

const MIN_SAMPLE = 5
const HYBRID_MIN_GAMES = 10 // Each team needs at least this many recent games for hybrid
const WEIGHTED_MIN_GAMES = 8 // Minimum games needed for recency-weighted segment
const ENABLE_ON_DEMAND_HYDRATION = true // Enable hydration fallback for insufficient data

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

interface SegmentResult {
  segment_used: string
  n_used: number
  p05: number
  p95: number
  median: number
  totals: number[]
}

interface WeightedGame {
  total: number
  weight: number
  yearDiff: number
}

// Compute weighted percentiles using recency weights
function computeWeightedPercentiles(games: WeightedGame[]): { p05: number; p95: number; median: number } {
  // Sort by total
  const sorted = [...games].sort((a, b) => a.total - b.total)
  
  // Calculate total weight
  const totalWeight = sorted.reduce((sum, g) => sum + g.weight, 0)
  
  // Find weighted percentiles
  let cumWeight = 0
  let p05 = sorted[0].total
  let p95 = sorted[sorted.length - 1].total
  let median = sorted[Math.floor(sorted.length / 2)].total
  
  for (let i = 0; i < sorted.length; i++) {
    cumWeight += sorted[i].weight
    const percentile = cumWeight / totalWeight
    
    if (percentile >= 0.05 && p05 === sorted[0].total) {
      p05 = sorted[i].total
    }
    if (percentile >= 0.5 && median === sorted[Math.floor(sorted.length / 2)].total) {
      median = sorted[i].total
    }
    if (percentile >= 0.95) {
      p95 = sorted[i].total
      break
    }
  }
  
  return { p05, p95, median }
}

async function computeRecencyWeighted(
  supabase: any,
  sportId: string,
  franchiseLowId: string | null,
  franchiseHighId: string | null,
  teamLowId: string,
  teamHighId: string
): Promise<SegmentResult | null> {
  const currentYear = new Date().getFullYear()
  const usesFranchise = franchiseLowId && franchiseHighId

  // Get games from last 5 years with year info
  let query = supabase
    .from('matchup_games')
    .select('total, season_year')
    .eq('sport_id', sportId)
    .gte('season_year', currentYear - 5)

  if (usesFranchise) {
    query = query
      .eq('franchise_low_id', franchiseLowId)
      .eq('franchise_high_id', franchiseHighId)
  } else {
    query = query
      .eq('team_low_id', teamLowId)
      .eq('team_high_id', teamHighId)
  }

  const { data: games } = await query

  if (!games || games.length < WEIGHTED_MIN_GAMES) {
    return null
  }

  // Apply recency weights
  const weightedGames: WeightedGame[] = games.map((g: any) => {
    const yearDiff = currentYear - (g.season_year || currentYear)
    const weight = RECENCY_WEIGHTS[Math.min(yearDiff, 4) as keyof typeof RECENCY_WEIGHTS]
    return {
      total: Number(g.total),
      weight,
      yearDiff,
    }
  })

  const { p05, p95, median } = computeWeightedPercentiles(weightedGames)
  const totals = weightedGames.map(g => g.total).sort((a, b) => a - b)

  // Log weight distribution for debugging
  const weightsByYear = weightedGames.reduce((acc, g) => {
    acc[g.yearDiff] = (acc[g.yearDiff] || 0) + 1
    return acc
  }, {} as Record<number, number>)
  
  console.log(`[COMPUTE] Recency weighted: ${games.length} games, distribution: ${JSON.stringify(weightsByYear)}`)

  return {
    segment_used: 'recency_weighted',
    n_used: games.length,
    p05,
    p95,
    median,
    totals,
  }
}

async function selectBestSegment(
  supabase: any,
  sportId: string,
  franchiseLowId: string | null,
  franchiseHighId: string | null,
  teamLowId: string,
  teamHighId: string
): Promise<SegmentResult | null> {
  const currentYear = new Date().getFullYear()

  // If we have franchise IDs, use them; otherwise fall back to team IDs
  const usesFranchise = franchiseLowId && franchiseHighId

  for (const segment of SEGMENT_LADDER) {
    let query = supabase
      .from('matchup_games')
      .select('total, season_year')
      .eq('sport_id', sportId)

    if (usesFranchise) {
      query = query
        .eq('franchise_low_id', franchiseLowId)
        .eq('franchise_high_id', franchiseHighId)
    } else {
      query = query
        .eq('team_low_id', teamLowId)
        .eq('team_high_id', teamHighId)
    }

    if (segment.yearsBack !== null) {
      query = query.gte('season_year', currentYear - segment.yearsBack)
    }

    const { data: games } = await query

    if (games && games.length >= MIN_SAMPLE) {
      const totals = games.map((g: any) => Number(g.total)).sort((a: number, b: number) => a - b)
      const n = totals.length

      const p05Index = Math.max(0, Math.ceil(0.05 * n) - 1)
      const p95Index = Math.min(n - 1, Math.ceil(0.95 * n) - 1)
      const medianIndex = Math.floor(n / 2)

      return {
        segment_used: segment.key,
        n_used: n,
        p05: totals[p05Index],
        p95: totals[p95Index],
        median: n % 2 === 0 ? (totals[medianIndex - 1] + totals[medianIndex]) / 2 : totals[medianIndex],
        totals,
      }
    }
  }

  return null
}

async function computeHybridForm(
  supabase: any,
  sportId: string,
  homeTeamId: string,
  awayTeamId: string
): Promise<SegmentResult | null> {
  // Get last N games for each team (regardless of opponent)
  const { data: homeGames } = await supabase
    .from('games')
    .select('final_total')
    .eq('sport_id', sportId)
    .eq('status', 'final')
    .not('final_total', 'is', null)
    .or(`home_team_id.eq.${homeTeamId},away_team_id.eq.${homeTeamId}`)
    .order('start_time_utc', { ascending: false })
    .limit(20)

  const { data: awayGames } = await supabase
    .from('games')
    .select('final_total')
    .eq('sport_id', sportId)
    .eq('status', 'final')
    .not('final_total', 'is', null)
    .or(`home_team_id.eq.${awayTeamId},away_team_id.eq.${awayTeamId}`)
    .order('start_time_utc', { ascending: false })
    .limit(20)

  const homeCount = homeGames?.length || 0
  const awayCount = awayGames?.length || 0

  if (homeCount < HYBRID_MIN_GAMES || awayCount < HYBRID_MIN_GAMES) {
    return null
  }

  // Combine totals from both teams' recent games
  const allTotals = [
    ...(homeGames?.map((g: any) => Number(g.final_total)) || []),
    ...(awayGames?.map((g: any) => Number(g.final_total)) || []),
  ].sort((a, b) => a - b)

  const n = allTotals.length

  const p05Index = Math.max(0, Math.ceil(0.05 * n) - 1)
  const p95Index = Math.min(n - 1, Math.ceil(0.95 * n) - 1)
  const medianIndex = Math.floor(n / 2)

  return {
    segment_used: 'hybrid_form',
    n_used: n,
    p05: allTotals[p05Index],
    p95: allTotals[p95Index],
    median: n % 2 === 0 ? (allTotals[medianIndex - 1] + allTotals[medianIndex]) / 2 : allTotals[medianIndex],
    totals: allTotals,
  }
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
  const counters = { 
    computed: 0, 
    h2h_1y: 0,
    h2h_3y: 0, 
    h2h_5y: 0, 
    h2h_10y: 0, 
    h2h_20y: 0, 
    h2h_all: 0, 
    hybrid_form: 0,
    recency_weighted: 0,
    insufficient: 0, 
    errors: 0,
    hydrated: 0,
  }

  try {
    let requestBody: { date?: string; use_recency_weighted?: boolean } = {}
    try {
      requestBody = await req.json()
    } catch {
      // Empty body is OK
    }
    
    const { date, use_recency_weighted = true } = requestBody
    const targetDate = date || getTodayET()

    console.log(`[COMPUTE] Computing percentiles for ${targetDate} with segment ladder (recency_weighted: ${use_recency_weighted})`)

    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ job_name: 'compute', details: { date: targetDate, mode: 'segment_ladder', use_recency_weighted } })
      .select()
      .single()

    jobRunId = jobRun?.id || null

    // Get all games for the target date
    const startOfDayET = new Date(`${targetDate}T00:00:00-05:00`)
    const endOfDayET = new Date(`${targetDate}T23:59:59-05:00`)

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(id, abbrev), away_team:teams!games_away_team_id_fkey(id, abbrev)')
      .gte('start_time_utc', startOfDayET.toISOString())
      .lte('start_time_utc', endOfDayET.toISOString())

    if (gamesError) throw gamesError

    console.log(`[COMPUTE] Found ${games?.length || 0} games for ${targetDate}`)

    for (const game of games || []) {
      try {
        const [teamLowId, teamHighId] = [game.home_team_id, game.away_team_id].sort()
        const [franchiseLowId, franchiseHighId] = game.home_franchise_id && game.away_franchise_id
          ? [game.home_franchise_id, game.away_franchise_id].sort()
          : [null, null]

        let result: SegmentResult | null = null

        // Try recency weighted first if enabled
        if (use_recency_weighted) {
          result = await computeRecencyWeighted(
            supabase,
            game.sport_id,
            franchiseLowId,
            franchiseHighId,
            teamLowId,
            teamHighId
          )
        }

        // Fall back to segment ladder
        if (!result) {
          result = await selectBestSegment(
            supabase, 
            game.sport_id, 
            franchiseLowId, 
            franchiseHighId,
            teamLowId, 
            teamHighId
          )
        }

        // If no segment has enough data, try hybrid form
        if (!result) {
          result = await computeHybridForm(
            supabase,
            game.sport_id,
            game.home_team_id,
            game.away_team_id
          )
        }

        // If still no result and hydration is enabled, trigger on-demand hydration
        if (!result && ENABLE_ON_DEMAND_HYDRATION) {
          console.log(`[COMPUTE] Triggering hydration for ${game.sport_id}: ${game.home_team_id} vs ${game.away_team_id}`)
          
          try {
            // Call hydrate-matchup edge function
            const hydrateUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/hydrate-matchup`
            const hydrateResponse = await fetch(hydrateUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                sport_id: game.sport_id,
                team_a_id: game.home_team_id,
                team_b_id: game.away_team_id,
                years_back: 10,
              }),
            })
            
            if (hydrateResponse.ok) {
              const hydrateResult = await hydrateResponse.json()
              console.log(`[COMPUTE] Hydration complete: ${hydrateResult.inserted} new games, ${hydrateResult.n_games_total} total`)
              counters.hydrated++
              
              // Retry computing after hydration
              if (use_recency_weighted) {
                result = await computeRecencyWeighted(
                  supabase,
                  game.sport_id,
                  franchiseLowId,
                  franchiseHighId,
                  teamLowId,
                  teamHighId
                )
              }
              
              if (!result) {
                result = await selectBestSegment(
                  supabase,
                  game.sport_id,
                  franchiseLowId,
                  franchiseHighId,
                  teamLowId,
                  teamHighId
                )
              }
              
              if (!result) {
                result = await computeHybridForm(
                  supabase,
                  game.sport_id,
                  game.home_team_id,
                  game.away_team_id
                )
              }
            } else {
              console.log(`[COMPUTE] Hydration failed: ${hydrateResponse.status}`)
            }
          } catch (hydrateErr) {
            console.error(`[COMPUTE] Hydration error:`, hydrateErr)
          }
        }

        let isVisible = false
        let segmentUsed = 'insufficient'
        let nUsed = 0
        let p05: number | null = null
        let p95: number | null = null

        if (result) {
          isVisible = true
          segmentUsed = result.segment_used
          nUsed = result.n_used
          p05 = result.p05
          p95 = result.p95

          // Track which segment was used
          if (segmentUsed in counters) {
            (counters as any)[segmentUsed]++
          }

          // Update matchup_stats for the segment used
          const statsData = {
            sport_id: game.sport_id,
            team_low_id: teamLowId,
            team_high_id: teamHighId,
            franchise_low_id: franchiseLowId,
            franchise_high_id: franchiseHighId,
            segment_key: segmentUsed,
            n_games: nUsed,
            p05,
            p95,
            median: result.median,
            min_total: result.totals[0],
            max_total: result.totals[result.totals.length - 1],
            updated_at: new Date().toISOString(),
          }

          // Upsert
          const { data: existingStats } = await supabase
            .from('matchup_stats')
            .select('id')
            .eq('sport_id', game.sport_id)
            .eq('team_low_id', teamLowId)
            .eq('team_high_id', teamHighId)
            .eq('segment_key', segmentUsed)
            .maybeSingle()

          if (existingStats) {
            await supabase.from('matchup_stats').update(statsData).eq('id', existingStats.id)
          } else {
            await supabase.from('matchup_stats').insert(statsData)
          }
        } else {
          counters.insufficient++
        }

        // Find or update daily_edge
        const { data: existingEdge } = await supabase
          .from('daily_edges')
          .select('id')
          .eq('date_local', targetDate)
          .eq('game_id', game.id)
          .maybeSingle()

        const franchiseMatchupId = franchiseLowId && franchiseHighId 
          ? `${franchiseLowId}|${franchiseHighId}` 
          : null

        const edgeData = {
          sport_id: game.sport_id,
          n_h2h: nUsed,
          p05,
          p95,
          is_visible: isVisible,
          segment_used: segmentUsed,
          n_used: nUsed,
          franchise_matchup_id: franchiseMatchupId,
          updated_at: new Date().toISOString(),
        }

        if (existingEdge) {
          await supabase.from('daily_edges').update(edgeData).eq('id', existingEdge.id)
        } else {
          await supabase.from('daily_edges').insert({
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
        counters,
        segment_ladder: SEGMENT_LADDER.map(s => s.key),
        recency_weighted_enabled: use_recency_weighted,
        min_sample: MIN_SAMPLE,
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
