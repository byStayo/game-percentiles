import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GameData {
  provider_game_key: string
  start_time_utc: string
  home_team_key: string
  away_team_key: string
  home_team_name: string
  away_team_name: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'final'
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let jobRunId: number | null = null

  try {
    const sportsDataKey = Deno.env.get('SPORTSDATAIO_KEY')
    if (!sportsDataKey) {
      throw new Error('SPORTSDATAIO_KEY not configured')
    }

    const { sport_id, date } = await req.json()
    // Use provided date or default to today in ET
    const targetDate = date || getTodayET()

    console.log(`Ingesting games for ${sport_id} on ${targetDate}`)

    // Create job run
    const { data: jobRun, error: jobError } = await supabase
      .from('job_runs')
      .insert({ job_name: 'ingest', details: { sport_id, date: targetDate } })
      .select()
      .single()

    if (jobError) {
      console.error('Failed to create job run:', jobError)
    }
    
    jobRunId = jobRun?.id || null

    let games: GameData[] = []

    // Fetch games based on sport
    try {
      if (sport_id === 'nba') {
        games = await fetchNBAGames(sportsDataKey, targetDate)
      } else if (sport_id === 'mlb') {
        games = await fetchMLBGames(sportsDataKey, targetDate)
      } else if (sport_id === 'nfl') {
        games = await fetchNFLGames(sportsDataKey)
      } else if (sport_id === 'nhl') {
        games = await fetchNHLGames(sportsDataKey, targetDate)
      }
    } catch (fetchError) {
      console.error(`Error fetching ${sport_id} games:`, fetchError)
      games = []
    }

    console.log(`Found ${games.length} games for ${sport_id}`)

    let insertedCount = 0
    let updatedCount = 0

    for (const game of games) {
      // Upsert home team
      const { data: homeTeam } = await supabase
        .from('teams')
        .upsert({
          sport_id,
          provider_team_key: game.home_team_key,
          name: game.home_team_name,
        }, { onConflict: 'sport_id,league_id,provider_team_key' })
        .select()
        .single()

      // Upsert away team
      const { data: awayTeam } = await supabase
        .from('teams')
        .upsert({
          sport_id,
          provider_team_key: game.away_team_key,
          name: game.away_team_name,
        }, { onConflict: 'sport_id,league_id,provider_team_key' })
        .select()
        .single()

      if (!homeTeam || !awayTeam) {
        console.error('Failed to upsert teams for game:', game.provider_game_key)
        continue
      }

      // Upsert game
      const { data: existingGame } = await supabase
        .from('games')
        .select('id')
        .eq('sport_id', sport_id)
        .eq('provider_game_key', game.provider_game_key)
        .maybeSingle()

      const { error: gameError } = await supabase
        .from('games')
        .upsert({
          sport_id,
          provider_game_key: game.provider_game_key,
          start_time_utc: game.start_time_utc,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          home_score: game.home_score,
          away_score: game.away_score,
          status: game.status,
          last_seen_at: new Date().toISOString(),
        }, { onConflict: 'sport_id,league_id,provider_game_key' })

      if (gameError) {
        console.error('Failed to upsert game:', gameError)
        continue
      }

      if (existingGame) {
        updatedCount++
      } else {
        insertedCount++
      }
    }

    // Update job run as success
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          details: { sport_id, date: targetDate, games_found: games.length, inserted: insertedCount, updated: updatedCount }
        })
        .eq('id', jobRunId)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sport_id,
        date: targetDate,
        games_found: games.length,
        inserted: insertedCount,
        updated: updatedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Ingest error:', error)
    
    // Mark job as failed
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'fail',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
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

async function fetchNBAGames(apiKey: string, date: string): Promise<GameData[]> {
  const formattedDate = date.replace(/-/g, '')
  const url = `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${formattedDate}`
  
  const response = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    console.error('NBA API error:', response.status, await response.text())
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

async function fetchMLBGames(apiKey: string, date: string): Promise<GameData[]> {
  const formattedDate = date.replace(/-/g, '')
  const url = `https://api.sportsdata.io/v3/mlb/scores/json/GamesByDate/${formattedDate}`
  
  const response = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    console.error('MLB API error:', response.status, await response.text())
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

async function fetchNFLGames(apiKey: string): Promise<GameData[]> {
  // Get current week
  const weekUrl = `https://api.sportsdata.io/v3/nfl/scores/json/CurrentWeek`
  const weekResponse = await fetch(weekUrl, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!weekResponse.ok) {
    console.error('NFL week API error:', weekResponse.status)
    return []
  }

  const currentWeek = await weekResponse.json()
  
  // Get current season (estimate based on current date)
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  const season = `${year}REG`

  const url = `https://api.sportsdata.io/v3/nfl/scores/json/ScoresByWeek/${season}/${currentWeek}`
  
  const response = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    console.error('NFL API error:', response.status, await response.text())
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
    status: game.Status === 'Final' ? 'final' : game.Status === 'InProgress' ? 'live' : 'scheduled',
  }))
}

async function fetchNHLGames(apiKey: string, date: string): Promise<GameData[]> {
  const formattedDate = date.replace(/-/g, '')
  const url = `https://api.sportsdata.io/v3/nhl/scores/json/GamesByDate/${formattedDate}`
  
  const response = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    console.error('NHL API error:', response.status, await response.text())
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
