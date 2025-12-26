import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SPORT_KEYS: Record<string, string> = {
  nfl: 'americanfootball_nfl',
  nba: 'basketball_nba',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  soccer: 'soccer_usa_mls',
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

    const oddsApiKey = Deno.env.get('ODDS_API_KEY')
    if (!oddsApiKey) {
      throw new Error('ODDS_API_KEY not configured')
    }

    const { sport_id } = await req.json()

    console.log(`Refreshing odds for ${sport_id}`)

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ job_name: 'odds_refresh', details: { sport_id } })
      .select()
      .single()

    const sportKey = SPORT_KEYS[sport_id]
    if (!sportKey) {
      throw new Error(`Unknown sport: ${sport_id}`)
    }

    // Fetch odds from The Odds API
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${oddsApiKey}&regions=us&markets=totals&bookmakers=draftkings`
    
    const response = await fetch(url)
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Odds API error:', response.status, errorText)
      throw new Error(`Odds API error: ${response.status}`)
    }

    const oddsData = await response.json()
    console.log(`Found ${oddsData.length} events with odds`)

    let matchedCount = 0
    let unmatchedCount = 0

    for (const event of oddsData) {
      // Try to match to our games
      const eventStartTime = new Date(event.commence_time)
      const windowStart = new Date(eventStartTime.getTime() - 2 * 60 * 60 * 1000) // 2 hours before
      const windowEnd = new Date(eventStartTime.getTime() + 2 * 60 * 60 * 1000) // 2 hours after

      // Get provider mappings for matching
      const { data: homeMapping } = await supabase
        .from('provider_mappings')
        .select('team_id')
        .eq('sport_id', sport_id)
        .eq('odds_api_team_name', event.home_team)
        .maybeSingle()

      const { data: awayMapping } = await supabase
        .from('provider_mappings')
        .select('team_id')
        .eq('sport_id', sport_id)
        .eq('odds_api_team_name', event.away_team)
        .maybeSingle()

      let gameId: string | null = null

      if (homeMapping && awayMapping) {
        // Try exact match by team IDs
        const { data: game } = await supabase
          .from('games')
          .select('id')
          .eq('sport_id', sport_id)
          .eq('home_team_id', homeMapping.team_id)
          .eq('away_team_id', awayMapping.team_id)
          .gte('start_time_utc', windowStart.toISOString())
          .lte('start_time_utc', windowEnd.toISOString())
          .maybeSingle()

        gameId = game?.id || null
      }

      // Fallback: fuzzy match by time window and team names
      if (!gameId) {
        const { data: games } = await supabase
          .from('games')
          .select(`
            id,
            home_team:teams!games_home_team_id_fkey(name),
            away_team:teams!games_away_team_id_fkey(name)
          `)
          .eq('sport_id', sport_id)
          .gte('start_time_utc', windowStart.toISOString())
          .lte('start_time_utc', windowEnd.toISOString())

        if (games && games.length > 0) {
          // Simple fuzzy match - check if team names contain similar text
          for (const game of games) {
            const homeMatch = (game.home_team as any)?.name?.toLowerCase().includes(event.home_team.toLowerCase().split(' ').pop()) ||
                             event.home_team.toLowerCase().includes((game.home_team as any)?.name?.toLowerCase().split(' ').pop())
            const awayMatch = (game.away_team as any)?.name?.toLowerCase().includes(event.away_team.toLowerCase().split(' ').pop()) ||
                             event.away_team.toLowerCase().includes((game.away_team as any)?.name?.toLowerCase().split(' ').pop())

            if (homeMatch && awayMatch) {
              gameId = game.id
              
              // Auto-create provider mappings
              if (!homeMapping) {
                await supabase.from('provider_mappings').upsert({
                  sport_id,
                  team_id: (game as any).home_team_id,
                  odds_api_team_name: event.home_team,
                }, { onConflict: 'sport_id,league_id,team_id' })
              }
              if (!awayMapping) {
                await supabase.from('provider_mappings').upsert({
                  sport_id,
                  team_id: (game as any).away_team_id,
                  odds_api_team_name: event.away_team,
                }, { onConflict: 'sport_id,league_id,team_id' })
              }
              break
            }
          }
        }
      }

      if (!gameId) {
        unmatchedCount++
        console.log(`Could not match event: ${event.away_team} @ ${event.home_team}`)
        continue
      }

      // Extract DraftKings totals line
      const dkBookmaker = event.bookmakers?.find((b: any) => b.key === 'draftkings')
      const totalsMarket = dkBookmaker?.markets?.find((m: any) => m.key === 'totals')
      const totalLine = totalsMarket?.outcomes?.[0]?.point

      if (totalLine !== undefined) {
        // Insert odds snapshot
        await supabase.from('odds_snapshots').insert({
          game_id: gameId,
          bookmaker: 'draftkings',
          market: 'totals',
          total_line: totalLine,
          fetched_at: new Date().toISOString(),
          raw_payload: event,
        })

        // Get matchup stats to compute percentile
        const { data: game } = await supabase
          .from('games')
          .select('home_team_id, away_team_id')
          .eq('id', gameId)
          .single()

        if (game) {
          const [teamLowId, teamHighId] = [game.home_team_id, game.away_team_id].sort()

          const { data: matchupGames } = await supabase
            .from('matchup_games')
            .select('total')
            .eq('sport_id', sport_id)
            .eq('team_low_id', teamLowId)
            .eq('team_high_id', teamHighId)

          let dkLinePercentile: number | null = null

          if (matchupGames && matchupGames.length > 0) {
            const totals = matchupGames.map(mg => Number(mg.total))
            const countBelowOrEqual = totals.filter(t => t <= totalLine).length
            dkLinePercentile = (countBelowOrEqual / totals.length) * 100
          }

          // Update daily_edge
          await supabase
            .from('daily_edges')
            .update({
              dk_offered: true,
              dk_total_line: totalLine,
              dk_line_percentile: dkLinePercentile,
              updated_at: new Date().toISOString(),
            })
            .eq('game_id', gameId)
        }

        matchedCount++
      }
    }

    // Update job run
    if (jobRun) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          details: { sport_id, events_found: oddsData.length, matched: matchedCount, unmatched: unmatchedCount }
        })
        .eq('id', jobRun.id)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sport_id,
        events_found: oddsData.length,
        matched: matchedCount,
        unmatched: unmatchedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Odds refresh error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
