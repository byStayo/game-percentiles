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
  status: 'scheduled' | 'live' | 'final' | 'postponed' | 'canceled'
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

// All supported sports
const SPORTS = ['nba', 'mlb', 'nfl', 'nhl']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let jobRunId: number | null = null
  const counters = { fetched: 0, upserted: 0, finals: 0, errors: 0 }

  try {
    const sportsDataKey = Deno.env.get('SPORTSDATAIO_KEY')
    if (!sportsDataKey) {
      throw new Error('SPORTSDATAIO_KEY not configured')
    }

    let requestBody: { sport_id?: string; date?: string } = {}
    try {
      requestBody = await req.json()
    } catch {
      // Empty body is OK
    }
    
    const { sport_id, date } = requestBody
    const targetDate = date || getTodayET()
    const sportsToIngest = sport_id ? [sport_id] : SPORTS

    console.log(`[INGEST] Starting for ${sportsToIngest.join(', ')} on ${targetDate}`)

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ 
        job_name: 'ingest', 
        details: { sports: sportsToIngest, date: targetDate } 
      })
      .select()
      .single()

    jobRunId = jobRun?.id || null

    const sportResults: Record<string, { found: number; upserted: number; finals: number }> = {}

    for (const sportId of sportsToIngest) {
      try {
        let games: GameData[] = []

        if (sportId === 'nba') {
          games = await fetchNBAGames(sportsDataKey, targetDate)
        } else if (sportId === 'mlb') {
          games = await fetchMLBGames(sportsDataKey, targetDate)
        } else if (sportId === 'nfl') {
          games = await fetchNFLGames(sportsDataKey)
        } else if (sportId === 'nhl') {
          games = await fetchNHLGames(sportsDataKey, targetDate)
        }

        counters.fetched += games.length
        sportResults[sportId] = { found: games.length, upserted: 0, finals: 0 }

        console.log(`[INGEST] Found ${games.length} games for ${sportId}`)

        for (const game of games) {
          try {
            // Upsert home team
            const { data: homeTeam } = await supabase
              .from('teams')
              .upsert({
                sport_id: sportId,
                provider_team_key: game.home_team_key,
                name: game.home_team_name,
                city: game.home_team_city || null,
              }, { onConflict: 'sport_id,league_id,provider_team_key' })
              .select()
              .single()

            // Upsert away team
            const { data: awayTeam } = await supabase
              .from('teams')
              .upsert({
                sport_id: sportId,
                provider_team_key: game.away_team_key,
                name: game.away_team_name,
                city: game.away_team_city || null,
              }, { onConflict: 'sport_id,league_id,provider_team_key' })
              .select()
              .single()

            if (!homeTeam || !awayTeam) continue

            // Calculate final total if game is final
            const isFinal = game.status === 'final' && game.home_score !== null && game.away_score !== null
            const finalTotal = isFinal ? (game.home_score! + game.away_score!) : null

            // Upsert game
            const { data: dbGame, error: gameError } = await supabase
              .from('games')
              .upsert({
                sport_id: sportId,
                provider_game_key: game.provider_game_key,
                start_time_utc: game.start_time_utc,
                home_team_id: homeTeam.id,
                away_team_id: awayTeam.id,
                home_score: game.home_score,
                away_score: game.away_score,
                final_total: finalTotal,
                status: game.status,
                last_seen_at: new Date().toISOString(),
              }, { onConflict: 'sport_id,league_id,provider_game_key' })
              .select()
              .single()

            if (gameError || !dbGame) continue

            counters.upserted++
            sportResults[sportId].upserted++

            // If game just became final, insert matchup_games row
            if (isFinal && finalTotal !== null) {
              const [teamLowId, teamHighId] = [homeTeam.id, awayTeam.id].sort()

              await supabase
                .from('matchup_games')
                .upsert({
                  sport_id: sportId,
                  team_low_id: teamLowId,
                  team_high_id: teamHighId,
                  game_id: dbGame.id,
                  played_at_utc: game.start_time_utc,
                  total: finalTotal,
                }, { onConflict: 'sport_id,league_id,team_low_id,team_high_id,game_id' })

              counters.finals++
              sportResults[sportId].finals++
            }
          } catch (gameErr) {
            counters.errors++
          }
        }
      } catch (sportError) {
        console.error(`[INGEST] Error for ${sportId}:`, sportError)
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
          details: { 
            date: targetDate, 
            counters,
            by_sport: sportResults
          }
        })
        .eq('id', jobRunId)
    }

    console.log(`[INGEST] Complete: ${JSON.stringify(counters)}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: targetDate,
        counters,
        by_sport: sportResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[INGEST] Fatal error:', error)
    
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

async function fetchNBAGames(apiKey: string, date: string): Promise<GameData[]> {
  const formattedDate = date.replace(/-/g, '')
  const url = `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${formattedDate}`
  
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
    status: mapStatus(game.Status),
  }))
}

async function fetchMLBGames(apiKey: string, date: string): Promise<GameData[]> {
  const formattedDate = date.replace(/-/g, '')
  const url = `https://api.sportsdata.io/v3/mlb/scores/json/GamesByDate/${formattedDate}`
  
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
    status: mapStatus(game.Status),
  }))
}

async function fetchNFLGames(apiKey: string): Promise<GameData[]> {
  // Get current week
  const weekUrl = `https://api.sportsdata.io/v3/nfl/scores/json/CurrentWeek`
  const weekResponse = await fetchWithRetry(weekUrl, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!weekResponse.ok) {
    console.error('NFL week API error:', weekResponse.status)
    return []
  }

  const currentWeek = await weekResponse.json()
  
  // Estimate current season
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  const season = `${year}REG`

  const url = `https://api.sportsdata.io/v3/nfl/scores/json/ScoresByWeek/${season}/${currentWeek}`
  
  const response = await fetchWithRetry(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    console.error('NFL API error:', response.status)
    return []
  }

  const data = await response.json()
  
  return data.map((game: any) => ({
    provider_game_key: String(game.GameKey || game.ScoreID),
    start_time_utc: game.DateTime || game.Date,
    home_team_key: game.HomeTeamID ? String(game.HomeTeamID) : game.HomeTeam,
    away_team_key: game.AwayTeamID ? String(game.AwayTeamID) : game.AwayTeam,
    home_team_name: game.HomeTeam,
    away_team_name: game.AwayTeam,
    home_score: game.HomeScore,
    away_score: game.AwayScore,
    status: mapStatus(game.Status),
  }))
}

async function fetchNHLGames(apiKey: string, date: string): Promise<GameData[]> {
  const formattedDate = date.replace(/-/g, '')
  const url = `https://api.sportsdata.io/v3/nhl/scores/json/GamesByDate/${formattedDate}`
  
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
    status: mapStatus(game.Status),
  }))
}

function mapStatus(status: string): 'scheduled' | 'live' | 'final' | 'postponed' | 'canceled' {
  const normalized = (status || '').toLowerCase()
  if (normalized === 'final' || normalized.includes('final')) return 'final'
  if (normalized === 'inprogress' || normalized.includes('progress')) return 'live'
  if (normalized === 'postponed') return 'postponed'
  if (normalized === 'canceled' || normalized === 'cancelled') return 'canceled'
  return 'scheduled'
}
