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
  status: 'scheduled' | 'live' | 'final'
}

// Season configurations
const SEASON_CONFIG: Record<string, { seasons: number; yearsBack: number }> = {
  nfl: { seasons: 20, yearsBack: 20 },
  nba: { seasons: 10, yearsBack: 10 },
  mlb: { seasons: 10, yearsBack: 10 },
  nhl: { seasons: 10, yearsBack: 10 },
}

// Team cache to avoid duplicate lookups
const teamCache = new Map<string, string>()

// Find or create team helper
async function findOrCreateTeam(
  supabase: any,
  sportId: string,
  providerKey: string,
  name: string,
  city?: string
): Promise<string | null> {
  const cacheKey = `${sportId}:${providerKey}`
  if (teamCache.has(cacheKey)) {
    return teamCache.get(cacheKey)!
  }

  // First try to find existing team
  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('sport_id', sportId)
    .eq('provider_team_key', providerKey)
    .is('league_id', null)
    .maybeSingle()

  if (existing) {
    teamCache.set(cacheKey, existing.id)
    return existing.id
  }

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
    if (retry) {
      teamCache.set(cacheKey, retry.id)
      return retry.id
    }
    return null
  }

  teamCache.set(cacheKey, created.id)
  return created.id
}

// Background processing function
async function runBackfill(
  supabase: any,
  sportsDataKey: string,
  sport_id: string,
  numSeasons: number,
  jobRunId: number | null
) {
  const counters = { fetched: 0, upserted: 0, matchups: 0, errors: 0 }
  const errorDetails: string[] = []
  const completedSeasons: number[] = []
  const currentYear = new Date().getFullYear()

  // Helper to update job progress
  async function updateJobProgress(status: string, extraDetails: Record<string, any> = {}) {
    if (!jobRunId) return
    try {
      await supabase
        .from('job_runs')
        .update({
          details: { 
            sport_id, 
            seasons: numSeasons, 
            status,
            completed_seasons: completedSeasons,
            progress: `${completedSeasons.length}/${numSeasons}`,
            counters,
            ...extraDetails
          }
        })
        .eq('id', jobRunId)
    } catch (e) {
      console.error('[BACKFILL] Failed to update progress:', e)
    }
  }

  try {
    for (let i = 0; i < numSeasons; i++) {
      const year = currentYear - i
      console.log(`[BACKFILL] Processing ${sport_id} season ${year} (${i + 1}/${numSeasons})`)
      
      // Update progress at start of each season
      await updateJobProgress('running', { current_season: year })

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
          if (game.status !== 'final' || game.home_score === null || game.away_score === null) {
            continue
          }

          try {
            const homeTeamId = await findOrCreateTeam(
              supabase, sport_id, game.home_team_key, game.home_team_name, game.home_team_city
            )
            const awayTeamId = await findOrCreateTeam(
              supabase, sport_id, game.away_team_key, game.away_team_name, game.away_team_city
            )

            if (!homeTeamId || !awayTeamId) continue

            const finalTotal = (game.home_score || 0) + (game.away_score || 0)

            const { data: existingGame } = await supabase
              .from('games')
              .select('id')
              .eq('sport_id', sport_id)
              .eq('provider_game_key', game.provider_game_key)
              .is('league_id', null)
              .maybeSingle()

            let gameId: string

            if (existingGame) {
              gameId = existingGame.id
              await supabase
                .from('games')
                .update({
                  start_time_utc: game.start_time_utc,
                  home_team_id: homeTeamId,
                  away_team_id: awayTeamId,
                  home_score: game.home_score,
                  away_score: game.away_score,
                  status: 'final',
                  last_seen_at: new Date().toISOString(),
                })
                .eq('id', gameId)
            } else {
              const { data: newGame, error: gameError } = await supabase
                .from('games')
                .insert({
                  sport_id,
                  provider_game_key: game.provider_game_key,
                  start_time_utc: game.start_time_utc,
                  home_team_id: homeTeamId,
                  away_team_id: awayTeamId,
                  home_score: game.home_score,
                  away_score: game.away_score,
                  status: 'final',
                  last_seen_at: new Date().toISOString(),
                })
                .select('id')
                .single()

              if (gameError || !newGame) continue
              gameId = newGame.id
            }

            counters.upserted++

            const [teamLowId, teamHighId] = [homeTeamId, awayTeamId].sort()

            const { data: existingMg } = await supabase
              .from('matchup_games')
              .select('id')
              .eq('sport_id', sport_id)
              .eq('team_low_id', teamLowId)
              .eq('team_high_id', teamHighId)
              .eq('game_id', gameId)
              .is('league_id', null)
              .maybeSingle()

            if (!existingMg) {
              await supabase
                .from('matchup_games')
                .insert({
                  sport_id,
                  team_low_id: teamLowId,
                  team_high_id: teamHighId,
                  game_id: gameId,
                  played_at_utc: game.start_time_utc,
                  total: finalTotal,
                })

              counters.matchups++
            }
          } catch (gameErr) {
            counters.errors++
          }
        }
        
        // Mark season as completed
        completedSeasons.push(year)
        console.log(`[BACKFILL] Completed season ${year} - Progress: ${completedSeasons.length}/${numSeasons}`)
        await updateJobProgress('running')
        
      } catch (seasonError) {
        const msg = `Season ${year}: ${seasonError instanceof Error ? seasonError.message : 'Unknown error'}`
        console.error(`[BACKFILL] Error: ${msg}`)
        errorDetails.push(msg)
        counters.errors++
      }
    }

    // Compute matchup stats
    console.log('[BACKFILL] Computing matchup stats...')
    
    const { data: matchups } = await supabase
      .from('matchup_games')
      .select('sport_id, team_low_id, team_high_id')
      .eq('sport_id', sport_id)
    
    const uniqueMatchups = new Set<string>()
    matchups?.forEach((m: any) => {
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
        .is('league_id', null)

      if (matchupGames && matchupGames.length > 0) {
        const totals = matchupGames.map((mg: any) => Number(mg.total)).sort((a: number, b: number) => a - b)
        const n = totals.length

        const p05Index = Math.max(1, Math.ceil(0.05 * n)) - 1
        const p95Index = Math.max(1, Math.ceil(0.95 * n)) - 1
        const medianIndex = Math.floor(n / 2)

        const { data: existingStats } = await supabase
          .from('matchup_stats')
          .select('id')
          .eq('sport_id', sportId)
          .eq('team_low_id', teamLowId)
          .eq('team_high_id', teamHighId)
          .is('league_id', null)
          .maybeSingle()

        const statsData = {
          n_games: n,
          p05: totals[p05Index],
          p95: totals[p95Index],
          median: n % 2 === 0 ? (totals[medianIndex - 1] + totals[medianIndex]) / 2 : totals[medianIndex],
          min_total: totals[0],
          max_total: totals[n - 1],
          updated_at: new Date().toISOString(),
        }

        if (existingStats) {
          await supabase
            .from('matchup_stats')
            .update(statsData)
            .eq('id', existingStats.id)
        } else {
          await supabase
            .from('matchup_stats')
            .insert({
              sport_id: sportId,
              team_low_id: teamLowId,
              team_high_id: teamHighId,
              ...statsData,
            })
        }
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
  } catch (error) {
    console.error('[BACKFILL] Fatal error in background task:', error)
    
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

    console.log(`[BACKFILL] Initiating ${sport_id}, ${numSeasons} seasons`)

    // Clear team cache
    teamCache.clear()

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ 
        job_name: 'backfill', 
        details: { sport_id, seasons: numSeasons, status: 'running' } 
      })
      .select()
      .single()

    const jobRunId = jobRun?.id || null

    // Run backfill in background using EdgeRuntime.waitUntil
    // @ts-ignore - EdgeRuntime is available in Supabase edge functions
    EdgeRuntime.waitUntil(runBackfill(supabase, sportsDataKey, sport_id, numSeasons, jobRunId))

    // Return immediately
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Backfill started for ${sport_id} (${numSeasons} seasons)`,
        job_id: jobRunId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[BACKFILL] Error:', error)
    
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
// Sport-specific fetch functions follow below

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
    // Use DateTimeUTC which is explicitly UTC, fallback to DateTime if not available
    start_time_utc: game.DateTimeUTC || game.DateTime || game.Day,
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
    // Use DateTimeUTC which is explicitly UTC, fallback to DateTime if not available
    start_time_utc: game.DateTimeUTC || game.DateTime || game.Day,
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
        // Use DateTimeUTC which is explicitly UTC, fallback to DateTime if not available
        start_time_utc: game.DateTimeUTC || game.DateTime || game.Date,
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
    // Use DateTimeUTC which is explicitly UTC, fallback to DateTime if not available
    start_time_utc: game.DateTimeUTC || game.DateTime || game.Day,
    home_team_key: game.HomeTeamID ? String(game.HomeTeamID) : game.HomeTeam,
    away_team_key: game.AwayTeamID ? String(game.AwayTeamID) : game.AwayTeam,
    home_team_name: game.HomeTeam,
    away_team_name: game.AwayTeam,
    home_score: game.HomeTeamScore,
    away_score: game.AwayTeamScore,
    status: game.Status === 'Final' ? 'final' : game.Status === 'InProgress' ? 'live' : 'scheduled',
  }))
}
