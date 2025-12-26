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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Parse query parameters
    const url = new URL(req.url)
    const gameId = url.searchParams.get('id')

    if (!gameId) {
      return new Response(
        JSON.stringify({ error: 'id parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[API/GAME] Fetching game ${gameId}`)

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

    // Get last 20 matchup_games for transparency
    const [teamLowId, teamHighId] = [game.home_team_id, game.away_team_id].sort()
    
    const { data: historicalGames } = await supabase
      .from('matchup_games')
      .select(`
        id,
        played_at_utc,
        total,
        game:games!matchup_games_game_id_fkey(
          home_score,
          away_score,
          home_team:teams!games_home_team_id_fkey(name, abbrev),
          away_team:teams!games_away_team_id_fkey(name, abbrev)
        )
      `)
      .eq('sport_id', game.sport_id)
      .eq('team_low_id', teamLowId)
      .eq('team_high_id', teamHighId)
      .order('played_at_utc', { ascending: false })
      .limit(20)

    // Get matchup stats
    const { data: stats } = await supabase
      .from('matchup_stats')
      .select('*')
      .eq('sport_id', game.sport_id)
      .eq('team_low_id', teamLowId)
      .eq('team_high_id', teamHighId)
      .maybeSingle()

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

    return new Response(
      JSON.stringify({
        success: true,
        game: {
          id: game.id,
          sport_id: game.sport_id,
          start_time_utc: game.start_time_utc,
          status: game.status,
          home_team: (game.home_team as any)?.[0] || null,
          away_team: (game.away_team as any)?.[0] || null,
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
        } : null,
        stats: stats ? {
          n_games: stats.n_games,
          p05: stats.p05,
          p95: stats.p95,
          median: stats.median,
          min_total: stats.min_total,
          max_total: stats.max_total,
        } : null,
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
