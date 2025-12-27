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
  home_team_abbrev: string
  away_team_abbrev: string
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

// Normalize team abbreviation for franchise lookup
function normalizeAbbrev(sport: string, abbrev: string): string {
  const normalized = abbrev?.toUpperCase() || ''
  
  const mappings: Record<string, Record<string, string>> = {
    nfl: { 'WSH': 'WAS', 'JAC': 'JAX', 'LVR': 'LV', 'LAR': 'LA' },
    nba: { 'PHX': 'PHO', 'BKN': 'BRK', 'CHA': 'CHO', 'NOP': 'NO' },
    nhl: { 'VGK': 'VEG', 'SJS': 'SJ', 'NJD': 'NJ', 'TBL': 'TB' },
    mlb: { 'ARI': 'AZ', 'CHW': 'CWS', 'KCR': 'KC', 'SFG': 'SF', 'TBR': 'TB', 'WSN': 'WSH' },
  }
  
  return mappings[sport]?.[normalized] || normalized
}

// Find franchise by team abbreviation (cached)
async function findFranchiseByAbbrev(
  supabase: any,
  sportId: string,
  abbrev: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  const cacheKey = `${sportId}:${abbrev}`
  if (cache.has(cacheKey)) return cache.get(cacheKey) || null

  const normalized = normalizeAbbrev(sportId, abbrev)
  
  // Try team_versions first (most reliable)
  const { data: teamVersion } = await supabase
    .from('team_versions')
    .select('franchise_id')
    .eq('sport_id', sportId)
    .ilike('abbrev', normalized)
    .limit(1)
    .maybeSingle()

  if (teamVersion?.franchise_id) {
    cache.set(cacheKey, teamVersion.franchise_id)
    return teamVersion.franchise_id
  }

  // Fallback: search franchises by canonical_name
  const { data: franchise } = await supabase
    .from('franchises')
    .select('id')
    .eq('sport_id', sportId)
    .ilike('canonical_name', `%${abbrev}%`)
    .limit(1)
    .maybeSingle()

  const franchiseId = franchise?.id || null
  cache.set(cacheKey, franchiseId)
  return franchiseId
}

// All supported sports
const SPORTS = ['nba', 'mlb', 'nfl', 'nhl']

// Find or create team helper
async function findOrCreateTeam(
  supabase: any,
  sportId: string,
  providerKey: string,
  name: string,
  city?: string
): Promise<{ id: string } | null> {
  // First try to find existing team
  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('sport_id', sportId)
    .eq('provider_team_key', providerKey)
    .is('league_id', null)
    .maybeSingle()

  if (existing) return existing

  // Create new team
  const { data: created, error } = await supabase
    .from('teams')
    .insert({
      sport_id: sportId,
      provider_team_key: providerKey,
      name: name,
      city: city || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Team insert error:', error.message)
    // Try to find again in case of race condition
    const { data: retry } = await supabase
      .from('teams')
      .select('id')
      .eq('sport_id', sportId)
      .eq('provider_team_key', providerKey)
      .is('league_id', null)
      .maybeSingle()
    return retry
  }

  return created
}

// Find or create game helper
// NOTE: final_total is a GENERATED column - we don't insert it, the DB computes it
async function findOrCreateGame(
  supabase: any,
  sportId: string,
  providerKey: string,
  gameData: {
    start_time_utc: string
    home_team_id: string
    away_team_id: string
    home_franchise_id: string | null
    away_franchise_id: string | null
    home_score: number | null
    away_score: number | null
    status: string
  }
): Promise<{ id: string } | null> {
  // First try to find existing game
  const { data: existing } = await supabase
    .from('games')
    .select('id')
    .eq('sport_id', sportId)
    .eq('provider_game_key', providerKey)
    .is('league_id', null)
    .maybeSingle()

  if (existing) {
    // Update existing game with franchise IDs
    await supabase
      .from('games')
      .update({
        start_time_utc: gameData.start_time_utc,
        home_team_id: gameData.home_team_id,
        away_team_id: gameData.away_team_id,
        home_franchise_id: gameData.home_franchise_id,
        away_franchise_id: gameData.away_franchise_id,
        home_score: gameData.home_score,
        away_score: gameData.away_score,
        status: gameData.status,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return existing
  }

  // Create new game with franchise IDs
  const { data: created, error } = await supabase
    .from('games')
    .insert({
      sport_id: sportId,
      provider_game_key: providerKey,
      start_time_utc: gameData.start_time_utc,
      home_team_id: gameData.home_team_id,
      away_team_id: gameData.away_team_id,
      home_franchise_id: gameData.home_franchise_id,
      away_franchise_id: gameData.away_franchise_id,
      home_score: gameData.home_score,
      away_score: gameData.away_score,
      status: gameData.status,
      last_seen_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('Game insert error:', error.message)
    return null
  }

  return created
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
  const counters = { fetched: 0, upserted: 0, finals: 0, franchises_linked: 0, errors: 0 }
  const franchiseCache = new Map<string, string | null>()

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
            // Find or create teams
            const homeTeam = await findOrCreateTeam(
              supabase, sportId, game.home_team_key, game.home_team_name, game.home_team_city
            )
            const awayTeam = await findOrCreateTeam(
              supabase, sportId, game.away_team_key, game.away_team_name, game.away_team_city
            )

            if (!homeTeam || !awayTeam) continue

            // Look up franchise IDs from team abbreviations
            const homeFranchiseId = await findFranchiseByAbbrev(
              supabase, sportId, game.home_team_abbrev, franchiseCache
            )
            const awayFranchiseId = await findFranchiseByAbbrev(
              supabase, sportId, game.away_team_abbrev, franchiseCache
            )

            if (homeFranchiseId || awayFranchiseId) {
              counters.franchises_linked++
            }

            // Check if game is final for matchup insertion
            const isFinal = game.status === 'final' && game.home_score !== null && game.away_score !== null
            const finalTotal = isFinal ? (game.home_score! + game.away_score!) : null

            // Find or create game with franchise IDs
            const dbGame = await findOrCreateGame(supabase, sportId, game.provider_game_key, {
              start_time_utc: game.start_time_utc,
              home_team_id: homeTeam.id,
              away_team_id: awayTeam.id,
              home_franchise_id: homeFranchiseId,
              away_franchise_id: awayFranchiseId,
              home_score: game.home_score,
              away_score: game.away_score,
              status: game.status,
            })

            if (!dbGame) continue

            counters.upserted++
            sportResults[sportId].upserted++

            // If game is final, insert matchup_games row with franchise IDs
            if (isFinal && finalTotal !== null) {
              const [teamLowId, teamHighId] = [homeTeam.id, awayTeam.id].sort()
              const [franchiseLowId, franchiseHighId] = [homeFranchiseId, awayFranchiseId].sort((a, b) => {
                if (!a) return 1
                if (!b) return -1
                return a.localeCompare(b)
              })

              // Check if matchup game already exists
              const { data: existingMg } = await supabase
                .from('matchup_games')
                .select('id')
                .eq('sport_id', sportId)
                .eq('team_low_id', teamLowId)
                .eq('team_high_id', teamHighId)
                .eq('game_id', dbGame.id)
                .is('league_id', null)
                .maybeSingle()

              if (!existingMg) {
                await supabase
                  .from('matchup_games')
                  .insert({
                    sport_id: sportId,
                    team_low_id: teamLowId,
                    team_high_id: teamHighId,
                    franchise_low_id: franchiseLowId || null,
                    franchise_high_id: franchiseHighId || null,
                    game_id: dbGame.id,
                    played_at_utc: game.start_time_utc,
                    total: finalTotal,
                  })

                counters.finals++
                sportResults[sportId].finals++
              }
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
  // SportsData.io expects date format: YYYY-MMM-DD (e.g., 2024-DEC-25)
  const dateObj = new Date(date + 'T12:00:00Z')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const formattedDate = `${dateObj.getFullYear()}-${months[dateObj.getMonth()]}-${String(dateObj.getDate()).padStart(2, '0')}`
  
  const url = `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${formattedDate}`
  console.log(`[INGEST] NBA API URL: ${url}`)
  
  const response = await fetchWithRetry(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    console.error(`NBA API error: ${response.status} - ${errorText}`)
    return []
  }

  const data = await response.json()
  
  return data.map((game: any) => ({
    provider_game_key: String(game.GameID),
    start_time_utc: game.DateTimeUTC || game.DateTime || game.Day,
    home_team_key: game.HomeTeamID ? String(game.HomeTeamID) : game.HomeTeam,
    away_team_key: game.AwayTeamID ? String(game.AwayTeamID) : game.AwayTeam,
    home_team_name: game.HomeTeam,
    away_team_name: game.AwayTeam,
    home_team_abbrev: game.HomeTeam,
    away_team_abbrev: game.AwayTeam,
    home_score: game.HomeTeamScore,
    away_score: game.AwayTeamScore,
    status: mapStatus(game.Status),
  }))
}

async function fetchMLBGames(apiKey: string, date: string): Promise<GameData[]> {
  // SportsData.io expects date format: YYYY-MMM-DD (e.g., 2024-DEC-25)
  const dateObj = new Date(date + 'T12:00:00Z')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const formattedDate = `${dateObj.getFullYear()}-${months[dateObj.getMonth()]}-${String(dateObj.getDate()).padStart(2, '0')}`
  
  const url = `https://api.sportsdata.io/v3/mlb/scores/json/GamesByDate/${formattedDate}`
  console.log(`[INGEST] MLB API URL: ${url}`)
  
  const response = await fetchWithRetry(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    console.error(`MLB API error: ${response.status} - ${errorText}`)
    return []
  }

  const data = await response.json()
  
  return data.map((game: any) => ({
    provider_game_key: String(game.GameID),
    start_time_utc: game.DateTimeUTC || game.DateTime || game.Day,
    home_team_key: game.HomeTeamID ? String(game.HomeTeamID) : game.HomeTeam,
    away_team_key: game.AwayTeamID ? String(game.AwayTeamID) : game.AwayTeam,
    home_team_name: game.HomeTeam,
    away_team_name: game.AwayTeam,
    home_team_abbrev: game.HomeTeam,
    away_team_abbrev: game.AwayTeam,
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
    start_time_utc: game.DateTimeUTC || game.DateTime || game.Date,
    home_team_key: game.HomeTeamID ? String(game.HomeTeamID) : game.HomeTeam,
    away_team_key: game.AwayTeamID ? String(game.AwayTeamID) : game.AwayTeam,
    home_team_name: game.HomeTeam,
    away_team_name: game.AwayTeam,
    home_team_abbrev: game.HomeTeam,
    away_team_abbrev: game.AwayTeam,
    home_score: game.HomeScore,
    away_score: game.AwayScore,
    status: mapStatus(game.Status),
  }))
}

async function fetchNHLGames(apiKey: string, date: string): Promise<GameData[]> {
  // SportsData.io expects date format: YYYY-MMM-DD (e.g., 2024-DEC-25)
  const dateObj = new Date(date + 'T12:00:00Z')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const formattedDate = `${dateObj.getFullYear()}-${months[dateObj.getMonth()]}-${String(dateObj.getDate()).padStart(2, '0')}`
  
  const url = `https://api.sportsdata.io/v3/nhl/scores/json/GamesByDate/${formattedDate}`
  console.log(`[INGEST] NHL API URL: ${url}`)
  
  const response = await fetchWithRetry(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    console.error(`NHL API error: ${response.status} - ${errorText}`)
    return []
  }

  const data = await response.json()
  
  return data.map((game: any) => ({
    provider_game_key: String(game.GameID),
    start_time_utc: game.DateTimeUTC || game.DateTime || game.Day,
    home_team_key: game.HomeTeamID ? String(game.HomeTeamID) : game.HomeTeam,
    away_team_key: game.AwayTeamID ? String(game.AwayTeamID) : game.AwayTeam,
    home_team_name: game.HomeTeam,
    away_team_name: game.AwayTeam,
    home_team_abbrev: game.HomeTeam,
    away_team_abbrev: game.AwayTeam,
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
