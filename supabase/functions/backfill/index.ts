import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================
// RETRY WITH EXPONENTIAL BACKOFF
// ============================================================
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      
      // Retry on 429 or 5xx
      if (response.status === 429 || response.status >= 500) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms (status: ${response.status})`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      
      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown fetch error')
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms (error: ${lastError.message})`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  
  throw lastError || new Error('Max retries exceeded')
}

interface GameData {
  provider_game_key: string
  start_time_utc: string
  home_team_key: string
  away_team_key: string
  home_team_name: string
  away_team_name: string
  home_team_city?: string
  away_team_city?: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'final'
}

// Season configurations
const SEASON_CONFIG: Record<string, { seasons: number; yearsBack: number }> = {
  nfl: { seasons: 20, yearsBack: 20 },
  nba: { seasons: 10, yearsBack: 10 },
  mlb: { seasons: 10, yearsBack: 10 },
  nhl: { seasons: 10, yearsBack: 10 },
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
  const counters = { fetched: 0, upserted: 0, matchups: 0, errors: 0 }

  try {
    const sportsDataKey = Deno.env.get('SPORTSDATAIO_KEY')
    if (!sportsDataKey) {
      throw new Error('SPORTSDATAIO_KEY not configured')
    }

    const { sport_id, seasons_override } = await req.json()
    
    if (!sport_id) {
      throw new Error('sport_id is required')
    }

    const config = SEASON_CONFIG[sport_id]
    if (!config) {
      throw new Error(`Unknown sport: ${sport_id}. Supported: nfl, nba, mlb, nhl`)
    }

    const numSeasons = seasons_override || config.seasons

    console.log(`[BACKFILL] Starting ${sport_id}, ${numSeasons} seasons`)

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ 
        job_name: 'backfill', 
        details: { sport_id, seasons: numSeasons, status: 'running' } 
      })
      .select()
      .single()

    jobRunId = jobRun?.id || null

    const currentYear = new Date().getFullYear()
    const errorDetails: string[] = []
    
    for (let i = 0; i < numSeasons; i++) {
      const year = currentYear - i
      console.log(`[BACKFILL] Processing ${sport_id} season ${year}`)

      try {
        let games: GameData[] = []

        if (sport_id === 'nba') {
          games = await fetchNBASeasonGames(sportsDataKey, year)
        } else if (sport_id === 'mlb') {
          games = await fetchMLBSeasonGames(sportsDataKey, year)
        } else if (sport_id === 'nfl') {
          games = await fetchNFLSeasonGames(sportsDataKey, year)
        } else if (sport_id === 'nhl') {
          games = await fetchNHLSeasonGames(sportsDataKey, year)
        }

        counters.fetched += games.length
        console.log(`[BACKFILL] Found ${games.length} games for ${year}`)

        for (const game of games) {
          // Only process final games with scores
          if (game.status !== 'final' || game.home_score === null || game.away_score === null) {
            continue
          }

          try {
            // Upsert home team with city
            const { data: homeTeam } = await supabase
              .from('teams')
              .upsert({
                sport_id,
                provider_team_key: game.home_team_key,
                name: game.home_team_name,
                city: game.home_team_city || null,
              }, { onConflict: 'sport_id,league_id,provider_team_key' })
              .select()
              .single()

            // Upsert away team with city
            const { data: awayTeam } = await supabase
              .from('teams')
              .upsert({
                sport_id,
                provider_team_key: game.away_team_key,
                name: game.away_team_name,
                city: game.away_team_city || null,
              }, { onConflict: 'sport_id,league_id,provider_team_key' })
              .select()
              .single()

            if (!homeTeam || !awayTeam) continue

            // Calculate final total
            const finalTotal = (game.home_score || 0) + (game.away_score || 0)

            // Upsert game
            const { data: dbGame, error: gameError } = await supabase
              .from('games')
              .upsert({
                sport_id,
                provider_game_key: game.provider_game_key,
                start_time_utc: game.start_time_utc,
                home_team_id: homeTeam.id,
                away_team_id: awayTeam.id,
                home_score: game.home_score,
                away_score: game.away_score,
                final_total: finalTotal,
                status: 'final',
                last_seen_at: new Date().toISOString(),
              }, { onConflict: 'sport_id,league_id,provider_game_key' })
              .select()
              .single()

            if (gameError || !dbGame) continue

            counters.upserted++

            // Insert matchup game with canonical team ordering
            const [teamLowId, teamHighId] = [homeTeam.id, awayTeam.id].sort()

            await supabase
              .from('matchup_games')
              .upsert({
                sport_id,
                team_low_id: teamLowId,
                team_high_id: teamHighId,
                game_id: dbGame.id,
                played_at_utc: game.start_time_utc,
                total: finalTotal,
              }, { onConflict: 'sport_id,league_id,team_low_id,team_high_id,game_id' })

            counters.matchups++
          } catch (gameErr) {
            counters.errors++
          }
        }
      } catch (seasonError) {
        const msg = `Season ${year}: ${seasonError instanceof Error ? seasonError.message : 'Unknown error'}`
        console.error(`[BACKFILL] Error: ${msg}`)
        errorDetails.push(msg)
        counters.errors++
      }
    }

    // Compute matchup stats for all affected matchups
    console.log('[BACKFILL] Computing matchup stats...')
    
    const { data: matchups } = await supabase
      .from('matchup_games')
      .select('sport_id, team_low_id, team_high_id')
      .eq('sport_id', sport_id)
    
    const uniqueMatchups = new Set<string>()
    matchups?.forEach(m => {
      uniqueMatchups.add(`${m.sport_id}|${m.team_low_id}|${m.team_high_id}`)
    })

    for (const key of uniqueMatchups) {
      const [sportId, teamLowId, teamHighId] = key.split('|')
      
      const { data: matchupGames } = await supabase
        .from('matchup_games')
        .select('total')
        .eq('sport_id', sportId)
        .eq('team_low_id', teamLowId)
        .eq('team_high_id', teamHighId)

      if (matchupGames && matchupGames.length > 0) {
        const totals = matchupGames.map(mg => Number(mg.total)).sort((a, b) => a - b)
        const n = totals.length

        // Nearest-rank quantiles
        const p05Index = Math.max(1, Math.ceil(0.05 * n)) - 1
        const p95Index = Math.max(1, Math.ceil(0.95 * n)) - 1
        const medianIndex = Math.floor(n / 2)

        await supabase
          .from('matchup_stats')
          .upsert({
            sport_id: sportId,
            team_low_id: teamLowId,
            team_high_id: teamHighId,
            n_games: n,
            p05: totals[p05Index],
            p95: totals[p95Index],
            median: n % 2 === 0 ? (totals[medianIndex - 1] + totals[medianIndex]) / 2 : totals[medianIndex],
            min_total: totals[0],
            max_total: totals[n - 1],
            updated_at: new Date().toISOString(),
          }, { onConflict: 'sport_id,league_id,team_low_id,team_high_id' })
      }
    }

    // Update job run as success
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: counters.errors > 0 ? 'success' : 'success',
          details: { 
            sport_id, 
            seasons: numSeasons, 
            counters,
            unique_matchups: uniqueMatchups.size,
            errors: errorDetails.slice(0, 10)
          }
        })
        .eq('id', jobRunId)
    }

    console.log(`[BACKFILL] Complete: ${JSON.stringify(counters)}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        sport_id,
        seasons: numSeasons,
        counters,
        unique_matchups: uniqueMatchups.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[BACKFILL] Fatal error:', error)
    
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

// ============================================================
// SPORT-SPECIFIC FETCH FUNCTIONS
// ============================================================

async function fetchNBASeasonGames(apiKey: string, year: number): Promise<GameData[]> {
  const url = `https://api.sportsdata.io/v3/nba/scores/json/Games/${year}`
  
  const response = await fetchWithRetry(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    console.error('NBA API error:', response.status)
    return []
  }

  const data = await response.json()
  
  return data.map((game: any) => ({
    provider_game_key: String(game.GameID),
    start_time_utc: game.DateTime || game.Day,
    home_team_key: game.HomeTeamID ? String(game.HomeTeamID) : game.HomeTeam,
    away_team_key: game.AwayTeamID ? String(game.AwayTeamID) : game.AwayTeam,
    home_team_name: game.HomeTeam,
    away_team_name: game.AwayTeam,
    home_score: game.HomeTeamScore,
    away_score: game.AwayTeamScore,
    status: game.Status === 'Final' ? 'final' : game.Status === 'InProgress' ? 'live' : 'scheduled',
  }))
}

async function fetchMLBSeasonGames(apiKey: string, year: number): Promise<GameData[]> {
  const url = `https://api.sportsdata.io/v3/mlb/scores/json/Games/${year}`
  
  const response = await fetchWithRetry(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    console.error('MLB API error:', response.status)
    return []
  }

  const data = await response.json()
  
  return data.map((game: any) => ({
    provider_game_key: String(game.GameID),
    start_time_utc: game.DateTime || game.Day,
    home_team_key: game.HomeTeamID ? String(game.HomeTeamID) : game.HomeTeam,
    away_team_key: game.AwayTeamID ? String(game.AwayTeamID) : game.AwayTeam,
    home_team_name: game.HomeTeam,
    away_team_name: game.AwayTeam,
    home_score: game.HomeTeamRuns,
    away_score: game.AwayTeamRuns,
    status: game.Status === 'Final' ? 'final' : game.Status === 'InProgress' ? 'live' : 'scheduled',
  }))
}

async function fetchNFLSeasonGames(apiKey: string, year: number): Promise<GameData[]> {
  const season = `${year}REG`
  const allGames: GameData[] = []

  // NFL has up to 18 weeks in regular season
  for (let week = 1; week <= 18; week++) {
    const url = `https://api.sportsdata.io/v3/nfl/scores/json/ScoresByWeek/${season}/${week}`
    
    try {
      const response = await fetchWithRetry(url, {
        headers: { 'Ocp-Apim-Subscription-Key': apiKey }
      })

      if (!response.ok) continue

      const data = await response.json()
      
      const games = data.map((game: any) => ({
        provider_game_key: String(game.GameKey || game.ScoreID),
        start_time_utc: game.DateTime || game.Date,
        home_team_key: game.HomeTeamID ? String(game.HomeTeamID) : game.HomeTeam,
        away_team_key: game.AwayTeamID ? String(game.AwayTeamID) : game.AwayTeam,
        home_team_name: game.HomeTeam,
        away_team_name: game.AwayTeam,
        home_score: game.HomeScore,
        away_score: game.AwayScore,
        status: game.Status === 'Final' ? 'final' : game.Status === 'InProgress' ? 'live' : 'scheduled',
      }))

      allGames.push(...games)
    } catch {
      // Skip failed weeks, continue
    }
  }

  return allGames
}

async function fetchNHLSeasonGames(apiKey: string, year: number): Promise<GameData[]> {
  const url = `https://api.sportsdata.io/v3/nhl/scores/json/Games/${year}`
  
  const response = await fetchWithRetry(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    console.error('NHL API error:', response.status)
    return []
  }

  const data = await response.json()
  
  return data.map((game: any) => ({
    provider_game_key: String(game.GameID),
    start_time_utc: game.DateTime || game.Day,
    home_team_key: game.HomeTeamID ? String(game.HomeTeamID) : game.HomeTeam,
    away_team_key: game.AwayTeamID ? String(game.AwayTeamID) : game.AwayTeam,
    home_team_name: game.HomeTeam,
    away_team_name: game.AwayTeam,
    home_score: game.HomeTeamScore,
    away_score: game.AwayTeamScore,
    status: game.Status === 'Final' ? 'final' : game.Status === 'InProgress' ? 'live' : 'scheduled',
  }))
}
