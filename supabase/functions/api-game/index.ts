import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Segment time windows in years
const SEGMENT_YEARS: Record<string, number | null> = {
  h2h_1y: 1,
  h2h_3y: 3,
  h2h_5y: 5,
  h2h_10y: 10,
  h2h_20y: 20,
  h2h_all: null, // no filter
}

// Decade date ranges - use actual dates for played_at_utc filtering
const DECADE_DATE_RANGES: Record<string, { start: string; end: string }> = {
  decade_2020s: { start: '2020-01-01T00:00:00Z', end: '2029-12-31T23:59:59Z' },
  decade_2010s: { start: '2010-01-01T00:00:00Z', end: '2019-12-31T23:59:59Z' },
  decade_2000s: { start: '2000-01-01T00:00:00Z', end: '2009-12-31T23:59:59Z' },
  decade_1990s: { start: '1990-01-01T00:00:00Z', end: '1999-12-31T23:59:59Z' },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Parse query parameters
    const url = new URL(req.url)
    const gameId = url.searchParams.get('id')
    const segment = url.searchParams.get('segment') || 'h2h_all' // default to all-time

    if (!gameId) {
      return new Response(
        JSON.stringify({ error: 'id parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[API/GAME] Fetching game ${gameId} with segment ${segment}`)

    // Get game with team data
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select(`
        id,
        sport_id,
        league_id,
        start_time_utc,
        status,
        home_score,
        away_score,
        final_total,
        home_team_id,
        away_team_id,
        home_franchise_id,
        away_franchise_id,
        home_team:teams!games_home_team_id_fkey(id, name, city, abbrev),
        away_team:teams!games_away_team_id_fkey(id, name, city, abbrev)
      `)
      .eq('id', gameId)
      .maybeSingle()

    if (gameError) {
      console.error('[API/GAME] Game query error:', gameError)
      return new Response(
        JSON.stringify({ error: gameError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!game) {
      return new Response(
        JSON.stringify({ error: 'Game not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get daily_edge for this game (may not exist if not visible)
    const { data: edge } = await supabase
      .from('daily_edges')
      .select('*')
      .eq('game_id', gameId)
      .maybeSingle()

    // Determine matchup keys - prefer franchise ids for broader history
    const franchiseLowId = game.home_franchise_id && game.away_franchise_id
      ? [game.home_franchise_id, game.away_franchise_id].sort()[0]
      : null
    const franchiseHighId = game.home_franchise_id && game.away_franchise_id
      ? [game.home_franchise_id, game.away_franchise_id].sort()[1]
      : null

    const [teamLowId, teamHighId] = [game.home_team_id, game.away_team_id].sort()
    
    // Calculate date filter based on segment
    const yearsBack = SEGMENT_YEARS[segment] ?? null
    const decadeDateRange = DECADE_DATE_RANGES[segment] ?? null
    
    let cutoffDate: string | null = null
    let decadeFilter: { start: string; end: string } | null = null
    
    if (yearsBack) {
      cutoffDate = new Date(Date.now() - yearsBack * 365 * 24 * 60 * 60 * 1000).toISOString()
    } else if (decadeDateRange) {
      decadeFilter = decadeDateRange
    }

    // Build query for historical games with optional date filter
    let historyQuery = supabase
      .from('matchup_games')
      .select(`
        id,
        played_at_utc,
        total,
        season_year,
        game:games!matchup_games_game_id_fkey(
          home_score,
          away_score,
          home_team:teams!games_home_team_id_fkey(name, abbrev),
          away_team:teams!games_away_team_id_fkey(name, abbrev)
        )
      `)
      .eq('sport_id', game.sport_id)
      .order('played_at_utc', { ascending: false })
      .limit(100)

    // Use franchise matchup if available, otherwise team matchup
    if (franchiseLowId && franchiseHighId) {
      historyQuery = historyQuery
        .eq('franchise_low_id', franchiseLowId)
        .eq('franchise_high_id', franchiseHighId)
    } else {
      historyQuery = historyQuery
        .eq('team_low_id', teamLowId)
        .eq('team_high_id', teamHighId)
    }

    if (cutoffDate) {
      historyQuery = historyQuery.gte('played_at_utc', cutoffDate)
    }
    
    // Use played_at_utc for decade filtering instead of season_year
    if (decadeFilter) {
      historyQuery = historyQuery
        .gte('played_at_utc', decadeFilter.start)
        .lte('played_at_utc', decadeFilter.end)
    }

    const { data: historicalGames } = await historyQuery

    // Get segment-specific matchup stats if available
    let stats = null
    
    // First try to get stats for the requested segment
    const { data: segmentStats } = await supabase
      .from('matchup_stats')
      .select('*')
      .eq('sport_id', game.sport_id)
      .eq('segment_key', segment)
      .or(
        franchiseLowId && franchiseHighId
          ? `and(franchise_low_id.eq.${franchiseLowId},franchise_high_id.eq.${franchiseHighId})`
          : `and(team_low_id.eq.${teamLowId},team_high_id.eq.${teamHighId})`
      )
      .maybeSingle()

    if (segmentStats) {
      stats = segmentStats
    } else {
      // Fall back to h2h_all if segment stats don't exist
      const { data: allTimeStats } = await supabase
        .from('matchup_stats')
        .select('*')
        .eq('sport_id', game.sport_id)
        .eq('segment_key', 'h2h_all')
        .or(
          franchiseLowId && franchiseHighId
            ? `and(franchise_low_id.eq.${franchiseLowId},franchise_high_id.eq.${franchiseHighId})`
            : `and(team_low_id.eq.${teamLowId},team_high_id.eq.${teamHighId})`
        )
        .maybeSingle()
      
      stats = allTimeStats
    }

    // Compute stats from filtered history if no pre-computed stats
    let computedStats = null
    if (historicalGames && historicalGames.length > 0) {
      const totals = historicalGames.map(g => g.total).sort((a, b) => a - b)
      const n = totals.length
      const p05Index = Math.floor(n * 0.05)
      const p95Index = Math.min(Math.floor(n * 0.95), n - 1)
      const medianIndex = Math.floor(n / 2)

      computedStats = {
        n_games: n,
        p05: totals[p05Index],
        p95: totals[p95Index],
        median: n % 2 === 0 ? (totals[medianIndex - 1] + totals[medianIndex]) / 2 : totals[medianIndex],
        min_total: totals[0],
        max_total: totals[n - 1],
      }
    }

    // Use computed stats if we don't have pre-computed ones or if segment doesn't match
    const finalStats = stats || computedStats

    // Transform historical games
    const history = (historicalGames || []).map(mg => {
      const g = mg.game as any
      return {
        id: mg.id,
        played_at: mg.played_at_utc,
        total: mg.total,
        home_team: g?.home_team?.[0]?.abbrev || g?.home_team?.[0]?.name,
        away_team: g?.away_team?.[0]?.abbrev || g?.away_team?.[0]?.name,
        home_score: g?.home_score,
        away_score: g?.away_score,
      }
    })

    // Handle joined team data - could be array or object depending on Supabase version
    const homeTeamData = game.home_team;
    const awayTeamData = game.away_team;
    const homeTeam = Array.isArray(homeTeamData) ? homeTeamData[0] : homeTeamData;
    const awayTeam = Array.isArray(awayTeamData) ? awayTeamData[0] : awayTeamData;

    return new Response(
      JSON.stringify({
        success: true,
        game: {
          id: game.id,
          sport_id: game.sport_id,
          start_time_utc: game.start_time_utc,
          status: game.status,
          home_team: homeTeam || null,
          away_team: awayTeam || null,
          home_score: game.home_score,
          away_score: game.away_score,
          final_total: game.final_total,
        },
        edge: edge ? {
          n_h2h: edge.n_h2h,
          p05: edge.p05,
          p95: edge.p95,
          is_visible: edge.is_visible,
          dk_offered: edge.dk_offered,
          dk_total_line: edge.dk_total_line,
          dk_line_percentile: edge.dk_line_percentile,
          segment_used: edge.segment_used,
          n_used: edge.n_used,
          // Edge detection data
          p95_over_line: edge.p95_over_line,
          p95_over_odds: edge.p95_over_odds,
          p05_under_line: edge.p05_under_line,
          p05_under_odds: edge.p05_under_odds,
          best_over_edge: edge.best_over_edge,
          best_under_edge: edge.best_under_edge,
          alternate_lines: edge.alternate_lines,
        } : null,
        stats: finalStats ? {
          n_games: finalStats.n_games,
          p05: finalStats.p05,
          p95: finalStats.p95,
          median: finalStats.median,
          min_total: finalStats.min_total,
          max_total: finalStats.max_total,
        } : null,
        segment: segment,
        history,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[API/GAME] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
