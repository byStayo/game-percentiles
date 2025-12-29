import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================
// BallDontLie-based odds refresh (replaces The Odds API)
// Maximizes GOAT tier subscription value
// ============================================================

const BDL_ENDPOINTS = {
  nba: "https://api.balldontlie.io/v1",
  nfl: "https://api.balldontlie.io/nfl/v1",
}

// Sport key mappings for fallback to The Odds API (NHL, MLB, Soccer)
const ODDS_API_CONFIGS: Record<string, { oddsKey: string }> = {
  nhl: { oddsKey: 'icehockey_nhl' },
  mlb: { oddsKey: 'baseball_mlb' },
  soccer: { oddsKey: 'soccer_usa_mls' },
}

// Team name normalization for The Odds API matching
const NHL_ABBREV_MAP: Record<string, string> = {
  'ana': 'anaheim ducks', 'ari': 'arizona coyotes', 'bos': 'boston bruins',
  'buf': 'buffalo sabres', 'cgy': 'calgary flames', 'car': 'carolina hurricanes',
  'chi': 'chicago blackhawks', 'col': 'colorado avalanche', 'cbj': 'columbus blue jackets',
  'dal': 'dallas stars', 'det': 'detroit red wings', 'edm': 'edmonton oilers',
  'fla': 'florida panthers', 'la': 'los angeles kings', 'lak': 'los angeles kings',
  'min': 'minnesota wild', 'mon': 'montreal canadiens', 'mtl': 'montreal canadiens',
  'nas': 'nashville predators', 'nsh': 'nashville predators',
  'nj': 'new jersey devils', 'njd': 'new jersey devils',
  'nyi': 'new york islanders', 'nyr': 'new york rangers',
  'ott': 'ottawa senators', 'phi': 'philadelphia flyers', 'pit': 'pittsburgh penguins',
  'sj': 'san jose sharks', 'sjs': 'san jose sharks', 'sea': 'seattle kraken',
  'stl': 'saint louis blues', 'tb': 'tampa bay lightning', 'tbl': 'tampa bay lightning',
  'tor': 'toronto maple leafs', 'uta': 'utah hockey club', 'van': 'vancouver canucks',
  'veg': 'vegas golden knights', 'vgk': 'vegas golden knights',
  'was': 'washington capitals', 'wsh': 'washington capitals', 'wpg': 'winnipeg jets',
}

interface BDLOdds {
  id: number
  game_id: number
  vendor: string
  total_value: string
  total_over_odds: number
  total_under_odds: number
  spread_value?: string
  spread_home_odds?: number
  spread_away_odds?: number
  moneyline_home?: number
  moneyline_away?: number
  updated_at: string
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

function getCurrentSeason(sport: string): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  
  if (sport === "nfl") {
    return month >= 3 ? year : year - 1
  } else if (sport === "nba") {
    return month >= 10 ? year : year - 1
  } else if (sport === "mlb") {
    return month >= 3 ? year : year - 1
  } else if (sport === "nhl") {
    return month >= 10 ? year : year - 1
  }
  return year
}

function getCurrentNFLWeek(): number {
  const now = new Date()
  const seasonStart = new Date(now.getFullYear(), 8, 5)
  if (now < seasonStart) return 1
  const diffDays = Math.floor((now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24))
  return Math.min(Math.floor(diffDays / 7) + 1, 22)
}

async function fetchWithRetry(url: string, headers: Record<string, string>, maxRetries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers })
      if (response.ok) return response
      if (response.status === 429 || response.status >= 500) {
        const delay = 1000 * Math.pow(2, attempt)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      console.error(`[ODDS-REFRESH] API error ${response.status}`)
      return null
    } catch (err) {
      const delay = 1000 * Math.pow(2, attempt)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  return null
}

// Fetch odds from BallDontLie for NBA and NFL (GOAT tier)
async function fetchBDLOdds(
  supabase: any,
  apiKey: string,
  sport: string,
  targetDate: string
): Promise<{ matched: number; errors: number }> {
  const baseUrl = BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS]
  if (!baseUrl) return { matched: 0, errors: 0 }

  const counters = { matched: 0, errors: 0 }
  const season = getCurrentSeason(sport)
  const week = sport === "nfl" ? getCurrentNFLWeek() : null

  // Fetch odds
  let url = `${baseUrl}/odds?season=${season}&per_page=100`
  if (week) url += `&week=${week}`

  const response = await fetchWithRetry(url, { "Authorization": apiKey, "Accept": "application/json" })
  if (!response) return counters

  const data = await response.json()
  const odds: BDLOdds[] = data.data || []

  console.log(`[ODDS-REFRESH] Fetched ${odds.length} ${sport} odds from BallDontLie`)

  // Get games for target date to match
  const startOfDayET = new Date(`${targetDate}T00:00:00-05:00`)
  const endOfDayET = new Date(`${targetDate}T23:59:59-05:00`)

  const { data: games } = await supabase
    .from('games')
    .select('id, provider_game_key')
    .eq('sport_id', sport)
    .gte('start_time_utc', startOfDayET.toISOString())
    .lte('start_time_utc', endOfDayET.toISOString())

  // Map BDL game_id to our DB game_id
  const bdlIdToDbId = new Map<number, string>()
  for (const game of games || []) {
    const match = game.provider_game_key?.match(/bdl-\w+-(\d+)/)
    if (match) {
      bdlIdToDbId.set(parseInt(match[1]), game.id)
    }
  }

  // Group odds by game_id, prefer DraftKings
  const oddsMap = new Map<number, BDLOdds>()
  for (const odd of odds) {
    const existing = oddsMap.get(odd.game_id)
    if (!existing || odd.vendor?.toLowerCase().includes("draft")) {
      oddsMap.set(odd.game_id, odd)
    }
  }

  // Insert odds snapshots
  for (const [bdlGameId, odd] of oddsMap) {
    const dbGameId = bdlIdToDbId.get(bdlGameId)
    if (!dbGameId) continue

    const totalLine = parseFloat(odd.total_value)
    if (isNaN(totalLine)) continue

    // Build alternate lines from spread and moneyline data
    const alternateLines: any[] = []
    if (odd.total_over_odds && odd.total_under_odds) {
      alternateLines.push({
        point: totalLine,
        over_price: odd.total_over_odds,
        under_price: odd.total_under_odds,
      })
    }

    const { error } = await supabase
      .from('odds_snapshots')
      .insert({
        game_id: dbGameId,
        bookmaker: odd.vendor || 'draftkings',
        market: 'totals',
        total_line: totalLine,
        raw_payload: {
          source: 'balldontlie',
          total_over_odds: odd.total_over_odds,
          total_under_odds: odd.total_under_odds,
          spread_value: odd.spread_value,
          spread_home_odds: odd.spread_home_odds,
          spread_away_odds: odd.spread_away_odds,
          moneyline_home: odd.moneyline_home,
          moneyline_away: odd.moneyline_away,
          alternate_lines: alternateLines,
        },
      })

    if (!error) {
      counters.matched++

      // Update daily_edges with odds info
      await supabase
        .from('daily_edges')
        .update({
          dk_offered: true,
          dk_total_line: totalLine,
          alternate_lines: alternateLines,
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', dbGameId)
    } else {
      counters.errors++
    }
  }

  return counters
}

// Fetch odds from The Odds API for NHL, MLB, Soccer (fallback for non-BDL sports)
async function fetchTheOddsAPIData(
  supabase: any,
  apiKey: string,
  sport: string,
  targetDate: string
): Promise<{ matched: number; errors: number }> {
  const config = ODDS_API_CONFIGS[sport]
  if (!config) return { matched: 0, errors: 0 }

  const counters = { matched: 0, errors: 0 }

  const url = `https://api.the-odds-api.com/v4/sports/${config.oddsKey}/odds/?apiKey=${apiKey}&regions=us&markets=totals,alternate_totals&bookmakers=draftkings`

  const response = await fetchWithRetry(url, { "Accept": "application/json" })
  if (!response) return counters

  const oddsData = await response.json()
  console.log(`[ODDS-REFRESH] Fetched ${oddsData.length} ${sport} odds from The Odds API`)

  // Get games for target date
  const startOfDayET = new Date(`${targetDate}T00:00:00-05:00`)
  const endOfDayET = new Date(`${targetDate}T23:59:59-05:00`)

  const { data: games } = await supabase
    .from('games')
    .select('id, sport_id, start_time_utc, home_team_id, away_team_id')
    .eq('sport_id', sport)
    .gte('start_time_utc', startOfDayET.toISOString())
    .lte('start_time_utc', endOfDayET.toISOString())

  if (!games || games.length === 0) return counters

  // Fetch team info for matching
  const teamIds = new Set<string>()
  for (const g of games) {
    teamIds.add(g.home_team_id)
    teamIds.add(g.away_team_id)
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, city, abbrev')
    .in('id', Array.from(teamIds))

  const teamMap = new Map<string, { name: string; city: string | null; abbrev: string | null }>()
  for (const t of teams || []) {
    teamMap.set(t.id, { name: t.name, city: t.city, abbrev: t.abbrev })
  }

  // Match and insert odds
  for (const event of oddsData) {
    // Find matching game by team names
    const matchedGame = games.find((g: any) => {
      const homeTeam = teamMap.get(g.home_team_id)
      const awayTeam = teamMap.get(g.away_team_id)
      if (!homeTeam || !awayTeam) return false

      const homeNorm = normalizeTeamName(homeTeam, sport)
      const awayNorm = normalizeTeamName(awayTeam, sport)
      const oddsHome = event.home_team.toLowerCase()
      const oddsAway = event.away_team.toLowerCase()

      return (oddsHome.includes(homeNorm) || homeNorm.includes(oddsHome)) &&
             (oddsAway.includes(awayNorm) || awayNorm.includes(oddsAway))
    })

    if (!matchedGame) continue

    // Extract DraftKings totals
    const dk = event.bookmakers?.find((b: any) => b.key === 'draftkings')
    if (!dk) continue

    const totalsMarket = dk.markets?.find((m: any) => m.key === 'totals')
    const overOutcome = totalsMarket?.outcomes?.find((o: any) => o.name === 'Over')
    const totalLine = overOutcome?.point

    if (!totalLine) continue

    // Extract alternate lines
    const altMarket = dk.markets?.find((m: any) => m.key === 'alternate_totals')
    const alternateLines = (altMarket?.outcomes || [])
      .filter((o: any) => o.name === 'Over')
      .map((o: any) => ({
        point: o.point,
        over_price: o.price,
        under_price: altMarket.outcomes.find((u: any) => u.name === 'Under' && u.point === o.point)?.price,
      }))
      .filter((l: any) => l.under_price)

    const { error } = await supabase
      .from('odds_snapshots')
      .insert({
        game_id: matchedGame.id,
        bookmaker: 'draftkings',
        market: 'totals',
        total_line: totalLine,
        raw_payload: { source: 'the_odds_api', alternate_lines: alternateLines },
      })

    if (!error) {
      counters.matched++

      await supabase
        .from('daily_edges')
        .update({
          dk_offered: true,
          dk_total_line: totalLine,
          alternate_lines: alternateLines,
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', matchedGame.id)
    } else {
      counters.errors++
    }
  }

  return counters
}

function normalizeTeamName(team: { name: string; city: string | null; abbrev: string | null }, sport: string): string {
  const abbrev = (team.abbrev || '').toLowerCase()
  
  if (sport === 'nhl' && NHL_ABBREV_MAP[abbrev]) {
    return NHL_ABBREV_MAP[abbrev]
  }

  return `${team.city || ''} ${team.name}`.toLowerCase().trim()
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
  const counters = { nba: { matched: 0, errors: 0 }, nfl: { matched: 0, errors: 0 }, nhl: { matched: 0, errors: 0 }, mlb: { matched: 0, errors: 0 } }

  try {
    const bdlApiKey = Deno.env.get('BALLDONTLIE_KEY')
    const oddsApiKey = Deno.env.get('ODDS_API_KEY')

    if (!bdlApiKey) {
      throw new Error('BALLDONTLIE_KEY not configured')
    }

    let requestBody: { sport_id?: string; date?: string } = {}
    try {
      requestBody = await req.json()
    } catch {
      // Empty body OK
    }

    const targetDate = requestBody.date || getTodayET()
    const specificSport = requestBody.sport_id

    console.log(`[ODDS-REFRESH] Starting for ${specificSport || 'all sports'} on ${targetDate}`)

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({
        job_name: 'odds_refresh',
        details: { date: targetDate, sport: specificSport },
      })
      .select()
      .single()

    jobRunId = jobRun?.id || null

    // Process NBA and NFL via BallDontLie (maximizing paid API)
    const bdlSports = ['nba', 'nfl']
    for (const sport of bdlSports) {
      if (specificSport && specificSport !== sport) continue

      console.log(`[ODDS-REFRESH] Fetching ${sport} odds from BallDontLie`)
      const result = await fetchBDLOdds(supabase, bdlApiKey, sport, targetDate)
      counters[sport as keyof typeof counters] = result
    }

    // Process NHL and MLB via The Odds API if key is configured (fallback)
    if (oddsApiKey) {
      const oddsApiSports = ['nhl', 'mlb']
      for (const sport of oddsApiSports) {
        if (specificSport && specificSport !== sport) continue

        console.log(`[ODDS-REFRESH] Fetching ${sport} odds from The Odds API`)
        const result = await fetchTheOddsAPIData(supabase, oddsApiKey, sport, targetDate)
        counters[sport as keyof typeof counters] = result
      }
    }

    const totalMatched = Object.values(counters).reduce((sum, c) => sum + c.matched, 0)
    const totalErrors = Object.values(counters).reduce((sum, c) => sum + c.errors, 0)

    // Update job run
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          details: { date: targetDate, counters, total_matched: totalMatched, total_errors: totalErrors },
        })
        .eq('id', jobRunId)
    }

    console.log(`[ODDS-REFRESH] Complete: ${totalMatched} matched, ${totalErrors} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        matched: totalMatched,
        errors: totalErrors,
        counters,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[ODDS-REFRESH] Fatal error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          status: 'error',
          finished_at: new Date().toISOString(),
          details: { error: message },
        })
        .eq('id', jobRunId)
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
