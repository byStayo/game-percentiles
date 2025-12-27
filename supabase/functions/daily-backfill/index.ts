import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ESPN abbreviation normalization
const ESPN_ABBREV_MAP: Record<string, Record<string, string>> = {
  nba: { "GS": "GSW", "NY": "NYK", "NO": "NOP", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS" },
  nfl: { "JAX": "JAC", "WSH": "WAS" },
  nhl: { "LA": "LAK", "UTAH": "UTA", "WSH": "WAS" },
  mlb: { "CHW": "CWS", "WSH": "WAS" },
};

// Franchise mappings
const FRANCHISE_MAPPINGS: Record<string, Record<string, string>> = {
  nba: {
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
    "NJN": "Brooklyn Nets", "SEA": "Oklahoma City Thunder", "VAN": "Memphis Grizzlies",
    "NOH": "New Orleans Pelicans", "NOK": "New Orleans Pelicans",
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
    "FLA": "Miami Marlins", "MON": "Washington Nationals", "ANA": "Los Angeles Angels",
  },
};

function computeDecade(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
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

async function fetchESPNGamesForDate(sport: string, dateStr: string): Promise<ParsedGame[]> {
  const baseUrl = ESPN_API_URLS[sport];
  if (!baseUrl) return [];

  const espnDate = dateStr.replace(/-/g, "");
  const url = `${baseUrl}?dates=${espnDate}`;

  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) return [];

    const data = await response.json();
    const games: ParsedGame[] = [];
    const abbrevMap = ESPN_ABBREV_MAP[sport] || {};

    for (const event of data.events || []) {
      const competition = event.competitions?.[0];
      if (!competition || !event.status?.type?.completed) continue;

      const homeTeam = competition.competitors.find((c: any) => c.homeAway === "home");
      const awayTeam = competition.competitors.find((c: any) => c.homeAway === "away");
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
        seasonYear: event.season?.year || new Date().getFullYear(),
        isPlayoff: event.season?.type === 3,
      });
    }

    return games;
  } catch (err) {
    console.log(`[DAILY] Error fetching ${sport} ${dateStr}:`, err);
    return [];
  }
}

// Caches
const franchiseCache = new Map<string, string>();
const teamCache = new Map<string, string>();

async function getOrCreateFranchise(supabase: any, sport: string, abbrev: string): Promise<string | null> {
  const cacheKey = `${sport}:${abbrev}`;
  if (franchiseCache.has(cacheKey)) return franchiseCache.get(cacheKey)!;

  const mapping = FRANCHISE_MAPPINGS[sport] || {};
  const canonicalName = mapping[abbrev];
  if (!canonicalName) return null;

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

  const { data: created, error } = await supabase
    .from("franchises")
    .insert({ sport_id: sport, canonical_name: canonicalName })
    .select("id")
    .single();

  if (error) {
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

async function getOrCreateTeam(supabase: any, sport: string, abbrev: string): Promise<string | null> {
  const cacheKey = `${sport}:${abbrev}`;
  if (teamCache.has(cacheKey)) return teamCache.get(cacheKey)!;

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

async function backfillDateRange(
  supabase: any,
  sport: string,
  startDate: string,
  endDate: string
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  for (let d = new Date(start); d <= end && d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const games = await fetchESPNGamesForDate(sport, dateStr);

    for (const game of games) {
      try {
        const homeFranchiseId = await getOrCreateFranchise(supabase, sport, game.homeAbbrev);
        const awayFranchiseId = await getOrCreateFranchise(supabase, sport, game.awayAbbrev);
        const homeTeamId = await getOrCreateTeam(supabase, sport, game.homeAbbrev);
        const awayTeamId = await getOrCreateTeam(supabase, sport, game.awayAbbrev);

        if (!homeTeamId || !awayTeamId) {
          skipped++;
          continue;
        }

        const providerGameKey = `espn-${sport}-${game.espnId}`;
        const { data: existing } = await supabase
          .from("games")
          .select("id")
          .eq("provider_game_key", providerGameKey)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const finalTotal = game.homeScore + game.awayScore;
        const decade = computeDecade(game.seasonYear);

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
          if (!gameError.message?.includes("duplicate")) errors++;
          else skipped++;
          continue;
        }

        // Insert matchup_games
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

        inserted++;
      } catch (err) {
        console.log(`[DAILY] Error processing game:`, err);
        errors++;
      }
    }
  }

  return { inserted, skipped, errors };
}

async function findDataGaps(supabase: any): Promise<{ sport: string; startDate: string; endDate: string }[]> {
  const gaps: { sport: string; startDate: string; endDate: string }[] = [];
  const sports = ["nba", "nfl", "nhl", "mlb"];
  
  // Get matchups with low game counts (less than 10 games in last 10 years)
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  for (const sport of sports) {
    // Check if we have recent data
    const { data: recentGames } = await supabase
      .from("games")
      .select("start_time_utc")
      .eq("sport_id", sport)
      .eq("status", "final")
      .order("start_time_utc", { ascending: false })
      .limit(1);

    if (recentGames && recentGames.length > 0) {
      const lastGameDate = new Date(recentGames[0].start_time_utc);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // If last game is more than 3 days old, backfill recent days
      const daysSinceLastGame = Math.floor((yesterday.getTime() - lastGameDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastGame > 3) {
        const startDate = new Date(lastGameDate);
        startDate.setDate(startDate.getDate() + 1);
        gaps.push({
          sport,
          startDate: startDate.toISOString().split("T")[0],
          endDate: yesterday.toISOString().split("T")[0],
        });
      }
    }
  }

  return gaps;
}

async function recomputeStats(supabase: any): Promise<void> {
  console.log("[DAILY] Triggering percentile recomputation...");
  
  // Get today's date in ET
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  
  // Call compute-percentiles function via HTTP
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/compute-percentiles?date=${today}`, {
      headers: {
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });
    
    if (response.ok) {
      console.log("[DAILY] Percentile computation triggered successfully");
    } else {
      console.log("[DAILY] Percentile computation failed:", await response.text());
    }
  } catch (err) {
    console.log("[DAILY] Error triggering percentile computation:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[DAILY] Starting daily backfill job");

    // Record job start
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({ job_name: "daily-backfill", status: "running" })
      .select("id")
      .single();

    const results: Record<string, any> = {
      gapsFilled: [],
      recentBackfill: {},
      statsRecomputed: false,
    };

    // 1. Find and fill data gaps
    const gaps = await findDataGaps(supabase);
    console.log(`[DAILY] Found ${gaps.length} data gaps to fill`);

    for (const gap of gaps) {
      console.log(`[DAILY] Filling gap: ${gap.sport} from ${gap.startDate} to ${gap.endDate}`);
      const result = await backfillDateRange(supabase, gap.sport, gap.startDate, gap.endDate);
      results.gapsFilled.push({ ...gap, ...result });
    }

    // 2. Backfill last 7 days for all sports (ensure recent data is complete)
    const sports = ["nba", "nfl", "nhl", "mlb"];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    for (const sport of sports) {
      console.log(`[DAILY] Backfilling recent ${sport} games`);
      const result = await backfillDateRange(
        supabase,
        sport,
        weekAgo.toISOString().split("T")[0],
        yesterday.toISOString().split("T")[0]
      );
      results.recentBackfill[sport] = result;
    }

    // 3. Recompute stats for today's games
    await recomputeStats(supabase);
    results.statsRecomputed = true;

    // Update job status
    if (jobRun) {
      await supabase
        .from("job_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          details: results,
        })
        .eq("id", jobRun.id);
    }

    console.log("[DAILY] Daily backfill complete:", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[DAILY] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
