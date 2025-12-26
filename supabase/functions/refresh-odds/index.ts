import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sport key mappings with confidence thresholds
const SPORT_CONFIGS: Record<string, { oddsKey: string; isSoccer: boolean; confidenceThreshold: number }> = {
  nfl: { oddsKey: 'americanfootball_nfl', isSoccer: false, confidenceThreshold: 0.92 },
  nba: { oddsKey: 'basketball_nba', isSoccer: false, confidenceThreshold: 0.92 },
  mlb: { oddsKey: 'baseball_mlb', isSoccer: false, confidenceThreshold: 0.92 },
  nhl: { oddsKey: 'icehockey_nhl', isSoccer: false, confidenceThreshold: 0.92 },
  soccer: { oddsKey: 'soccer_usa_mls', isSoccer: true, confidenceThreshold: 0.88 },
}

// Soccer tokens to strip
const SOCCER_STRIP_TOKENS = ['fc', 'cf', 'sc', 'afc', 'c.f.', 'f.c.', 's.c.', 'a.f.c.', 'united', 'utd', 'city']

// Normalize team name for comparison
function normalizeTeamName(name: string, isSoccer: boolean = false): string {
  let normalized = name.toLowerCase().trim()
  normalized = normalized.replace(/[^\w\s]/g, ' ')
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  if (isSoccer) {
    for (const token of SOCCER_STRIP_TOKENS) {
      normalized = normalized.replace(new RegExp(`\\b${token}\\b`, 'gi'), '')
    }
    normalized = normalized.replace(/\s+/g, ' ').trim()
  }
  
  return normalized
}

// Calculate similarity between two strings
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  if (!str1 || !str2) return 0
  
  const getTrigrams = (s: string): Set<string> => {
    const trigrams = new Set<string>()
    const padded = `  ${s}  `
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.add(padded.slice(i, i + 3))
    }
    return trigrams
  }
  
  const trigrams1 = getTrigrams(str1)
  const trigrams2 = getTrigrams(str2)
  
  const intersection = new Set([...trigrams1].filter(t => trigrams2.has(t)))
  const union = new Set([...trigrams1, ...trigrams2])
  
  return intersection.size / union.size
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

interface MappingEntry {
  team_id: string
  odds_api_team_name: string
  confidence: number
}

interface GameRow {
  id: string
  sport_id: string
  start_time_utc: string
  home_team_id: string
  away_team_id: string
  home_team: Array<{ name: string }> | null
  away_team: Array<{ name: string }> | null
}

interface OddsEvent {
  id: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers?: Array<{
    key: string
    markets?: Array<{
      key: string
      outcomes?: Array<{ point?: number }>
    }>
  }>
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
    const oddsApiKey = Deno.env.get('ODDS_API_KEY')
    if (!oddsApiKey) {
      throw new Error('ODDS_API_KEY not configured')
    }

    const { sport_id, date } = await req.json()
    const targetDate = date || getTodayET()

    console.log(`Refreshing odds for ${sport_id} on ${targetDate}`)

    const config = SPORT_CONFIGS[sport_id]
    if (!config) {
      throw new Error(`Unknown sport: ${sport_id}`)
    }

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ job_name: 'odds_refresh', details: { sport_id, date: targetDate } })
      .select()
      .single()

    jobRunId = jobRun?.id || null

    // Get all provider mappings for this sport
    const { data: mappings } = await supabase
      .from('provider_mappings')
      .select('team_id, odds_api_team_name, confidence')
      .eq('sport_id', sport_id)

    const mappingsByOddsName = new Map<string, MappingEntry>()
    for (const m of mappings || []) {
      mappingsByOddsName.set(m.odds_api_team_name.toLowerCase(), m as MappingEntry)
    }

    // Fetch odds from The Odds API
    const url = `https://api.the-odds-api.com/v4/sports/${config.oddsKey}/odds/?apiKey=${oddsApiKey}&regions=us&markets=totals&bookmakers=draftkings`
    
    const response = await fetch(url)
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Odds API error:', response.status, errorText)
      throw new Error(`Odds API error: ${response.status}`)
    }

    const oddsData: OddsEvent[] = await response.json()
    console.log(`Found ${oddsData.length} events with odds`)

    // Get games for the target date
    const startOfDay = `${targetDate}T00:00:00Z`
    const endOfDay = `${targetDate}T23:59:59Z`

    const { data: games } = await supabase
      .from('games')
      .select(`
        id,
        sport_id,
        start_time_utc,
        home_team_id,
        away_team_id,
        home_team:teams!games_home_team_id_fkey(name),
        away_team:teams!games_away_team_id_fkey(name)
      `)
      .eq('sport_id', sport_id)
      .gte('start_time_utc', startOfDay)
      .lte('start_time_utc', endOfDay)

    console.log(`Found ${games?.length || 0} games in database for ${targetDate}`)

    let matchedCount = 0
    let unmatchedCount = 0
    const unmatchedReasons: string[] = []

    // For each game, find the best matching odds event
    for (const game of (games || []) as GameRow[]) {
      const gameTime = new Date(game.start_time_utc).getTime()
      const windowMs = 3 * 60 * 60 * 1000 // 3 hours

      // Find candidate events within time window
      const candidates: Array<{ event: OddsEvent; homeScore: number; awayScore: number; combinedScore: number }> = []

      for (const event of oddsData) {
        const eventTime = new Date(event.commence_time).getTime()
        if (Math.abs(eventTime - gameTime) > windowMs) continue

        // Try to match teams using mappings first
        const homeMapping = mappingsByOddsName.get(event.home_team.toLowerCase())
        const awayMapping = mappingsByOddsName.get(event.away_team.toLowerCase())

        let homeScore = 0
        let awayScore = 0

        if (homeMapping && homeMapping.team_id === game.home_team_id) {
          homeScore = homeMapping.confidence
        } else if (homeMapping && homeMapping.team_id === game.away_team_id) {
          // Teams might be swapped
          awayScore = homeMapping.confidence
        } else {
          // Fallback to fuzzy matching
          const homeTeamName = game.home_team?.[0]?.name || ''
          const awayTeamName = game.away_team?.[0]?.name || ''
          
          const homeNorm = normalizeTeamName(homeTeamName, config.isSoccer)
          const awayNorm = normalizeTeamName(awayTeamName, config.isSoccer)
          const eventHomeNorm = normalizeTeamName(event.home_team, config.isSoccer)
          const eventAwayNorm = normalizeTeamName(event.away_team, config.isSoccer)

          homeScore = Math.max(
            calculateSimilarity(homeNorm, eventHomeNorm),
            calculateSimilarity(homeNorm, eventAwayNorm)
          )
          awayScore = Math.max(
            calculateSimilarity(awayNorm, eventHomeNorm),
            calculateSimilarity(awayNorm, eventAwayNorm)
          )
        }

        if (awayMapping && awayMapping.team_id === game.away_team_id) {
          awayScore = Math.max(awayScore, awayMapping.confidence)
        } else if (awayMapping && awayMapping.team_id === game.home_team_id) {
          homeScore = Math.max(homeScore, awayMapping.confidence)
        }

        const combinedScore = (homeScore + awayScore) / 2

        if (homeScore >= config.confidenceThreshold && awayScore >= config.confidenceThreshold) {
          candidates.push({ event, homeScore, awayScore, combinedScore })
        }
      }

      // Check for unique best match
      if (candidates.length === 0) {
        unmatchedCount++
        const homeName = game.home_team?.[0]?.name || game.home_team_id
        const awayName = game.away_team?.[0]?.name || game.away_team_id
        unmatchedReasons.push(`No confident match: ${awayName} @ ${homeName}`)
        continue
      }

      // Sort by combined score
      candidates.sort((a, b) => b.combinedScore - a.combinedScore)

      // Check uniqueness gap
      if (candidates.length > 1) {
        const gap = candidates[0].combinedScore - candidates[1].combinedScore
        if (gap < 0.04) {
          unmatchedCount++
          const homeName = game.home_team?.[0]?.name || game.home_team_id
          const awayName = game.away_team?.[0]?.name || game.away_team_id
          unmatchedReasons.push(`Ambiguous match (gap=${gap.toFixed(3)}): ${awayName} @ ${homeName}`)
          continue
        }
      }

      const bestMatch = candidates[0]
      const event = bestMatch.event

      // Extract DraftKings totals line
      const dkBookmaker = event.bookmakers?.find(b => b.key === 'draftkings')
      const totalsMarket = dkBookmaker?.markets?.find(m => m.key === 'totals')
      const totalLine = totalsMarket?.outcomes?.[0]?.point

      if (totalLine === undefined) {
        unmatchedCount++
        unmatchedReasons.push(`No DK totals line: ${event.away_team} @ ${event.home_team}`)
        continue
      }

      // Store event mapping
      await supabase
        .from('odds_event_map')
        .upsert({
          odds_sport_key: config.oddsKey,
          odds_event_id: event.id,
          game_id: game.id,
          confidence: bestMatch.combinedScore,
          matched_at: new Date().toISOString(),
        }, { onConflict: 'game_id' })

      // Insert odds snapshot
      await supabase.from('odds_snapshots').insert({
        game_id: game.id,
        bookmaker: 'draftkings',
        market: 'totals',
        total_line: totalLine,
        fetched_at: new Date().toISOString(),
        raw_payload: event,
      })

      // Calculate DK line percentile
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
        .eq('game_id', game.id)

      matchedCount++
    }

    // Update job run
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          details: { 
            sport_id, 
            date: targetDate,
            events_found: oddsData.length,
            games_in_db: games?.length || 0,
            matched: matchedCount, 
            unmatched: unmatchedCount,
            unmatched_reasons: unmatchedReasons.slice(0, 20) // Limit to 20 for logging
          }
        })
        .eq('id', jobRunId)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sport_id,
        date: targetDate,
        events_found: oddsData.length,
        games_in_db: games?.length || 0,
        matched: matchedCount,
        unmatched: unmatchedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Odds refresh error:', error)
    
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
