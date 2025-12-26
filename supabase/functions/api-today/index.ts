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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Parse query parameters
    const url = new URL(req.url)
    const date = url.searchParams.get('date') || getTodayET()
    const sportId = url.searchParams.get('sport_id')

    console.log(`[API/TODAY] Fetching edges for ${date}, sport: ${sportId || 'all'}`)

    // Build query for daily_edges with game and team data
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
        updated_at,
        game:games!daily_edges_game_id_fkey(
          id,
          start_time_utc,
          status,
          home_score,
          away_score,
          final_total,
          home_team:teams!games_home_team_id_fkey(id, name, city, abbrev),
          away_team:teams!games_away_team_id_fkey(id, name, city, abbrev)
        )
      `)
      .eq('date_local', date)
      .eq('is_visible', true) // Only return visible (n >= 5) games

    if (sportId) {
      query = query.eq('sport_id', sportId)
    }

    const { data: edges, error } = await query.order('sport_id')

    if (error) {
      console.error('[API/TODAY] Query error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform data for frontend consumption
    const games = (edges || []).map(edge => {
      const game = edge.game as any
      return {
        id: edge.id,
        game_id: edge.game_id,
        date_local: edge.date_local,
        sport_id: edge.sport_id,
        start_time_utc: game?.start_time_utc,
        status: game?.status,
        home_team: game?.home_team?.[0] || null,
        away_team: game?.away_team?.[0] || null,
        home_score: game?.home_score,
        away_score: game?.away_score,
        final_total: game?.final_total,
        n_h2h: edge.n_h2h,
        p05: edge.p05,
        p95: edge.p95,
        dk_offered: edge.dk_offered,
        dk_total_line: edge.dk_total_line,
        dk_line_percentile: edge.dk_line_percentile,
        updated_at: edge.updated_at,
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
