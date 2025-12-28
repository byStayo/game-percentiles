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
  };
  visitor_team: {
    id: number;
    abbreviation: string;
    full_name: string;
    name: string;
  };
  home_team_score: number | null;
  visitor_team_score: number | null;
  week?: number;
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

// Retry helper with exponential backoff
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
  apiKey: string
): Promise<ParsedGame[]> {
  const baseUrl = BDL_BASE_URLS[sport];
  if (!baseUrl) return [];

  const games: ParsedGame[] = [];
  let cursor: number | null = null;
  let pageCount = 0;
  const maxPages = 100;

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
    const nextCursor = data.meta?.next_cursor;
    if (!nextCursor) break;
    cursor = nextCursor;
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`[BDL] Fetched ${games.length} games for ${sport} ${season} in ${pageCount} pages`);
  return games;
}

// Caches for franchises and teams
const franchiseCache = new Map<string, string>();
const teamCache = new Map<string, string>();

async function ensureFranchisesAndTeams(
  supabase: any,
  sport: string,
  games: ParsedGame[]
): Promise<void> {
  // Collect unique abbreviations
  const abbrevs = new Set<string>();
  for (const game of games) {
    abbrevs.add(game.homeAbbrev);
    abbrevs.add(game.awayAbbrev);
  }

  const mapping = FRANCHISE_MAPPINGS[sport] || {};

  // Ensure franchises exist
  for (const abbrev of abbrevs) {
    const cacheKey = `${sport}:${abbrev}`;
    if (franchiseCache.has(cacheKey)) continue;

    const canonicalName = mapping[abbrev];
    if (!canonicalName) continue;

    const { data: existing } = await supabase
      .from("franchises")
      .select("id")
      .eq("sport_id", sport)
      .eq("canonical_name", canonicalName)
      .maybeSingle();

    if (existing) {
      franchiseCache.set(cacheKey, existing.id);
    } else {
      const { data: created } = await supabase
        .from("franchises")
        .insert({ sport_id: sport, canonical_name: canonicalName })
        .select("id")
        .single();
      if (created) franchiseCache.set(cacheKey, created.id);
    }
  }

  // Ensure teams exist
  for (const abbrev of abbrevs) {
    const cacheKey = `${sport}:${abbrev}`;
    if (teamCache.has(cacheKey)) continue;

    const { data: existing } = await supabase
      .from("teams")
      .select("id")
      .eq("sport_id", sport)
      .eq("abbrev", abbrev)
      .maybeSingle();

    if (existing) {
      teamCache.set(cacheKey, existing.id);
    } else {
      const name = mapping[abbrev] || abbrev;
      const { data: created } = await supabase
        .from("teams")
        .insert({
          sport_id: sport,
          provider_team_key: `bdl-${sport}-${abbrev}`,
          name,
          abbrev,
        })
        .select("id")
        .single();
      if (created) teamCache.set(cacheKey, created.id);
    }
  }
}

// Process a single season with batch upserts
async function processSeasonBatch(
  supabase: any,
  sport: string,
  season: number,
  apiKey: string
): Promise<{ inserted: number; updated: number; errors: number }> {
  const counters = { inserted: 0, updated: 0, errors: 0 };

  // Fetch all games for the season
  const games = await fetchSeasonGames(sport, season, apiKey);
  if (games.length === 0) return counters;

  // Ensure all franchises and teams exist first
  await ensureFranchisesAndTeams(supabase, sport, games);

  // Get existing game IDs to check for updates
  const providerKeys = games.map(g => `bdl-${sport}-${g.bdlId}`);
  const { data: existingGames } = await supabase
    .from("games")
    .select("id, provider_game_key")
    .in("provider_game_key", providerKeys);

  const existingMap = new Map<string, string>();
  for (const eg of existingGames || []) {
    existingMap.set(eg.provider_game_key, eg.id);
  }

  // Prepare batch inserts
  const gamesToInsert: any[] = [];
  const gamesToUpdate: { id: string; data: any }[] = [];

  for (const game of games) {
    const homeTeamId = teamCache.get(`${sport}:${game.homeAbbrev}`);
    const awayTeamId = teamCache.get(`${sport}:${game.awayAbbrev}`);
    const homeFranchiseId = franchiseCache.get(`${sport}:${game.homeAbbrev}`) || null;
    const awayFranchiseId = franchiseCache.get(`${sport}:${game.awayAbbrev}`) || null;

    if (!homeTeamId || !awayTeamId) {
      counters.errors++;
      continue;
    }

    const providerGameKey = `bdl-${sport}-${game.bdlId}`;
    const decade = computeDecade(game.seasonYear);
    const existingId = existingMap.get(providerGameKey);

    const gameData = {
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
    };

    if (existingId) {
      gamesToUpdate.push({ id: existingId, data: gameData });
    } else {
      gamesToInsert.push(gameData);
    }
  }

  // Batch insert new games
  if (gamesToInsert.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < gamesToInsert.length; i += BATCH_SIZE) {
      const batch = gamesToInsert.slice(i, i + BATCH_SIZE);
      const { data: inserted, error } = await supabase
        .from("games")
        .insert(batch)
        .select("id, provider_game_key");

      if (error) {
        console.error(`[BDL] Batch insert error: ${error.message}`);
        counters.errors += batch.length;
      } else {
        counters.inserted += inserted?.length || 0;
        // Add to existingMap for matchup creation
        for (const ig of inserted || []) {
          existingMap.set(ig.provider_game_key, ig.id);
        }
      }
    }
  }

  // Update existing games (one by one since batch update by different IDs isn't supported)
  for (const update of gamesToUpdate) {
    await supabase.from("games").update(update.data).eq("id", update.id);
    counters.updated++;
  }

  // Create matchup_games entries in batch
  const matchupsToInsert: any[] = [];
  
  for (const game of games) {
    const providerGameKey = `bdl-${sport}-${game.bdlId}`;
    const gameId = existingMap.get(providerGameKey);
    if (!gameId) continue;

    const homeTeamId = teamCache.get(`${sport}:${game.homeAbbrev}`);
    const awayTeamId = teamCache.get(`${sport}:${game.awayAbbrev}`);
    const homeFranchiseId = franchiseCache.get(`${sport}:${game.homeAbbrev}`) || null;
    const awayFranchiseId = franchiseCache.get(`${sport}:${game.awayAbbrev}`) || null;

    if (!homeTeamId || !awayTeamId) continue;

    const [teamLowId, teamHighId] = [homeTeamId, awayTeamId].sort();
    const [franchiseLowId, franchiseHighId] = [homeFranchiseId, awayFranchiseId].sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    });

    matchupsToInsert.push({
      sport_id: sport,
      team_low_id: teamLowId,
      team_high_id: teamHighId,
      franchise_low_id: franchiseLowId || null,
      franchise_high_id: franchiseHighId || null,
      game_id: gameId,
      played_at_utc: game.startTimeUtc,
      total: game.homeScore + game.awayScore,
      season_year: game.seasonYear,
      decade: computeDecade(game.seasonYear),
    });
  }

  // Batch insert matchups (ignore conflicts)
  if (matchupsToInsert.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < matchupsToInsert.length; i += BATCH_SIZE) {
      const batch = matchupsToInsert.slice(i, i + BATCH_SIZE);
      await supabase
        .from("matchup_games")
        .upsert(batch, { onConflict: "game_id", ignoreDuplicates: true });
    }
  }

  console.log(`[BDL] ${sport} ${season}: ${counters.inserted} inserted, ${counters.updated} updated`);
  return counters;
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

    let requestBody: {
      sport?: string;
      season?: number;
      sports?: string[];
      seasons?: number[];
    } = {};
    
    try {
      requestBody = await req.json();
    } catch {
      // Empty body is OK
    }

    // Single season mode (for chunked processing)
    if (requestBody.sport && requestBody.season) {
      const { sport, season } = requestBody;
      console.log(`[BDL] Processing single season: ${sport} ${season}`);

      const { data: jobRun } = await supabase
        .from("job_runs")
        .insert({
          job_name: `bdl-${sport}-${season}`,
          details: { sport, season, status: "running" },
        })
        .select()
        .single();

      const result = await processSeasonBatch(supabase, sport, season, apiKey);

      await supabase.from("job_runs").update({
        finished_at: new Date().toISOString(),
        status: result.errors > 0 ? "partial" : "success",
        details: { sport, season, ...result },
      }).eq("id", jobRun?.id);

      return new Response(
        JSON.stringify({ success: true, job_id: jobRun?.id, sport, season, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Multi-season mode - queue all seasons
    const sports = requestBody.sports || ["nba", "nfl"];
    const defaultSeasons = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];
    const seasons = requestBody.seasons || defaultSeasons;

    // Create a master job
    const { data: masterJob } = await supabase
      .from("job_runs")
      .insert({
        job_name: "bdl-backfill-master",
        details: { sports, seasons, total_jobs: sports.length * seasons.length },
      })
      .select()
      .single();

    // Queue individual season jobs by calling this function recursively
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    const jobs: { sport: string; season: number }[] = [];
    for (const sport of sports) {
      for (const season of seasons) {
        jobs.push({ sport, season });
      }
    }

    // Process jobs sequentially in background to avoid rate limits
    EdgeRuntime.waitUntil((async () => {
      let completed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalErrors = 0;

      for (const job of jobs) {
        try {
          const result = await processSeasonBatch(supabase, job.sport, job.season, apiKey);
          totalInserted += result.inserted;
          totalUpdated += result.updated;
          totalErrors += result.errors;
          completed++;

          // Update master job progress
          await supabase.from("job_runs").update({
            details: {
              sports,
              seasons,
              completed,
              total: jobs.length,
              inserted: totalInserted,
              updated: totalUpdated,
              errors: totalErrors,
              current: `${job.sport} ${job.season}`,
            },
          }).eq("id", masterJob?.id);

        } catch (err) {
          console.error(`[BDL] Error processing ${job.sport} ${job.season}:`, err);
          totalErrors++;
        }
      }

      // Mark master job complete
      await supabase.from("job_runs").update({
        finished_at: new Date().toISOString(),
        status: totalErrors > 0 ? "partial" : "success",
        details: {
          sports,
          seasons,
          completed,
          total: jobs.length,
          inserted: totalInserted,
          updated: totalUpdated,
          errors: totalErrors,
        },
      }).eq("id", masterJob?.id);

      console.log(`[BDL] Master job complete: ${totalInserted} inserted, ${totalUpdated} updated`);
    })());

    return new Response(
      JSON.stringify({
        success: true,
        message: "Backfill queued",
        master_job_id: masterJob?.id,
        sports,
        seasons,
        total_jobs: jobs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[BDL] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
