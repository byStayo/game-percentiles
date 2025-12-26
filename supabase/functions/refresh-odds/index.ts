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

// NFL team abbreviation to full name mapping (from SportsData.io)
const NFL_ABBREV_MAP: Record<string, string> = {
  'ari': 'arizona cardinals',
  'atl': 'atlanta falcons',
  'bal': 'baltimore ravens',
  'buf': 'buffalo bills',
  'car': 'carolina panthers',
  'chi': 'chicago bears',
  'cin': 'cincinnati bengals',
  'cle': 'cleveland browns',
  'dal': 'dallas cowboys',
  'den': 'denver broncos',
  'det': 'detroit lions',
  'gb': 'green bay packers',
  'hou': 'houston texans',
  'ind': 'indianapolis colts',
  'jax': 'jacksonville jaguars',
  'kc': 'kansas city chiefs',
  'lv': 'las vegas raiders',
  'lac': 'los angeles chargers',
  'lar': 'los angeles rams',
  'mia': 'miami dolphins',
  'min': 'minnesota vikings',
  'ne': 'new england patriots',
  'no': 'new orleans saints',
  'nyg': 'new york giants',
  'nyj': 'new york jets',
  'phi': 'philadelphia eagles',
  'pit': 'pittsburgh steelers',
  'sf': 'san francisco 49ers',
  'sea': 'seattle seahawks',
  'tb': 'tampa bay buccaneers',
  'ten': 'tennessee titans',
  'was': 'washington commanders',
}

// NBA team abbreviation mapping
const NBA_ABBREV_MAP: Record<string, string> = {
  'atl': 'atlanta hawks',
  'bos': 'boston celtics',
  'bkn': 'brooklyn nets',
  'cha': 'charlotte hornets',
  'chi': 'chicago bulls',
  'cle': 'cleveland cavaliers',
  'dal': 'dallas mavericks',
  'den': 'denver nuggets',
  'det': 'detroit pistons',
  'gs': 'golden state warriors',
  'gsw': 'golden state warriors',
  'hou': 'houston rockets',
  'ind': 'indiana pacers',
  'lac': 'los angeles clippers',
  'lal': 'los angeles lakers',
  'mem': 'memphis grizzlies',
  'mia': 'miami heat',
  'mil': 'milwaukee bucks',
  'min': 'minnesota timberwolves',
  'no': 'new orleans pelicans',
  'nop': 'new orleans pelicans',
  'ny': 'new york knicks',
  'nyk': 'new york knicks',
  'okc': 'oklahoma city thunder',
  'orl': 'orlando magic',
  'phi': 'philadelphia 76ers',
  'phx': 'phoenix suns',
  'por': 'portland trail blazers',
  'sac': 'sacramento kings',
  'sa': 'san antonio spurs',
  'sas': 'san antonio spurs',
  'tor': 'toronto raptors',
  'uta': 'utah jazz',
  'was': 'washington wizards',
}

// NHL team abbreviation mapping
const NHL_ABBREV_MAP: Record<string, string> = {
  'ana': 'anaheim ducks',
  'ari': 'arizona coyotes',
  'bos': 'boston bruins',
  'buf': 'buffalo sabres',
  'cgy': 'calgary flames',
  'car': 'carolina hurricanes',
  'chi': 'chicago blackhawks',
  'col': 'colorado avalanche',
  'cbj': 'columbus blue jackets',
  'dal': 'dallas stars',
  'det': 'detroit red wings',
  'edm': 'edmonton oilers',
  'fla': 'florida panthers',
  'la': 'los angeles kings',
  'lak': 'los angeles kings',
  'min': 'minnesota wild',
  'mtl': 'montreal canadiens',
  'nsh': 'nashville predators',
  'nj': 'new jersey devils',
  'njd': 'new jersey devils',
  'nyi': 'new york islanders',
  'nyr': 'new york rangers',
  'ott': 'ottawa senators',
  'phi': 'philadelphia flyers',
  'pit': 'pittsburgh penguins',
  'sj': 'san jose sharks',
  'sjs': 'san jose sharks',
  'sea': 'seattle kraken',
  'stl': 'st louis blues',
  'tb': 'tampa bay lightning',
  'tbl': 'tampa bay lightning',
  'tor': 'toronto maple leafs',
  'uta': 'utah hockey club',
  'van': 'vancouver canucks',
  'vgk': 'vegas golden knights',
  'wsh': 'washington capitals',
  'wpg': 'winnipeg jets',
}

// MLB team abbreviation mapping
const MLB_ABBREV_MAP: Record<string, string> = {
  'ari': 'arizona diamondbacks',
  'atl': 'atlanta braves',
  'bal': 'baltimore orioles',
  'bos': 'boston red sox',
  'chc': 'chicago cubs',
  'cws': 'chicago white sox',
  'cin': 'cincinnati reds',
  'cle': 'cleveland guardians',
  'col': 'colorado rockies',
  'det': 'detroit tigers',
  'hou': 'houston astros',
  'kc': 'kansas city royals',
  'la': 'los angeles angels',
  'laa': 'los angeles angels',
  'lad': 'los angeles dodgers',
  'mia': 'miami marlins',
  'mil': 'milwaukee brewers',
  'min': 'minnesota twins',
  'nym': 'new york mets',
  'nyy': 'new york yankees',
  'oak': 'oakland athletics',
  'phi': 'philadelphia phillies',
  'pit': 'pittsburgh pirates',
  'sd': 'san diego padres',
  'sf': 'san francisco giants',
  'sea': 'seattle mariners',
  'stl': 'st louis cardinals',
  'tb': 'tampa bay rays',
  'tex': 'texas rangers',
  'tor': 'toronto blue jays',
  'wsh': 'washington nationals',
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

function normalizeTeamName(name: string, sportId?: string): string {
  let normalized = name.toLowerCase().trim()
  normalized = removeDiacritics(normalized)
  normalized = normalized.replace(/[^\w\s]/g, ' ')
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  // Check if this is a sport abbreviation first (single word, all letters)
  if (sportId && !normalized.includes(' ')) {
    const abbrevMaps: Record<string, Record<string, string>> = {
      nfl: NFL_ABBREV_MAP,
      nba: NBA_ABBREV_MAP,
      nhl: NHL_ABBREV_MAP,
      mlb: MLB_ABBREV_MAP,
    }
    const sportMap = abbrevMaps[sportId]
    if (sportMap && sportMap[normalized]) {
      return sportMap[normalized]
    }
  }
  
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
  home_team?: { name: string; city: string | null } | null
  away_team?: { name: string; city: string | null } | null
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

    const unmatchedPairs: Array<{ internal: string; internal_normalized?: string; odds: any[] }> = []

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

        // Fetch games for target date
        const { data: gamesRaw } = await supabase
          .from('games')
          .select('id, sport_id, start_time_utc, home_team_id, away_team_id')
          .eq('sport_id', sportId)
          .gte('start_time_utc', startOfDayET.toISOString())
          .lte('start_time_utc', endOfDayET.toISOString())

        console.log(`[ODDS-REFRESH] Found ${gamesRaw?.length || 0} games for ${sportId} on ${targetDate}`)
        
        if (!gamesRaw || gamesRaw.length === 0) continue

        // Fetch all team data for these games
        const teamIds = new Set<string>()
        for (const g of gamesRaw) {
          teamIds.add(g.home_team_id)
          teamIds.add(g.away_team_id)
        }
        
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, name, city')
          .in('id', Array.from(teamIds))
        
        const teamsMap = new Map((teamsData || []).map(t => [t.id, t]))
        console.log(`[ODDS-REFRESH] Loaded ${teamsMap.size} teams`)
        
        // Build games array with team data
        const games = gamesRaw.map(g => ({
          ...g,
          home_team: teamsMap.get(g.home_team_id),
          away_team: teamsMap.get(g.away_team_id)
        }))

        for (const game of (games || []) as GameRow[]) {
          const gameTime = new Date(game.start_time_utc).getTime()
          const windowMs = 8 * 60 * 60 * 1000 // 8 hours to accommodate timezone/schedule differences

          const homeTeamData = game.home_team
          const awayTeamData = game.away_team
          
          console.log(`[ODDS-DEBUG] Game ${game.id}: home_team_raw=${JSON.stringify(homeTeamData)}, away_team_raw=${JSON.stringify(awayTeamData)}`)
          
          if (!homeTeamData?.name || !awayTeamData?.name) {
            console.log(`[ODDS-DEBUG] Skipping game - missing team data`)
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

          // Normalize internal team names (pass sportId to resolve abbreviations)
          const homeNorm = getCanonicalName(normalizeTeamName(homeDisplay, sportId))
          const awayNorm = getCanonicalName(normalizeTeamName(awayDisplay, sportId))

          console.log(`[ODDS-DEBUG] Internal: "${homeDisplay}" -> "${homeNorm}" vs "${awayDisplay}" -> "${awayNorm}"`)
          
          // Log sample odds events for comparison (only for first game)
          if (counters.matched + counters.unmatched === 0) {
            const sampleOdds = oddsData.slice(0, 3).map(e => ({
              raw: `${e.home_team} vs ${e.away_team}`,
              norm: `${getCanonicalName(normalizeTeamName(e.home_team))} vs ${getCanonicalName(normalizeTeamName(e.away_team))}`
            }))
            console.log(`[ODDS-DEBUG] Sample odds: ${JSON.stringify(sampleOdds)}`)
          }

          // Find EXACT matches within time window
          const exactMatches: Array<{ event: OddsEvent; timeDiff: number }> = []

          for (const event of oddsData) {
            const eventTime = new Date(event.commence_time).getTime()
            const timeDiff = Math.abs(eventTime - gameTime)
            
            if (timeDiff > windowMs) continue

            const eventHomeNorm = getCanonicalName(normalizeTeamName(event.home_team))
            const eventAwayNorm = getCanonicalName(normalizeTeamName(event.away_team))

            // Debug log for potential matches
            if (counters.matched + counters.unmatched < 3) {
              console.log(`[ODDS-DEBUG] Odds: ${event.home_team} (${eventHomeNorm}) vs ${event.away_team} (${eventAwayNorm}) | timeDiff: ${(timeDiff / 60000).toFixed(0)}min`)
            }

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
              // Find closest odds event by time for debugging
              const closestByTime = oddsData
                .map(e => ({ event: e, timeDiff: Math.abs(new Date(e.commence_time).getTime() - gameTime) }))
                .sort((a, b) => a.timeDiff - b.timeDiff)
                .slice(0, 3)
              
              unmatchedPairs.push({
                internal: `${awayDisplay} @ ${homeDisplay}`,
                internal_normalized: `${awayNorm} @ ${homeNorm}`,
                odds: closestByTime.map(e => ({
                  raw: `${e.event.away_team} @ ${e.event.home_team}`,
                  normalized: `${getCanonicalName(normalizeTeamName(e.event.away_team))} @ ${getCanonicalName(normalizeTeamName(e.event.home_team))}`,
                  time_diff_hrs: (e.timeDiff / (1000 * 60 * 60)).toFixed(1)
                }))
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

          // Store event mapping (deterministic cache) - find or update
          const { data: existingMap } = await supabase
            .from('odds_event_map')
            .select('id')
            .eq('game_id', game.id)
            .maybeSingle()

          if (existingMap) {
            await supabase
              .from('odds_event_map')
              .update({
                odds_sport_key: config.oddsKey,
                odds_event_id: event.id,
                confidence: 1.0,
                matched_at: new Date().toISOString(),
              })
              .eq('id', existingMap.id)
          } else {
            await supabase
              .from('odds_event_map')
              .insert({
                odds_sport_key: config.oddsKey,
                odds_event_id: event.id,
                game_id: game.id,
                confidence: 1.0,
                matched_at: new Date().toISOString(),
              })
          }

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
            .is('league_id', null)

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
            sample_unmatched: unmatchedPairs.slice(0, 10)
          }
        })
        .eq('id', jobRunId)
      
      console.log(`[ODDS-REFRESH] Unmatched pairs: ${JSON.stringify(unmatchedPairs.slice(0, 3))}`)
    }

    console.log(`[ODDS-REFRESH] Complete: ${JSON.stringify(counters)}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        mode: 'strict_hardcoded',
        date: targetDate,
        counters,
        sample_unmatched: unmatchedPairs.slice(0, 5)
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
