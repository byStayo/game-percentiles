import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BALLDONTLIE API base URLs
const BDL_BASE_URLS: Record<string, string> = {
  nba: "https://api.balldontlie.io/v1",
  nfl: "https://api.balldontlie.io/nfl/v1",
  nhl: "https://api.balldontlie.io/nhl/v1",
  mlb: "https://api.balldontlie.io/mlb/v1",
};

// Franchise mappings for consistent team identity across history
const FRANCHISE_MAPPINGS: Record<string, Record<string, string>> = {
  nba: {
    "ATL": "Atlanta Hawks", "BOS": "Boston Celtics", "BKN": "Brooklyn Nets", "BRK": "Brooklyn Nets",
    "CHA": "Charlotte Hornets", "CHI": "Chicago Bulls", "CLE": "Cleveland Cavaliers",
    "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets", "DET": "Detroit Pistons",
    "GSW": "Golden State Warriors", "GS": "Golden State Warriors",
    "HOU": "Houston Rockets", "IND": "Indiana Pacers", "LAC": "LA Clippers",
    "LAL": "Los Angeles Lakers", "MEM": "Memphis Grizzlies", "MIA": "Miami Heat",
    "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans", "NO": "New Orleans Pelicans", "NOH": "New Orleans Pelicans",
    "NYK": "New York Knicks", "NY": "New York Knicks",
    "OKC": "Oklahoma City Thunder", "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers",
    "PHX": "Phoenix Suns", "PHO": "Phoenix Suns", "POR": "Portland Trail Blazers",
    "SAC": "Sacramento Kings", "SAS": "San Antonio Spurs", "SA": "San Antonio Spurs",
    "TOR": "Toronto Raptors", "UTA": "Utah Jazz", "UTAH": "Utah Jazz",
    "WAS": "Washington Wizards", "WSH": "Washington Wizards",
    // Historical
    "NJN": "Brooklyn Nets", "SEA": "Oklahoma City Thunder", "VAN": "Memphis Grizzlies",
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
    // Historical
    "OAK": "Las Vegas Raiders", "SD": "Los Angeles Chargers", "STL": "Los Angeles Rams",
  },
  nhl: {
    "ANA": "Anaheim Ducks", "ARI": "Arizona Coyotes", "BOS": "Boston Bruins",
    "BUF": "Buffalo Sabres", "CGY": "Calgary Flames", "CAR": "Carolina Hurricanes",
    "CHI": "Chicago Blackhawks", "COL": "Colorado Avalanche", "CBJ": "Columbus Blue Jackets",
    "DAL": "Dallas Stars", "DET": "Detroit Red Wings", "EDM": "Edmonton Oilers",
    "FLA": "Florida Panthers", "LA": "Los Angeles Kings", "LAK": "Los Angeles Kings",
    "MIN": "Minnesota Wild", "MTL": "Montreal Canadiens", "NSH": "Nashville Predators",
    "NJ": "New Jersey Devils", "NYI": "New York Islanders", "NYR": "New York Rangers",
    "OTT": "Ottawa Senators", "PHI": "Philadelphia Flyers", "PIT": "Pittsburgh Penguins",
    "SJ": "San Jose Sharks", "SJS": "San Jose Sharks", "SEA": "Seattle Kraken",
    "STL": "St. Louis Blues", "TB": "Tampa Bay Lightning", "TBL": "Tampa Bay Lightning",
    "TOR": "Toronto Maple Leafs", "VAN": "Vancouver Canucks",
    "VGK": "Vegas Golden Knights", "VEG": "Vegas Golden Knights",
    "WPG": "Winnipeg Jets", "WSH": "Washington Capitals", "WAS": "Washington Capitals",
    "UTA": "Utah Hockey Club", "UTAH": "Utah Hockey Club",
  },
  mlb: {
    "ARI": "Arizona Diamondbacks", "ATL": "Atlanta Braves", "BAL": "Baltimore Orioles",
    "BOS": "Boston Red Sox", "CHC": "Chicago Cubs", "CWS": "Chicago White Sox", "CHW": "Chicago White Sox",
    "CIN": "Cincinnati Reds", "CLE": "Cleveland Guardians",
    "COL": "Colorado Rockies", "DET": "Detroit Tigers", "HOU": "Houston Astros",
    "KC": "Kansas City Royals", "KCR": "Kansas City Royals",
    "LAA": "Los Angeles Angels", "LAD": "Los Angeles Dodgers",
    "MIA": "Miami Marlins", "MIL": "Milwaukee Brewers", "MIN": "Minnesota Twins",
    "NYM": "New York Mets", "NYY": "New York Yankees", 
    "OAK": "Oakland Athletics", "ATH": "Oakland Athletics",
    "PHI": "Philadelphia Phillies", "PIT": "Pittsburgh Pirates", 
    "SD": "San Diego Padres", "SDP": "San Diego Padres",
    "SF": "San Francisco Giants", "SFG": "San Francisco Giants",
    "SEA": "Seattle Mariners", "STL": "St. Louis Cardinals",
    "TB": "Tampa Bay Rays", "TBR": "Tampa Bay Rays",
    "TEX": "Texas Rangers", "TOR": "Toronto Blue Jays",
    "WAS": "Washington Nationals", "WSH": "Washington Nationals",
  },
};

// Seasons to backfill - optimized for speed by fetching multiple seasons at once
const SEASONS_TO_BACKFILL: Record<string, number[]> = {
  nba: [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015],
  nfl: [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015],
  nhl: [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015],
  mlb: [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015],
};

interface BDLGame {
  id: number;
  date: string;
  datetime?: string;
  season: number;
  status: string;
  postseason: boolean;
  home_team: {
    id: number;
    abbreviation: string;
    full_name: string;
    name: string;
    city?: string;
    location?: string;
  };
  visitor_team: {
    id: number;
    abbreviation: string;
    full_name: string;
    name: string;
    city?: string;
    location?: string;
  };
  home_team_score: number | null;
  visitor_team_score: number | null;
  week?: number; // NFL only
}

interface ParsedGame {
  bdlId: number;
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
  startTimeUtc: string;
  seasonYear: number;
  isPlayoff: boolean;
  week?: number;
}

function computeDecade(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

// Retry helper with exponential backoff (important for rate limiting)
async function fetchWithRetry(
  url: string,
  apiKey: string,
  maxRetries = 5,
  baseDelay = 200
): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": apiKey,
          "Accept": "application/json",
        },
      });

      if (response.ok) return response;

      if (response.status === 429) {
        // Rate limited - wait longer
        const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);
        console.log(`[BDL] Rate limited, waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (response.status >= 500) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[BDL] Server error ${response.status}, retry ${attempt + 1}/${maxRetries}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Client error - log and continue
      const errorText = await response.text().catch(() => "Unknown");
      console.error(`[BDL] API error ${response.status}: ${errorText}`);
      return null;
    } catch (err) {
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[BDL] Network error, retry ${attempt + 1}/${maxRetries}: ${err}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return null;
}

// Fetch all games for a season with pagination
async function fetchSeasonGames(
  sport: string,
  season: number,
  apiKey: string,
  log: (msg: string) => void
): Promise<ParsedGame[]> {
  const baseUrl = BDL_BASE_URLS[sport];
  if (!baseUrl) return [];

  const games: ParsedGame[] = [];
  let cursor: number | null = null;
  let pageCount = 0;
  const maxPages = 100; // Safety limit

  while (pageCount < maxPages) {
    let url = `${baseUrl}/games?seasons[]=${season}&per_page=100`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    const response = await fetchWithRetry(url, apiKey);
    if (!response) break;

    const data = await response.json();
    const pageGames = data.data || [];

    for (const game of pageGames as BDLGame[]) {
      // Only process completed games with scores
      if (game.status !== "Final" && !game.status?.includes("Final")) continue;
      if (game.home_team_score === null || game.visitor_team_score === null) continue;

      const homeAbbrev = game.home_team?.abbreviation;
      const awayAbbrev = game.visitor_team?.abbreviation;
      if (!homeAbbrev || !awayAbbrev) continue;

      games.push({
        bdlId: game.id,
        homeAbbrev,
        awayAbbrev,
        homeScore: game.home_team_score,
        awayScore: game.visitor_team_score,
        startTimeUtc: game.datetime || game.date,
        seasonYear: game.season,
        isPlayoff: game.postseason || false,
        week: game.week,
      });
    }

    pageCount++;

    // Check for next page
    const nextCursor = data.meta?.next_cursor;
    if (!nextCursor) break;
    cursor = nextCursor;

    // Small delay between pages to avoid rate limiting
    await new Promise(r => setTimeout(r, 50));
  }

  log(`Fetched ${games.length} games for ${sport} ${season} in ${pageCount} pages`);
  return games;
}

// Caches for franchises and teams
const franchiseCache = new Map<string, string>();
const teamCache = new Map<string, string>();

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
    console.log(`[BDL] No franchise mapping for ${sport}:${abbrev}`);
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
    // Race condition - try again
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

async function getOrCreateTeam(
  supabase: any,
  sport: string,
  abbrev: string
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
      provider_team_key: `bdl-${sport}-${abbrev}`,
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

// Main backfill function for a single sport
async function backfillSport(
  supabase: any,
  sport: string,
  apiKey: string,
  seasons: number[],
  jobRunId: number,
  log: (msg: string) => void
): Promise<{ inserted: number; updated: number; skipped: number; errors: number }> {
  const counters = { inserted: 0, updated: 0, skipped: 0, errors: 0 };

  for (const season of seasons) {
    try {
      const games = await fetchSeasonGames(sport, season, apiKey, log);

      for (const game of games) {
        try {
          // Get/create franchises
          const homeFranchiseId = await getOrCreateFranchise(supabase, sport, game.homeAbbrev);
          const awayFranchiseId = await getOrCreateFranchise(supabase, sport, game.awayAbbrev);

          // Get/create teams
          const homeTeamId = await getOrCreateTeam(supabase, sport, game.homeAbbrev);
          const awayTeamId = await getOrCreateTeam(supabase, sport, game.awayAbbrev);

          if (!homeTeamId || !awayTeamId) {
            counters.skipped++;
            continue;
          }

          const providerGameKey = `bdl-${sport}-${game.bdlId}`;
          const finalTotal = game.homeScore + game.awayScore;
          const decade = computeDecade(game.seasonYear);

          // Check if game exists
          const { data: existing } = await supabase
            .from("games")
            .select("id")
            .eq("provider_game_key", providerGameKey)
            .maybeSingle();

          let gameId: string;

          if (existing) {
            // Update existing game
            await supabase.from("games").update({
              season_year: game.seasonYear,
              decade,
              is_playoff: game.isPlayoff,
              home_franchise_id: homeFranchiseId,
              away_franchise_id: awayFranchiseId,
              home_score: game.homeScore,
              away_score: game.awayScore,
              week_round: game.week || null,
              status: "final",
            }).eq("id", existing.id);
            gameId = existing.id;
            counters.updated++;
          } else {
            // Insert new game
            const { data: newGame, error: gameError } = await supabase
              .from("games")
              .insert({
                sport_id: sport,
                provider_game_key: providerGameKey,
                start_time_utc: game.startTimeUtc,
                home_team_id: homeTeamId,
                away_team_id: awayTeamId,
                home_franchise_id: homeFranchiseId,
                away_franchise_id: awayFranchiseId,
                home_score: game.homeScore,
                away_score: game.awayScore,
                status: "final",
                season_year: game.seasonYear,
                decade,
                is_playoff: game.isPlayoff,
                week_round: game.week || null,
              })
              .select("id")
              .single();

            if (gameError) {
              counters.errors++;
              continue;
            }
            gameId = newGame.id;
            counters.inserted++;
          }

          // Upsert matchup_games for H2H stats
          const [teamLowId, teamHighId] = [homeTeamId, awayTeamId].sort();
          const [franchiseLowId, franchiseHighId] = [homeFranchiseId, awayFranchiseId].sort((a, b) => {
            if (!a) return 1;
            if (!b) return -1;
            return a.localeCompare(b);
          });

          // Check if matchup game exists
          const { data: existingMg } = await supabase
            .from("matchup_games")
            .select("id")
            .eq("game_id", gameId)
            .maybeSingle();

          if (!existingMg) {
            await supabase
              .from("matchup_games")
              .insert({
                sport_id: sport,
                team_low_id: teamLowId,
                team_high_id: teamHighId,
                franchise_low_id: franchiseLowId || null,
                franchise_high_id: franchiseHighId || null,
                game_id: gameId,
                played_at_utc: game.startTimeUtc,
                total: finalTotal,
                season_year: game.seasonYear,
                decade,
              });
          }
        } catch (gameErr) {
          counters.errors++;
        }
      }

      // Update job progress
      await supabase.from("job_runs").update({
        details: {
          sport,
          current_season: season,
          counters,
        },
      }).eq("id", jobRunId);

    } catch (seasonErr) {
      log(`Error processing ${sport} ${season}: ${seasonErr}`);
      counters.errors++;
    }
  }

  return counters;
}

// Run full backfill across all requested sports
async function runFullBackfill(
  supabase: any,
  apiKey: string,
  sports: string[],
  seasons: number[] | null,
  jobRunId: number
) {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[BDL] ${msg}`);
    logs.push(`${new Date().toISOString()}: ${msg}`);
  };

  log(`Starting backfill for ${sports.join(", ")}`);

  const results: Record<string, { inserted: number; updated: number; skipped: number; errors: number }> = {};

  for (const sport of sports) {
    const sportSeasons = seasons || SEASONS_TO_BACKFILL[sport] || [];
    log(`Processing ${sport} for seasons: ${sportSeasons.join(", ")}`);

    const counters = await backfillSport(supabase, sport, apiKey, sportSeasons, jobRunId, log);
    results[sport] = counters;

    log(`${sport} complete: ${counters.inserted} inserted, ${counters.updated} updated, ${counters.errors} errors`);
  }

  // Calculate totals
  const totals = {
    inserted: Object.values(results).reduce((sum, r) => sum + r.inserted, 0),
    updated: Object.values(results).reduce((sum, r) => sum + r.updated, 0),
    skipped: Object.values(results).reduce((sum, r) => sum + r.skipped, 0),
    errors: Object.values(results).reduce((sum, r) => sum + r.errors, 0),
  };

  log(`Backfill complete! Total: ${totals.inserted} inserted, ${totals.updated} updated`);

  // Update job run as success
  await supabase.from("job_runs").update({
    finished_at: new Date().toISOString(),
    status: totals.errors > 0 ? "partial" : "success",
    details: {
      totals,
      by_sport: results,
      logs: logs.slice(-50), // Last 50 log entries
    },
  }).eq("id", jobRunId);

  return { totals, by_sport: results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const apiKey = Deno.env.get("BALLDONTLIE_KEY");
    if (!apiKey) {
      throw new Error("BALLDONTLIE_KEY not configured");
    }

    // Parse request body
    let requestBody: {
      sports?: string[];
      seasons?: number[];
      async?: boolean;
    } = {};
    
    try {
      requestBody = await req.json();
    } catch {
      // Empty body is OK - will use defaults
    }

    const sports = requestBody.sports || ["nba", "nfl"];
    const seasons = requestBody.seasons || null; // null = use defaults
    const runAsync = requestBody.async !== false; // Default to async

    console.log(`[BDL] Starting backfill for ${sports.join(", ")}, async=${runAsync}`);

    // Create job run record
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "balldontlie-backfill",
        details: { sports, seasons: seasons || "default", status: "starting" },
      })
      .select()
      .single();

    const jobRunId = jobRun?.id;

    if (runAsync) {
      // Run in background
      EdgeRuntime.waitUntil(
        runFullBackfill(supabase, apiKey, sports, seasons, jobRunId!)
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "Backfill started in background",
          job_id: jobRunId,
          sports,
          seasons: seasons || "default (2015-2024)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Run synchronously (for small requests)
      const result = await runFullBackfill(supabase, apiKey, sports, seasons, jobRunId!);

      return new Response(
        JSON.stringify({
          success: true,
          job_id: jobRunId,
          ...result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[BDL] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
