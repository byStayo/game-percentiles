import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sport key mappings
const SPORT_CONFIGS: Record<string, { oddsKey: string; isSoccer: boolean }> = {
  nfl: { oddsKey: 'americanfootball_nfl', isSoccer: false },
  nba: { oddsKey: 'basketball_nba', isSoccer: false },
  mlb: { oddsKey: 'baseball_mlb', isSoccer: false },
  nhl: { oddsKey: 'icehockey_nhl', isSoccer: false },
  soccer: { oddsKey: 'soccer_usa_mls', isSoccer: true },
}

// ============================================================
// HARD-CODED TEAM NAME NORMALIZER
// Deterministic rules only - no fuzzy matching
// ============================================================

// Stop tokens to remove
const STOP_TOKENS = ['fc', 'cf', 'sc', 'afc', 'c.f', 'f.c', 'the', 's.c', 'a.f.c']

// Common abbreviation expansions
const ABBREVIATION_MAP: Record<string, string> = {
  'la': 'los angeles',
  'ny': 'new york',
  'nj': 'new jersey',
  'utd': 'united',
  'st': 'saint',
  'n.j.': 'new jersey',
  'n.y.': 'new york',
  'l.a.': 'los angeles',
}

// Hardcoded alias dictionary for known vendor variants
// Maps normalized form -> canonical form
const ALIAS_DICTIONARY: Record<string, string> = {
  // NBA
  'la clippers': 'los angeles clippers',
  'la lakers': 'los angeles lakers',
  'ny knicks': 'new york knicks',
  'brooklyn': 'brooklyn nets',
  'golden state': 'golden state warriors',
  'okc thunder': 'oklahoma city thunder',
  'okc': 'oklahoma city thunder',
  
  // NFL
  'ny giants': 'new york giants',
  'ny jets': 'new york jets',
  'la rams': 'los angeles rams',
  'la chargers': 'los angeles chargers',
  'washington': 'washington commanders',
  'washington football team': 'washington commanders',
  'las vegas': 'las vegas raiders',
  
  // MLB
  'la dodgers': 'los angeles dodgers',
  'la angels': 'los angeles angels',
  'ny yankees': 'new york yankees',
  'ny mets': 'new york mets',
  'chi cubs': 'chicago cubs',
  'chi white sox': 'chicago white sox',
  
  // NHL
  'la kings': 'los angeles kings',
  'ny rangers': 'new york rangers',
  'ny islanders': 'new york islanders',
  'nj devils': 'new jersey devils',
  'tb lightning': 'tampa bay lightning',
  
  // Soccer
  'paris sg': 'paris saint germain',
  'psg': 'paris saint germain',
  'man united': 'manchester united',
  'man utd': 'manchester united',
  'man city': 'manchester city',
  'inter miami': 'inter miami cf',
  'lafc': 'los angeles football club',
  'la galaxy': 'los angeles galaxy',
  'nycfc': 'new york city fc',
  'ny city': 'new york city fc',
  'nyc fc': 'new york city fc',
  'new york city': 'new york city fc',
  'rbny': 'new york red bulls',
  'ny red bulls': 'new york red bulls',
  'new york rb': 'new york red bulls',
  'atlanta': 'atlanta united',
  'seattle': 'seattle sounders',
  'portland': 'portland timbers',
  'orlando': 'orlando city',
  'dc united': 'dc united',
  'd.c. united': 'dc united',
}

// Remove diacritics from text
function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Normalize team name using hardcoded deterministic rules
function normalizeTeamName(name: string): string {
  let normalized = name.toLowerCase().trim()
  
  // Remove diacritics
  normalized = removeDiacritics(normalized)
  
  // Remove punctuation (but keep spaces)
  normalized = normalized.replace(/[^\w\s]/g, ' ')
  
  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  // Expand abbreviations
  const words = normalized.split(' ')
  const expandedWords = words.map(word => ABBREVIATION_MAP[word] || word)
  normalized = expandedWords.join(' ')
  
  // Re-collapse after expansion
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  // Remove stop tokens
  for (const token of STOP_TOKENS) {
    normalized = normalized.replace(new RegExp(`\\b${token}\\b`, 'gi'), '')
  }
  
  // Final cleanup
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  return normalized
}

// Apply alias dictionary to get canonical form
function getCanonicalName(normalizedName: string): string {
  // Check direct alias
  if (ALIAS_DICTIONARY[normalizedName]) {
    return ALIAS_DICTIONARY[normalizedName]
  }
  
  // Check if it matches any alias value (already canonical)
  const aliasValues = new Set(Object.values(ALIAS_DICTIONARY))
  if (aliasValues.has(normalizedName)) {
    return normalizedName
  }
  
  return normalizedName
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

    console.log(`[STRICT MATCHING] Refreshing odds for ${sport_id} on ${targetDate}`)

    const config = SPORT_CONFIGS[sport_id]
    if (!config) {
      throw new Error(`Unknown sport: ${sport_id}`)
    }

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ job_name: 'odds_refresh', details: { sport_id, date: targetDate, mode: 'strict_hardcoded' } })
      .select()
      .single()

    jobRunId = jobRun?.id || null

    // Fetch odds from The Odds API
    const url = `https://api.the-odds-api.com/v4/sports/${config.oddsKey}/odds/?apiKey=${oddsApiKey}&regions=us&markets=totals&bookmakers=draftkings`
    
    const response = await fetch(url)
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Odds API error:', response.status, errorText)
      throw new Error(`Odds API error: ${response.status}`)
    }

    const oddsData: OddsEvent[] = await response.json()
    console.log(`Found ${oddsData.length} odds events from API`)

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

    // For each game, find strict match
    for (const game of (games || []) as GameRow[]) {
      const gameTime = new Date(game.start_time_utc).getTime()
      const windowMs = 3 * 60 * 60 * 1000 // 3 hours

      const homeTeamName = game.home_team?.[0]?.name || ''
      const awayTeamName = game.away_team?.[0]?.name || ''
      
      if (!homeTeamName || !awayTeamName) {
        unmatchedCount++
        unmatchedReasons.push(`Missing team name: game ${game.id}`)
        continue
      }

      // Normalize internal team names
      const homeNorm = getCanonicalName(normalizeTeamName(homeTeamName))
      const awayNorm = getCanonicalName(normalizeTeamName(awayTeamName))

      console.log(`Game: "${awayTeamName}" @ "${homeTeamName}" -> normalized: "${awayNorm}" @ "${homeNorm}"`)

      // Find candidates within time window with EXACT name match
      const exactMatches: Array<{ event: OddsEvent; timeDiff: number }> = []

      for (const event of oddsData) {
        const eventTime = new Date(event.commence_time).getTime()
        const timeDiff = Math.abs(eventTime - gameTime)
        
        if (timeDiff > windowMs) continue

        // Normalize odds event team names
        const eventHomeNorm = getCanonicalName(normalizeTeamName(event.home_team))
        const eventAwayNorm = getCanonicalName(normalizeTeamName(event.away_team))

        // Check for exact match (allow swapped home/away)
        const normalMatch = (homeNorm === eventHomeNorm && awayNorm === eventAwayNorm)
        const swappedMatch = (homeNorm === eventAwayNorm && awayNorm === eventHomeNorm)

        if (normalMatch || swappedMatch) {
          exactMatches.push({ event, timeDiff })
          console.log(`  EXACT MATCH: "${event.away_team}" @ "${event.home_team}" (timeDiff: ${Math.round(timeDiff / 60000)}min)`)
        }
      }

      // Handle matching results
      if (exactMatches.length === 0) {
        unmatchedCount++
        unmatchedReasons.push(`No exact match: ${awayTeamName} @ ${homeTeamName}`)
        console.log(`  NO MATCH for ${awayTeamName} @ ${homeTeamName}`)
        continue
      }

      // If multiple exact matches, pick closest by time
      exactMatches.sort((a, b) => a.timeDiff - b.timeDiff)
      
      // If tied on time, DO NOT MATCH
      if (exactMatches.length > 1 && exactMatches[0].timeDiff === exactMatches[1].timeDiff) {
        unmatchedCount++
        unmatchedReasons.push(`Tied time match: ${awayTeamName} @ ${homeTeamName}`)
        console.log(`  TIED MATCH (ambiguous) for ${awayTeamName} @ ${homeTeamName}`)
        continue
      }

      const bestMatch = exactMatches[0]
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

      // Store event mapping (deterministic cache)
      await supabase
        .from('odds_event_map')
        .upsert({
          odds_sport_key: config.oddsKey,
          odds_event_id: event.id,
          game_id: game.id,
          confidence: 1.0, // Always 1.0 for strict match
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
      console.log(`  ATTACHED DK line ${totalLine} (percentile: ${dkLinePercentile?.toFixed(1) || 'N/A'})`)
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
            mode: 'strict_hardcoded',
            events_found: oddsData.length,
            games_in_db: games?.length || 0,
            matched: matchedCount, 
            unmatched: unmatchedCount,
            unmatched_reasons: unmatchedReasons.slice(0, 20)
          }
        })
        .eq('id', jobRunId)
    }

    console.log(`[STRICT MATCHING] Complete: ${matchedCount} matched, ${unmatchedCount} unmatched`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        mode: 'strict_hardcoded',
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
