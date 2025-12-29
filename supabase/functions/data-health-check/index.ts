import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Franchise mappings for all sports
const FRANCHISE_MAPPINGS: Record<string, Record<string, string>> = {
  nba: {
    "ATL": "Atlanta Hawks", "BOS": "Boston Celtics", "BKN": "Brooklyn Nets", "BRK": "Brooklyn Nets",
    "CHA": "Charlotte Hornets", "CHI": "Chicago Bulls", "CLE": "Cleveland Cavaliers",
    "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets", "DET": "Detroit Pistons",
    "GSW": "Golden State Warriors", "GS": "Golden State Warriors",
    "HOU": "Houston Rockets", "IND": "Indiana Pacers", "LAC": "LA Clippers",
    "LAL": "Los Angeles Lakers", "MEM": "Memphis Grizzlies", "MIA": "Miami Heat",
    "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans", "NO": "New Orleans Pelicans",
    "NYK": "New York Knicks", "NY": "New York Knicks",
    "OKC": "Oklahoma City Thunder", "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers",
    "PHX": "Phoenix Suns", "PHO": "Phoenix Suns", "POR": "Portland Trail Blazers",
    "SAC": "Sacramento Kings", "SAS": "San Antonio Spurs", "SA": "San Antonio Spurs",
    "TOR": "Toronto Raptors", "UTA": "Utah Jazz", "UTAH": "Utah Jazz",
    "WAS": "Washington Wizards", "WSH": "Washington Wizards",
  },
  nfl: {
    "ARI": "Arizona Cardinals", "ATL": "Atlanta Falcons", "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills", "CAR": "Carolina Panthers", "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals", "CLE": "Cleveland Browns", "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos", "DET": "Detroit Lions", "GB": "Green Bay Packers",
    "HOU": "Houston Texans", "IND": "Indianapolis Colts",
    "JAC": "Jacksonville Jaguars", "JAX": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs", "LV": "Las Vegas Raiders", "LAR": "Los Angeles Rams",
    "LAC": "Los Angeles Chargers", "MIA": "Miami Dolphins", "MIN": "Minnesota Vikings",
    "NE": "New England Patriots", "NO": "New Orleans Saints",
    "NYG": "New York Giants", "NYJ": "New York Jets",
    "PHI": "Philadelphia Eagles", "PIT": "Pittsburgh Steelers", "SF": "San Francisco 49ers",
    "SEA": "Seattle Seahawks", "TB": "Tampa Bay Buccaneers", "TEN": "Tennessee Titans",
    "WAS": "Washington Commanders", "WSH": "Washington Commanders",
  },
  nhl: {
    "ANA": "Anaheim Ducks", "ARI": "Arizona Coyotes", "BOS": "Boston Bruins",
    "BUF": "Buffalo Sabres", "CGY": "Calgary Flames", "CAR": "Carolina Hurricanes",
    "CHI": "Chicago Blackhawks", "COL": "Colorado Avalanche", "CBJ": "Columbus Blue Jackets",
    "DAL": "Dallas Stars", "DET": "Detroit Red Wings", "EDM": "Edmonton Oilers",
    "FLA": "Florida Panthers", "LA": "Los Angeles Kings", "LAK": "Los Angeles Kings",
    "MIN": "Minnesota Wild", "MTL": "Montreal Canadiens", "NSH": "Nashville Predators",
    "NJ": "New Jersey Devils", "NJD": "New Jersey Devils", "NYI": "New York Islanders",
    "NYR": "New York Rangers", "OTT": "Ottawa Senators", "PHI": "Philadelphia Flyers",
    "PIT": "Pittsburgh Penguins", "SJ": "San Jose Sharks", "SJS": "San Jose Sharks",
    "SEA": "Seattle Kraken", "STL": "St. Louis Blues", "TB": "Tampa Bay Lightning",
    "TBL": "Tampa Bay Lightning", "TOR": "Toronto Maple Leafs", "UTA": "Utah Hockey Club",
    "VAN": "Vancouver Canucks", "VGK": "Vegas Golden Knights", "WSH": "Washington Capitals",
    "WAS": "Washington Capitals", "WPG": "Winnipeg Jets",
  },
  mlb: {
    "ARI": "Arizona Diamondbacks", "ATL": "Atlanta Braves", "BAL": "Baltimore Orioles",
    "BOS": "Boston Red Sox", "CHC": "Chicago Cubs", "CWS": "Chicago White Sox",
    "CHW": "Chicago White Sox", "CIN": "Cincinnati Reds", "CLE": "Cleveland Guardians",
    "COL": "Colorado Rockies", "DET": "Detroit Tigers", "HOU": "Houston Astros",
    "KC": "Kansas City Royals", "LAA": "Los Angeles Angels", "LAD": "Los Angeles Dodgers",
    "MIA": "Miami Marlins", "MIL": "Milwaukee Brewers", "MIN": "Minnesota Twins",
    "NYM": "New York Mets", "NYY": "New York Yankees", "OAK": "Oakland Athletics",
    "PHI": "Philadelphia Phillies", "PIT": "Pittsburgh Pirates", "SD": "San Diego Padres",
    "SDP": "San Diego Padres", "SF": "San Francisco Giants", "SFG": "San Francisco Giants",
    "SEA": "Seattle Mariners", "STL": "St. Louis Cardinals", "TB": "Tampa Bay Rays",
    "TBR": "Tampa Bay Rays", "TEX": "Texas Rangers", "TOR": "Toronto Blue Jays",
    "WAS": "Washington Nationals", "WSH": "Washington Nationals",
  },
}

interface HealthCheckResult {
  sport: string
  games_checked: number
  home_franchise_fixed: number
  away_franchise_fixed: number
  matchups_fixed: number
  errors: number
}

async function fixFranchiseIds(
  supabase: any,
  sport: string,
  dateStart: string,
  dateEnd: string
): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    sport,
    games_checked: 0,
    home_franchise_fixed: 0,
    away_franchise_fixed: 0,
    matchups_fixed: 0,
    errors: 0,
  }

  // Find games with missing franchise IDs
  const { data: gamesWithMissingFranchises, error: fetchError } = await supabase
    .from("games")
    .select(`
      id,
      sport_id,
      home_team_id,
      away_team_id,
      home_franchise_id,
      away_franchise_id,
      home_team:teams!games_home_team_id_fkey(id, abbrev, name),
      away_team:teams!games_away_team_id_fkey(id, abbrev, name)
    `)
    .eq("sport_id", sport)
    .gte("start_time_utc", `${dateStart}T00:00:00Z`)
    .lte("start_time_utc", `${dateEnd}T23:59:59Z`)
    .or("home_franchise_id.is.null,away_franchise_id.is.null")

  if (fetchError) {
    console.error(`[HEALTH] Error fetching ${sport} games:`, fetchError.message)
    result.errors++
    return result
  }

  if (!gamesWithMissingFranchises || gamesWithMissingFranchises.length === 0) {
    return result
  }

  result.games_checked = gamesWithMissingFranchises.length
  console.log(`[HEALTH] Found ${gamesWithMissingFranchises.length} ${sport} games with missing franchise IDs`)

  // Cache franchise lookups
  const franchiseCache = new Map<string, string>()

  for (const game of gamesWithMissingFranchises) {
    const updates: { home_franchise_id?: string; away_franchise_id?: string } = {}

    // Fix home franchise if missing
    if (!game.home_franchise_id && game.home_team?.abbrev) {
      const abbrev = game.home_team.abbrev
      const cacheKey = `${sport}:${abbrev}`
      
      let franchiseId = franchiseCache.get(cacheKey)
      if (!franchiseId) {
        const mapping = FRANCHISE_MAPPINGS[sport]
        const canonicalName = mapping?.[abbrev]

        if (canonicalName) {
          const { data: franchise } = await supabase
            .from("franchises")
            .select("id")
            .eq("sport_id", sport)
            .eq("canonical_name", canonicalName)
            .maybeSingle()

          if (franchise?.id) {
            franchiseId = franchise.id
            franchiseCache.set(cacheKey, franchise.id)
          }
        }
      }

      if (franchiseId) {
        updates.home_franchise_id = franchiseId
      }
    }

    // Fix away franchise if missing
    if (!game.away_franchise_id && game.away_team?.abbrev) {
      const abbrev = game.away_team.abbrev
      const cacheKey = `${sport}:${abbrev}`
      
      let franchiseId = franchiseCache.get(cacheKey)
      if (!franchiseId) {
        const mapping = FRANCHISE_MAPPINGS[sport]
        const canonicalName = mapping?.[abbrev]

        if (canonicalName) {
          const { data: franchise } = await supabase
            .from("franchises")
            .select("id")
            .eq("sport_id", sport)
            .eq("canonical_name", canonicalName)
            .maybeSingle()

          if (franchise?.id) {
            franchiseId = franchise.id
            franchiseCache.set(cacheKey, franchise.id)
          }
        }
      }

      if (franchiseId) {
        updates.away_franchise_id = franchiseId
      }
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("games")
        .update(updates)
        .eq("id", game.id)

      if (updateError) {
        console.error(`[HEALTH] Error updating game ${game.id}:`, updateError.message)
        result.errors++
        continue
      }

      if (updates.home_franchise_id) result.home_franchise_fixed++
      if (updates.away_franchise_id) result.away_franchise_fixed++

      // Also update matchup_games if it exists
      const newHomeFranchise = updates.home_franchise_id || game.home_franchise_id
      const newAwayFranchise = updates.away_franchise_id || game.away_franchise_id

      if (newHomeFranchise && newAwayFranchise) {
        const [franchiseLowId, franchiseHighId] = [newHomeFranchise, newAwayFranchise].sort()

        const { error: matchupError } = await supabase
          .from("matchup_games")
          .update({
            franchise_low_id: franchiseLowId,
            franchise_high_id: franchiseHighId,
          })
          .eq("game_id", game.id)

        if (!matchupError) {
          result.matchups_fixed++
        }
      }
    }
  }

  if (result.home_franchise_fixed > 0 || result.away_franchise_fixed > 0) {
    console.log(`[HEALTH] Fixed ${sport}: ${result.home_franchise_fixed} home, ${result.away_franchise_fixed} away franchise IDs`)
  }

  return result
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )

  const startTime = Date.now()

  try {
    let requestBody: {
      date?: string
      days_ahead?: number
      days_back?: number
      sports?: string[]
    } = {}

    try {
      requestBody = await req.json()
    } catch {
      // Empty body OK
    }

    // Build date range
    const now = new Date()
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    
    const today = requestBody.date || formatter.format(now)
    const daysAhead = requestBody.days_ahead ?? 7
    const daysBack = requestBody.days_back ?? 1
    const sports = requestBody.sports || ["nba", "nfl", "nhl", "mlb"]

    // Calculate date range
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - daysBack)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + daysAhead)

    const dateStart = startDate.toISOString().split("T")[0]
    const dateEnd = endDate.toISOString().split("T")[0]

    console.log(`[HEALTH] Starting data health check for ${dateStart} to ${dateEnd}`)
    console.log(`[HEALTH] Sports: ${sports.join(", ")}`)

    const results: HealthCheckResult[] = []
    let totalFixed = 0

    // Process each sport
    for (const sport of sports) {
      const result = await fixFranchiseIds(supabase, sport, dateStart, dateEnd)
      results.push(result)
      totalFixed += result.home_franchise_fixed + result.away_franchise_fixed
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    const summary = {
      success: true,
      duration_seconds: Number(duration),
      date_range: { start: dateStart, end: dateEnd },
      total_games_checked: results.reduce((sum, r) => sum + r.games_checked, 0),
      total_franchise_ids_fixed: totalFixed,
      total_matchups_fixed: results.reduce((sum, r) => sum + r.matchups_fixed, 0),
      total_errors: results.reduce((sum, r) => sum + r.errors, 0),
      by_sport: results,
    }

    console.log(`[HEALTH] Complete in ${duration}s: Fixed ${totalFixed} franchise IDs`)

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[HEALTH] Fatal error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
