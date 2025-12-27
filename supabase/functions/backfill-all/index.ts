import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Simple hash function for params
function hashParams(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ESPN API URLs by sport
const ESPN_API_URLS: Record<string, string> = {
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  nhl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
};

// Franchise mappings - canonical names for team continuity across rebrands/relocations
const FRANCHISE_MAPPINGS: Record<string, Record<string, string>> = {
  nba: {
    // Current teams
    "ATL": "Atlanta Hawks", "BOS": "Boston Celtics", "BKN": "Brooklyn Nets", 
    "CHA": "Charlotte Hornets", "CHI": "Chicago Bulls", "CLE": "Cleveland Cavaliers",
    "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets", "DET": "Detroit Pistons",
    "GSW": "Golden State Warriors", "GS": "Golden State Warriors",
    "HOU": "Houston Rockets", "IND": "Indiana Pacers", "LAC": "LA Clippers",
    "LAL": "Los Angeles Lakers", "MEM": "Memphis Grizzlies", "MIA": "Miami Heat",
    "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans", "NO": "New Orleans Pelicans",
    "NYK": "New York Knicks", "NY": "New York Knicks",
    "OKC": "Oklahoma City Thunder", "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers",
    "PHX": "Phoenix Suns", "POR": "Portland Trail Blazers",
    "SAC": "Sacramento Kings", "SAS": "San Antonio Spurs", "SA": "San Antonio Spurs",
    "TOR": "Toronto Raptors", "UTA": "Utah Jazz", "UTAH": "Utah Jazz",
    "WAS": "Washington Wizards", "WSH": "Washington Wizards",
    // Historical
    "NJN": "Brooklyn Nets", "SEA": "Oklahoma City Thunder", "VAN": "Memphis Grizzlies",
    "NOH": "New Orleans Pelicans", "NOK": "New Orleans Pelicans",
    "CHA_OLD": "Charlotte Hornets", "CHH": "Charlotte Hornets",
  },
  nfl: {
    "ARI": "Arizona Cardinals", "ATL": "Atlanta Falcons", "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills", "CAR": "Carolina Panthers", "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals", "CLE": "Cleveland Browns", "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos", "DET": "Detroit Lions", "GB": "Green Bay Packers",
    "HOU": "Houston Texans", "IND": "Indianapolis Colts", "JAC": "Jacksonville Jaguars",
    "JAX": "Jacksonville Jaguars", "KC": "Kansas City Chiefs",
    "LV": "Las Vegas Raiders", "LAC": "Los Angeles Chargers", "LAR": "Los Angeles Rams",
    "MIA": "Miami Dolphins", "MIN": "Minnesota Vikings", "NE": "New England Patriots",
    "NO": "New Orleans Saints", "NYG": "New York Giants", "NYJ": "New York Jets",
    "PHI": "Philadelphia Eagles", "PIT": "Pittsburgh Steelers", "SF": "San Francisco 49ers",
    "SEA": "Seattle Seahawks", "TB": "Tampa Bay Buccaneers", "TEN": "Tennessee Titans",
    "WAS": "Washington Commanders", "WSH": "Washington Commanders",
    // Historical
    "OAK": "Las Vegas Raiders", "SD": "Los Angeles Chargers", "STL": "Los Angeles Rams",
  },
  nhl: {
    "ANA": "Anaheim Ducks", "ARI": "Arizona Coyotes", "BOS": "Boston Bruins",
    "BUF": "Buffalo Sabres", "CGY": "Calgary Flames", "CAR": "Carolina Hurricanes",
    "CHI": "Chicago Blackhawks", "COL": "Colorado Avalanche", "CBJ": "Columbus Blue Jackets",
    "DAL": "Dallas Stars", "DET": "Detroit Red Wings", "EDM": "Edmonton Oilers",
    "FLA": "Florida Panthers", "LA": "Los Angeles Kings", "MIN": "Minnesota Wild",
    "MTL": "Montreal Canadiens", "NSH": "Nashville Predators", "NJ": "New Jersey Devils",
    "NYI": "New York Islanders", "NYR": "New York Rangers", "OTT": "Ottawa Senators",
    "PHI": "Philadelphia Flyers", "PIT": "Pittsburgh Penguins", "SJ": "San Jose Sharks",
    "SEA": "Seattle Kraken", "STL": "St. Louis Blues", "TB": "Tampa Bay Lightning",
    "TOR": "Toronto Maple Leafs", "VAN": "Vancouver Canucks", "VGK": "Vegas Golden Knights",
    "WPG": "Winnipeg Jets", "WSH": "Washington Capitals",
    // Historical
    "PHX": "Arizona Coyotes", "ATL": "Winnipeg Jets", "UTAH": "Utah Hockey Club",
    "HFD": "Carolina Hurricanes", "QUE": "Colorado Avalanche",
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
    "SF": "San Francisco Giants", "SEA": "Seattle Mariners", "STL": "St. Louis Cardinals",
    "TB": "Tampa Bay Rays", "TEX": "Texas Rangers", "TOR": "Toronto Blue Jays",
    "WAS": "Washington Nationals", "WSH": "Washington Nationals",
    // Historical
    "FLA": "Miami Marlins", "MON": "Washington Nationals", "ANA": "Los Angeles Angels",
    "CAL": "Los Angeles Angels", "TBD": "Tampa Bay Rays",
  },
};

// ESPN abbreviation normalization
const ESPN_ABBREV_MAP: Record<string, Record<string, string>> = {
  nba: { "GS": "GSW", "NY": "NYK", "NO": "NOP", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS" },
  nfl: { "JAX": "JAC", "WSH": "WAS" },
  nhl: { "LA": "LAK", "UTAH": "UTA", "WSH": "WAS" },
  mlb: { "CHW": "CWS", "WSH": "WAS" },
};

// Season date ranges - extended to 6+ years (2019-2025) for more accurate percentile calculations
// More historical data improves percentile accuracy for rare matchups
const SPORT_SEASONS: Record<string, { year: number; start: string; end: string }[]> = {
  nba: [
    { year: 2025, start: "2024-10-22", end: "2025-06-30" },
    { year: 2024, start: "2023-10-24", end: "2024-06-18" },
    { year: 2023, start: "2022-10-18", end: "2023-06-13" },
    { year: 2022, start: "2021-10-19", end: "2022-06-17" },
    { year: 2021, start: "2020-12-22", end: "2021-07-20" }, // COVID shortened
    { year: 2020, start: "2019-10-22", end: "2020-10-11" }, // Bubble
    { year: 2019, start: "2018-10-16", end: "2019-06-14" },
  ],
  
  nfl: [
    { year: 2025, start: "2025-09-04", end: "2026-02-15" }, // Future season
    { year: 2024, start: "2024-09-05", end: "2025-02-10" },
    { year: 2023, start: "2023-09-07", end: "2024-02-12" },
    { year: 2022, start: "2022-09-08", end: "2023-02-13" },
    { year: 2021, start: "2021-09-09", end: "2022-02-14" },
    { year: 2020, start: "2020-09-10", end: "2021-02-08" },
    { year: 2019, start: "2019-09-05", end: "2020-02-03" },
  ],
  
  nhl: [
    { year: 2025, start: "2024-10-04", end: "2025-06-30" },
    { year: 2024, start: "2023-10-10", end: "2024-06-25" },
    { year: 2023, start: "2022-10-07", end: "2023-06-14" },
    { year: 2022, start: "2021-10-12", end: "2022-06-27" },
    { year: 2021, start: "2021-01-13", end: "2021-07-08" }, // COVID shortened
    { year: 2020, start: "2019-10-02", end: "2020-09-28" }, // Bubble
    { year: 2019, start: "2018-10-03", end: "2019-06-13" },
  ],
  
  mlb: [
    { year: 2025, start: "2025-03-20", end: "2025-11-05" },
    { year: 2024, start: "2024-03-20", end: "2024-11-03" },
    { year: 2023, start: "2023-03-30", end: "2023-11-02" },
    { year: 2022, start: "2022-04-07", end: "2022-11-06" },
    { year: 2021, start: "2021-04-01", end: "2021-11-03" },
    { year: 2020, start: "2020-07-23", end: "2020-10-28" }, // COVID 60-game
    { year: 2019, start: "2019-03-20", end: "2019-10-31" },
  ],
};

interface ESPNEvent {
  id: string;
  date: string;
  status: { type: { completed: boolean } };
  season?: { year: number; type: number }; // type 2 = regular, 3 = playoff
  competitions: Array<{
    competitors: Array<{
      team: { abbreviation: string; displayName: string };
      score: string;
      homeAway: "home" | "away";
    }>;
  }>;
}

interface ParsedGame {
  espnId: string;
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
  startTimeUtc: string;
  seasonYear: number;
  isPlayoff: boolean;
}

function computeDecade(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}


// Retry helper with exponential backoff
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers: { "Accept": "application/json" } });
      if (response.ok) return response;
      if (response.status === 429 || response.status >= 500) {
        const delay = Math.pow(2, attempt) * 500;
        console.log(`[BACKFILL] Retry ${attempt + 1}/${maxRetries} after ${delay}ms (status: ${response.status})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return null; // Client error, don't retry
    } catch (err) {
      const delay = Math.pow(2, attempt) * 500;
      console.log(`[BACKFILL] Network error, retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return null;
}

async function fetchESPNGamesForDate(
  supabase: any,
  sport: string, 
  dateStr: string,
  seasonYear: number,
  storeRaw: boolean
): Promise<ParsedGame[]> {
  const baseUrl = ESPN_API_URLS[sport];
  if (!baseUrl) return [];

  const espnDate = dateStr.replace(/-/g, "");
  const url = `${baseUrl}?dates=${espnDate}`;

  try {
    const response = await fetchWithRetry(url);
    if (!response) return [];

    const data = await response.json();
    
    // Store raw payload if requested
    if (storeRaw && data.events?.length > 0) {
      const params = { dates: espnDate };
      await supabase.from("provider_raw").insert({
        provider: "espn",
        endpoint: `${sport}/scoreboard`,
        params_hash: hashParams(params),
        sport_id: sport,
        season_year: seasonYear,
        payload_json: data,
      }).onConflict("provider,endpoint,params_hash,fetched_at").ignore();
    }

    const games: ParsedGame[] = [];
    const abbrevMap = ESPN_ABBREV_MAP[sport] || {};

    for (const event of (data.events || []) as ESPNEvent[]) {
      const competition = event.competitions?.[0];
      if (!competition || !event.status?.type?.completed) continue;

      const homeTeam = competition.competitors.find((c) => c.homeAway === "home");
      const awayTeam = competition.competitors.find((c) => c.homeAway === "away");
      if (!homeTeam || !awayTeam) continue;

      const homeScore = parseInt(homeTeam.score, 10);
      const awayScore = parseInt(awayTeam.score, 10);
      if (isNaN(homeScore) || isNaN(awayScore)) continue;

      const rawHomeAbbrev = homeTeam.team.abbreviation;
      const rawAwayAbbrev = awayTeam.team.abbreviation;
      
      games.push({
        espnId: event.id,
        homeAbbrev: abbrevMap[rawHomeAbbrev] || rawHomeAbbrev,
        awayAbbrev: abbrevMap[rawAwayAbbrev] || rawAwayAbbrev,
        homeScore,
        awayScore,
        startTimeUtc: event.date,
        seasonYear: event.season?.year || seasonYear,
        isPlayoff: event.season?.type === 3,
      });
    }

    return games;
  } catch (err) {
    console.log(`[BACKFILL] Error fetching ${sport} ${dateStr}:`, err);
    return [];
  }
}

function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  for (let d = new Date(start); d <= end && d <= today; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split("T")[0]);
  }

  return dates;
}

// Franchise cache
const franchiseCache = new Map<string, string>();

async function getOrCreateFranchise(
  supabase: any,
  sport: string,
  abbrev: string
): Promise<string | null> {
  const cacheKey = `${sport}:${abbrev}`;
  if (franchiseCache.has(cacheKey)) {
    return franchiseCache.get(cacheKey)!;
  }

  const mapping = FRANCHISE_MAPPINGS[sport] || {};
  const canonicalName = mapping[abbrev];
  
  if (!canonicalName) {
    console.log(`[BACKFILL] No franchise mapping for ${sport}:${abbrev}`);
    return null;
  }

  // Check if exists
  const { data: existing } = await supabase
    .from("franchises")
    .select("id")
    .eq("sport_id", sport)
    .eq("canonical_name", canonicalName)
    .maybeSingle();

  if (existing) {
    franchiseCache.set(cacheKey, existing.id);
    return existing.id;
  }

  // Create new
  const { data: created, error } = await supabase
    .from("franchises")
    .insert({ sport_id: sport, canonical_name: canonicalName })
    .select("id")
    .single();

  if (error) {
    // Might be race condition, try again
    const { data: retry } = await supabase
      .from("franchises")
      .select("id")
      .eq("sport_id", sport)
      .eq("canonical_name", canonicalName)
      .maybeSingle();
    if (retry) {
      franchiseCache.set(cacheKey, retry.id);
      return retry.id;
    }
    return null;
  }

  franchiseCache.set(cacheKey, created.id);
  return created.id;
}

// Team cache
const teamCache = new Map<string, string>();

async function getOrCreateTeam(
  supabase: any,
  sport: string,
  abbrev: string,
  franchiseId: string | null
): Promise<string | null> {
  const cacheKey = `${sport}:${abbrev}`;
  if (teamCache.has(cacheKey)) {
    return teamCache.get(cacheKey)!;
  }

  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("sport_id", sport)
    .eq("abbrev", abbrev)
    .maybeSingle();

  if (existing) {
    teamCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const mapping = FRANCHISE_MAPPINGS[sport] || {};
  const name = mapping[abbrev] || abbrev;

  const { data: created, error } = await supabase
    .from("teams")
    .insert({
      sport_id: sport,
      provider_team_key: `espn-${sport}-${abbrev}`,
      name,
      abbrev,
    })
    .select("id")
    .single();

  if (error) {
    const { data: retry } = await supabase
      .from("teams")
      .select("id")
      .eq("sport_id", sport)
      .eq("abbrev", abbrev)
      .maybeSingle();
    if (retry) {
      teamCache.set(cacheKey, retry.id);
      return retry.id;
    }
    return null;
  }

  teamCache.set(cacheKey, created.id);
  return created.id;
}

async function backfillSport(
  supabase: any,
  sport: string,
  jobRunId: number,
  storeRaw: boolean = false
) {
  const seasons = SPORT_SEASONS[sport] || [];
  console.log(`[BACKFILL] Starting ${sport} with ${seasons.length} seasons`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let seasonsProcessed = 0;

  for (const season of seasons) {
    const dates = generateDateRange(season.start, season.end);
    console.log(`[BACKFILL] ${sport} ${season.year}: ${dates.length} days`);

    let seasonInserted = 0;

    // Upsert season record
    await supabase.from("seasons").upsert({
      sport_id: sport,
      season_year: season.year,
      start_date: season.start,
      end_date: season.end,
    }, { onConflict: "sport_id,league_id,season_year" });

    for (const dateStr of dates) {
      try {
        const games = await fetchESPNGamesForDate(supabase, sport, dateStr, season.year, storeRaw);

        for (const game of games) {
          // Get/create franchises
          const homeFranchiseId = await getOrCreateFranchise(supabase, sport, game.homeAbbrev);
          const awayFranchiseId = await getOrCreateFranchise(supabase, sport, game.awayAbbrev);

          // Get/create teams
          const homeTeamId = await getOrCreateTeam(supabase, sport, game.homeAbbrev, homeFranchiseId);
          const awayTeamId = await getOrCreateTeam(supabase, sport, game.awayAbbrev, awayFranchiseId);

          if (!homeTeamId || !awayTeamId) {
            totalSkipped++;
            continue;
          }

          const providerGameKey = `espn-${sport}-${game.espnId}`;
          const finalTotal = game.homeScore + game.awayScore;
          const decade = computeDecade(game.seasonYear);

          // Check if game exists
          const { data: existing } = await supabase
            .from("games")
            .select("id")
            .eq("provider_game_key", providerGameKey)
            .maybeSingle();

          if (existing) {
            // Update with new fields
            await supabase.from("games").update({
              season_year: game.seasonYear,
              decade,
              is_playoff: game.isPlayoff,
              home_franchise_id: homeFranchiseId,
              away_franchise_id: awayFranchiseId,
            }).eq("id", existing.id);
            totalSkipped++;
            continue;
          }

          // Insert game
          const { data: newGame, error: gameError } = await supabase
            .from("games")
            .insert({
              sport_id: sport,
              provider_game_key: providerGameKey,
              home_team_id: homeTeamId,
              away_team_id: awayTeamId,
              home_score: game.homeScore,
              away_score: game.awayScore,
              final_total: finalTotal,
              start_time_utc: game.startTimeUtc,
              status: "final",
              season_year: game.seasonYear,
              decade,
              is_playoff: game.isPlayoff,
              home_franchise_id: homeFranchiseId,
              away_franchise_id: awayFranchiseId,
            })
            .select("id")
            .single();

          if (gameError) {
            if (!gameError.message?.includes("duplicate")) {
              totalErrors++;
            } else {
              totalSkipped++;
            }
            continue;
          }

          // Insert matchup_games entry with franchise IDs
          const [teamLowId, teamHighId] = [homeTeamId, awayTeamId].sort();
          const [franchiseLowId, franchiseHighId] = homeFranchiseId && awayFranchiseId
            ? [homeFranchiseId, awayFranchiseId].sort()
            : [null, null];

          await supabase.from("matchup_games").insert({
            game_id: newGame.id,
            sport_id: sport,
            team_low_id: teamLowId,
            team_high_id: teamHighId,
            franchise_low_id: franchiseLowId,
            franchise_high_id: franchiseHighId,
            total: finalTotal,
            played_at_utc: game.startTimeUtc,
            season_year: game.seasonYear,
            decade,
          });

          totalInserted++;
          seasonInserted++;
        }

        // Throttle: 100ms between dates to avoid rate limits
        await new Promise((r) => setTimeout(r, 100));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`[BACKFILL] Error on ${dateStr}: ${errMsg}`);
        totalErrors++;
        // Continue processing - don't let one date break the whole season
      }
    }

    seasonsProcessed++;
    
    // Update season games count
    await supabase.from("seasons").update({
      games_count: seasonInserted,
      is_complete: true,
      updated_at: new Date().toISOString(),
    }).eq("sport_id", sport).eq("season_year", season.year);

    console.log(`[BACKFILL] ${sport} ${season.year}: +${seasonInserted} games`);

    // Update job progress
    await supabase.from("job_runs").update({
      details: {
        sport,
        seasons_processed: seasonsProcessed,
        total_seasons: seasons.length,
        current_season: season.year,
        games_inserted: totalInserted,
        games_skipped: totalSkipped,
        errors: totalErrors,
        status: "running",
      },
    }).eq("id", jobRunId);
  }

  return { totalInserted, totalSkipped, totalErrors, seasonsProcessed };
}

async function computeSegmentedStats(supabase: any, sport: string) {
  console.log(`[BACKFILL] Computing segmented stats for ${sport}...`);

  // Get all unique franchise matchups
  const { data: matchups } = await supabase
    .from("matchup_games")
    .select("franchise_low_id, franchise_high_id")
    .eq("sport_id", sport)
    .not("franchise_low_id", "is", null)
    .not("franchise_high_id", "is", null);

  const uniqueMatchups = new Map<string, { lowId: string; highId: string }>();
  matchups?.forEach((m: any) => {
    const key = `${m.franchise_low_id}|${m.franchise_high_id}`;
    if (!uniqueMatchups.has(key)) {
      uniqueMatchups.set(key, { lowId: m.franchise_low_id, highId: m.franchise_high_id });
    }
  });

  console.log(`[BACKFILL] Found ${uniqueMatchups.size} unique franchise matchups`);

  const currentYear = new Date().getFullYear();
  const segments = [
    { key: "h2h_all", filter: () => true },
    { key: "h2h_3y", filter: (year: number) => year >= currentYear - 3 },
    { key: "h2h_2y", filter: (year: number) => year >= currentYear - 2 },
  ];

  let statsUpdated = 0;

  for (const [key, matchup] of uniqueMatchups) {
    const { data: games } = await supabase
      .from("matchup_games")
      .select("total, season_year")
      .eq("sport_id", sport)
      .eq("franchise_low_id", matchup.lowId)
      .eq("franchise_high_id", matchup.highId);

    if (!games || games.length === 0) continue;

    for (const segment of segments) {
      const filtered = games.filter((g: any) => segment.filter(g.season_year));
      if (filtered.length === 0) continue;

      const totals = filtered.map((m: any) => Number(m.total)).sort((a: number, b: number) => a - b);
      const n = totals.length;

      const p05Index = Math.max(0, Math.ceil(0.05 * n) - 1);
      const p95Index = Math.min(n - 1, Math.ceil(0.95 * n) - 1);
      const medianIndex = Math.floor(n / 2);

      // Upsert stats
      await supabase.from("matchup_stats").upsert({
        sport_id: sport,
        franchise_low_id: matchup.lowId,
        franchise_high_id: matchup.highId,
        team_low_id: matchup.lowId, // For backwards compatibility
        team_high_id: matchup.highId,
        segment_key: segment.key,
        n_games: n,
        p05: totals[p05Index],
        p95: totals[p95Index],
        median: n % 2 === 0 ? (totals[medianIndex - 1] + totals[medianIndex]) / 2 : totals[medianIndex],
        min_total: totals[0],
        max_total: totals[n - 1],
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: "sport_id,franchise_low_id,franchise_high_id,segment_key",
        ignoreDuplicates: false 
      });

      statsUpdated++;
    }
  }

  console.log(`[BACKFILL] Updated ${statsUpdated} matchup stats for ${sport}`);
  return statsUpdated;
}

async function runFullBackfill(supabase: any, sports: string[], jobRunId: number, storeRaw: boolean) {
  const results: Record<string, any> = {};

  for (const sport of sports) {
    console.log(`[BACKFILL] ========== Starting ${sport} ==========`);
    
    // Clear caches
    franchiseCache.clear();
    teamCache.clear();

    const sportResult = await backfillSport(supabase, sport, jobRunId, storeRaw);
    results[sport] = sportResult;

    // Compute segmented stats after each sport
    const statsCount = await computeSegmentedStats(supabase, sport);
    results[sport].statsComputed = statsCount;

    console.log(`[BACKFILL] ${sport} complete:`, results[sport]);
  }

  // Mark job as complete
  await supabase.from("job_runs").update({
    finished_at: new Date().toISOString(),
    status: "success",
    details: results,
  }).eq("id", jobRunId);

  console.log(`[BACKFILL] ========== ALL COMPLETE ==========`, results);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    let sports = ["nba", "nfl", "nhl", "mlb"];
    let recomputeOnly = false;
    let storeRaw = false;

    try {
      const body = await req.json();
      if (body.sports && Array.isArray(body.sports)) {
        sports = body.sports;
      }
      recomputeOnly = body.recompute_only === true;
      storeRaw = body.store_raw === true;
    } catch {
      // Use defaults
    }

    // Create job run record
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "backfill-all",
        status: "running",
        details: { sports, recompute_only: recomputeOnly, store_raw: storeRaw },
      })
      .select("id")
      .single();

    const jobRunId = jobRun?.id;

    if (recomputeOnly) {
      // @ts-ignore
      EdgeRuntime.waitUntil((async () => {
        const results: Record<string, number> = {};
        for (const sport of sports) {
          results[sport] = await computeSegmentedStats(supabase, sport);
        }
        await supabase.from("job_runs").update({
          finished_at: new Date().toISOString(),
          status: "success",
          details: results,
        }).eq("id", jobRunId);
      })());

      return new Response(
        JSON.stringify({
          success: true,
          message: "Recomputing segmented matchup stats in background",
          job_id: jobRunId,
          sports,
          segments: ["h2h_all", "h2h_20y", "h2h_10y", "h2h_5y", "h2h_3y"],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Run full backfill in background
    // @ts-ignore
    EdgeRuntime.waitUntil(runFullBackfill(supabase, sports, jobRunId, storeRaw));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Full historical backfill started (25+ years, all sports)",
        job_id: jobRunId,
        sports,
        note: "This will take several hours. Check job_runs table for progress.",
        segments: ["h2h_all", "h2h_20y", "h2h_10y", "h2h_5y", "h2h_3y"],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BACKFILL] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
