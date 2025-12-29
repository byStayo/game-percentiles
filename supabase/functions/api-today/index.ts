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

  try {
    // Use service role key to bypass RLS for read operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse query parameters
    const url = new URL(req.url)
    const date = url.searchParams.get('date') || getTodayET()
    const sportId = url.searchParams.get('sport_id')
    const debug = url.searchParams.get('debug') === '1'

    console.log(`[API/TODAY] Fetching edges for ${date}, sport: ${sportId || 'all'} (debug=${debug})`)

    // Build query for daily_edges (visible-only for the main UI payload)
    let query = supabase
      .from('daily_edges')
      .select(`
        id,
        date_local,
        sport_id,
        game_id,
        n_h2h,
        p05,
        p95,
        is_visible,
        dk_offered,
        dk_total_line,
        dk_line_percentile,
        segment_used,
        n_used,
        updated_at,
        p95_over_line,
        p95_over_odds,
        p05_under_line,
        p05_under_odds,
        best_over_edge,
        best_under_edge,
        alternate_lines
      `)
      .eq('date_local', date)
      .eq('is_visible', true)

    if (sportId) {
      query = query.eq('sport_id', sportId)
    }

    const { data: edges, error } = await query.order('sport_id')

    // Optional debug payload to explain "0 games" cases
    let debugPayload: any = undefined
    if (debug) {
      // Fetch ALL edges (visible + hidden) for the date
      let debugEdgesQuery = supabase
        .from('daily_edges')
        .select(`
          sport_id,
          is_visible,
          segment_used,
          n_h2h,
          n_used,
          dk_offered,
          dk_total_line,
          dk_line_percentile,
          best_over_edge,
          best_under_edge,
          p95_over_line,
          p05_under_line
        `)
        .eq('date_local', date)

      if (sportId) {
        debugEdgesQuery = debugEdgesQuery.eq('sport_id', sportId)
      }

      const { data: debugEdges, error: debugEdgesError } = await debugEdgesQuery

      if (debugEdgesError) {
        console.error('[API/TODAY] Debug edges query error:', debugEdgesError)
      }

      const edgesAll = debugEdges || []

      // Build sport list
      const sportsToCheck = sportId
        ? [sportId]
        : Array.from(new Set(edgesAll.map((e: any) => e.sport_id)))

      // If no edges exist yet, still check the premium sports so we can say "X games ingested, 0 computed"
      if (!sportId && sportsToCheck.length === 0) {
        sportsToCheck.push('nfl', 'nba')
      }

      const startOfDayET = new Date(`${date}T00:00:00-05:00`)
      const endOfDayET = new Date(`${date}T23:59:59-05:00`)

      const bySport: Record<string, any> = {}
      for (const s of sportsToCheck) {
        const sportEdges = edgesAll.filter((e: any) => e.sport_id === s)
        const edgesTotal = sportEdges.length
        const edgesVisible = sportEdges.filter((e: any) => e.is_visible).length
        const withOdds = sportEdges.filter((e: any) => e.dk_offered && e.dk_total_line !== null).length
        const withN5 = sportEdges.filter((e: any) => (e.n_used ?? e.n_h2h) >= 5).length
        const segments: Record<string, number> = {}
        for (const e of sportEdges) {
          const key = e.segment_used || 'none'
          segments[key] = (segments[key] || 0) + 1
        }

        const { count: gamesInDb } = await supabase
          .from('games')
          .select('id', { count: 'exact', head: true })
          .eq('sport_id', s)
          .gte('start_time_utc', startOfDayET.toISOString())
          .lte('start_time_utc', endOfDayET.toISOString())

        bySport[s] = {
          games_in_db: gamesInDb || 0,
          edges_total: edgesTotal,
          edges_visible: edgesVisible,
          with_dk_odds: withOdds,
          with_n5: withN5,
          segments,
        }
      }

      const totals = Object.values(bySport).reduce(
        (acc: any, v: any) => {
          acc.games_in_db += v.games_in_db
          acc.edges_total += v.edges_total
          acc.edges_visible += v.edges_visible
          acc.with_dk_odds += v.with_dk_odds
          acc.with_n5 += v.with_n5
          return acc
        },
        { games_in_db: 0, edges_total: 0, edges_visible: 0, with_dk_odds: 0, with_n5: 0, segments: {} as Record<string, number> }
      )

      debugPayload = {
        date,
        totals,
        by_sport: bySport,
        edges: edgesAll,
      }
    }

    if (error) {
      console.error('[API/TODAY] Query error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch games and teams for each edge
    const gameIds = (edges || []).map(e => e.game_id)
    
    const { data: gamesData } = gameIds.length > 0 
      ? await supabase
          .from('games')
          .select('id, start_time_utc, status, home_score, away_score, final_total, home_team_id, away_team_id')
          .in('id', gameIds)
      : { data: [] }

    console.log(`[API/TODAY] Found ${gamesData?.length || 0} games, gameIds: ${gameIds.slice(0, 3).join(', ')}`)
    const gamesMap = new Map((gamesData || []).map(g => [g.id, g]))

    // Get all team IDs
    const teamIds = new Set<string>()
    for (const g of gamesData || []) {
      if (g.home_team_id) teamIds.add(g.home_team_id)
      if (g.away_team_id) teamIds.add(g.away_team_id)
    }

    const { data: teamsData } = teamIds.size > 0
      ? await supabase
          .from('teams')
          .select('id, name, city, abbrev')
          .in('id', Array.from(teamIds))
      : { data: [] }

    const teamsMap = new Map((teamsData || []).map(t => [t.id, t]))

    // Transform data for frontend consumption
    const games = (edges || []).map(edge => {
      const game = gamesMap.get(edge.game_id)
      const homeTeam = game?.home_team_id ? teamsMap.get(game.home_team_id) : null
      const awayTeam = game?.away_team_id ? teamsMap.get(game.away_team_id) : null
      
      // Calculate DK line range from alternate lines
      const altLines = edge.alternate_lines as Array<{ point: number; over_price: number; under_price: number }> | null
      let dkHighestOver: { line: number; odds: number } | null = null
      let dkLowestUnder: { line: number; odds: number } | null = null
      
      if (altLines && altLines.length > 0) {
        // Highest over line = max point value (betting over a higher total)
        const maxLine = altLines.reduce((max, l) => l.point > max.point ? l : max, altLines[0])
        dkHighestOver = { line: maxLine.point, odds: maxLine.over_price }
        
        // Lowest under line = min point value (betting under a lower total)
        const minLine = altLines.reduce((min, l) => l.point < min.point ? l : min, altLines[0])
        dkLowestUnder = { line: minLine.point, odds: minLine.under_price }
      }
      
      return {
        id: edge.id,
        game_id: edge.game_id,
        date_local: edge.date_local,
        sport_id: edge.sport_id,
        start_time_utc: game?.start_time_utc,
        status: game?.status,
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: game?.home_score,
        away_score: game?.away_score,
        final_total: game?.final_total,
        n_h2h: edge.n_h2h,
        p05: edge.p05,
        p95: edge.p95,
        dk_offered: edge.dk_offered,
        dk_total_line: edge.dk_total_line,
        dk_line_percentile: edge.dk_line_percentile,
        segment_used: edge.segment_used,
        n_used: edge.n_used,
        updated_at: edge.updated_at,
        // Edge detection data
        p95_over_line: edge.p95_over_line,
        p95_over_odds: edge.p95_over_odds,
        p05_under_line: edge.p05_under_line,
        p05_under_odds: edge.p05_under_odds,
        best_over_edge: edge.best_over_edge,
        best_under_edge: edge.best_under_edge,
        // DK line range (extremes of what's offered)
        dk_highest_over: dkHighestOver,
        dk_lowest_under: dkLowestUnder,
      }
    })

    // Group by sport for easier frontend consumption
    const bySport: Record<string, typeof games> = {}
    for (const game of games) {
      if (!bySport[game.sport_id]) {
        bySport[game.sport_id] = []
      }
      bySport[game.sport_id].push(game)
    }

    return new Response(
      JSON.stringify({
        success: true,
        date,
        total: games.length,
        games,
        by_sport: bySport,
        ...(debug ? { debug: debugPayload } : {}),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[API/TODAY] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
