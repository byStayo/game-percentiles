import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================
// HARDCODED TEAM NAME NORMALIZER
// Deterministic rules only - NO fuzzy matching
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

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeTeamName(name: string): string {
  let normalized = name.toLowerCase().trim()
  normalized = removeDiacritics(normalized)
  normalized = normalized.replace(/[^\w\s]/g, ' ')
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  // Expand abbreviations
  const words = normalized.split(' ')
  const expandedWords = words.map(word => ABBREVIATION_MAP[word] || word)
  normalized = expandedWords.join(' ')
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  // Remove stop tokens
  for (const token of STOP_TOKENS) {
    normalized = normalized.replace(new RegExp(`\\b${token}\\b`, 'gi'), '')
  }
  
  return normalized.replace(/\s+/g, ' ').trim()
}

function getCanonicalName(normalizedName: string): string {
  if (ALIAS_DICTIONARY[normalizedName]) {
    return ALIAS_DICTIONARY[normalizedName]
  }
  const aliasValues = new Set(Object.values(ALIAS_DICTIONARY))
  if (aliasValues.has(normalizedName)) {
    return normalizedName
  }
  return normalizedName
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
      await new Promise(r => setTimeout(r, delay))
    }
  }
  
  throw lastError || new Error('Max retries exceeded')
}

// Sport key mappings
const SPORT_CONFIGS: Record<string, { oddsKey: string }> = {
  nfl: { oddsKey: 'americanfootball_nfl' },
  nba: { oddsKey: 'basketball_nba' },
  mlb: { oddsKey: 'baseball_mlb' },
  nhl: { oddsKey: 'icehockey_nhl' },
  soccer: { oddsKey: 'soccer_usa_mls' },
}

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
  home_team: Array<{ name: string; city: string | null }> | null
  away_team: Array<{ name: string; city: string | null }> | null
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
  const counters = { fetched: 0, matched: 0, unmatched: 0, errors: 0 }

  try {
    const oddsApiKey = Deno.env.get('ODDS_API_KEY')
    if (!oddsApiKey) {
      throw new Error('ODDS_API_KEY not configured')
    }

    let requestBody: { sport_id?: string; date?: string } = {}
    try {
      requestBody = await req.json()
    } catch {
      // Empty body is OK
    }
    
    const { sport_id, date } = requestBody
    const targetDate = date || getTodayET()
    const sportsToRefresh = sport_id ? [sport_id] : Object.keys(SPORT_CONFIGS)

    console.log(`[ODDS-REFRESH] Starting for ${sportsToRefresh.join(', ')} on ${targetDate}`)

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ 
        job_name: 'odds_refresh', 
        details: { sports: sportsToRefresh, date: targetDate, mode: 'strict_hardcoded' } 
      })
      .select()
      .single()

    jobRunId = jobRun?.id || null

    const unmatchedPairs: Array<{ internal: string; odds: string[] }> = []

    for (const sportId of sportsToRefresh) {
      const config = SPORT_CONFIGS[sportId]
      if (!config) continue

      try {
        // Fetch odds from The Odds API
        const url = `https://api.the-odds-api.com/v4/sports/${config.oddsKey}/odds/?apiKey=${oddsApiKey}&regions=us&markets=totals&bookmakers=draftkings`
        
        const response = await fetchWithRetry(url, {})
        if (!response.ok) {
          console.error(`[ODDS-REFRESH] Odds API error for ${sportId}:`, response.status)
          counters.errors++
          continue
        }

        const oddsData: OddsEvent[] = await response.json()
        counters.fetched += oddsData.length
        console.log(`[ODDS-REFRESH] Found ${oddsData.length} odds events for ${sportId}`)

        // Get games for target date (ET range -> UTC)
        const startOfDayET = new Date(`${targetDate}T00:00:00-05:00`)
        const endOfDayET = new Date(`${targetDate}T23:59:59-05:00`)

        const { data: games } = await supabase
          .from('games')
          .select(`
            id,
            sport_id,
            start_time_utc,
            home_team_id,
            away_team_id,
            home_team:teams!games_home_team_id_fkey(name, city),
            away_team:teams!games_away_team_id_fkey(name, city)
          `)
          .eq('sport_id', sportId)
          .gte('start_time_utc', startOfDayET.toISOString())
          .lte('start_time_utc', endOfDayET.toISOString())

        console.log(`[ODDS-REFRESH] Found ${games?.length || 0} games for ${sportId} on ${targetDate}`)

        for (const game of (games || []) as GameRow[]) {
          const gameTime = new Date(game.start_time_utc).getTime()
          const windowMs = 3 * 60 * 60 * 1000 // 3 hours

          const homeTeamData = game.home_team?.[0]
          const awayTeamData = game.away_team?.[0]
          
          if (!homeTeamData?.name || !awayTeamData?.name) {
            counters.unmatched++
            continue
          }

          // Build display name: "City Name" if city exists, else just "Name"
          const homeDisplay = homeTeamData.city 
            ? `${homeTeamData.city} ${homeTeamData.name}` 
            : homeTeamData.name
          const awayDisplay = awayTeamData.city 
            ? `${awayTeamData.city} ${awayTeamData.name}` 
            : awayTeamData.name

          // Normalize internal team names
          const homeNorm = getCanonicalName(normalizeTeamName(homeDisplay))
          const awayNorm = getCanonicalName(normalizeTeamName(awayDisplay))

          // Find EXACT matches within time window
          const exactMatches: Array<{ event: OddsEvent; timeDiff: number }> = []

          for (const event of oddsData) {
            const eventTime = new Date(event.commence_time).getTime()
            const timeDiff = Math.abs(eventTime - gameTime)
            
            if (timeDiff > windowMs) continue

            const eventHomeNorm = getCanonicalName(normalizeTeamName(event.home_team))
            const eventAwayNorm = getCanonicalName(normalizeTeamName(event.away_team))

            // Check for exact match (allow swapped home/away)
            const normalMatch = (homeNorm === eventHomeNorm && awayNorm === eventAwayNorm)
            const swappedMatch = (homeNorm === eventAwayNorm && awayNorm === eventHomeNorm)

            if (normalMatch || swappedMatch) {
              exactMatches.push({ event, timeDiff })
            }
          }

          if (exactMatches.length === 0) {
            counters.unmatched++
            if (unmatchedPairs.length < 20) {
              unmatchedPairs.push({
                internal: `${awayDisplay} @ ${homeDisplay}`,
                odds: oddsData.slice(0, 5).map(e => `${e.away_team} @ ${e.home_team}`)
              })
            }
            continue
          }

          // Sort by time difference, pick closest
          exactMatches.sort((a, b) => a.timeDiff - b.timeDiff)
          
          // If tied on time, DO NOT MATCH (ambiguous)
          if (exactMatches.length > 1 && exactMatches[0].timeDiff === exactMatches[1].timeDiff) {
            counters.unmatched++
            continue
          }

          const bestMatch = exactMatches[0]
          const event = bestMatch.event

          // Extract DraftKings totals line
          const dkBookmaker = event.bookmakers?.find(b => b.key === 'draftkings')
          const totalsMarket = dkBookmaker?.markets?.find(m => m.key === 'totals')
          const totalLine = totalsMarket?.outcomes?.[0]?.point

          if (totalLine === undefined) {
            counters.unmatched++
            continue
          }

          // Store event mapping (deterministic cache)
          await supabase
            .from('odds_event_map')
            .upsert({
              odds_sport_key: config.oddsKey,
              odds_event_id: event.id,
              game_id: game.id,
              confidence: 1.0,
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
            .eq('sport_id', sportId)
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

          counters.matched++
        }
      } catch (sportError) {
        console.error(`[ODDS-REFRESH] Error for ${sportId}:`, sportError)
        counters.errors++
      }
    }

    // Update job run
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          details: { 
            date: targetDate,
            mode: 'strict_hardcoded',
            counters,
            sample_unmatched: unmatchedPairs.slice(0, 5)
          }
        })
        .eq('id', jobRunId)
    }

    console.log(`[ODDS-REFRESH] Complete: ${JSON.stringify(counters)}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        mode: 'strict_hardcoded',
        date: targetDate,
        counters
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[ODDS-REFRESH] Fatal error:', error)
    
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
