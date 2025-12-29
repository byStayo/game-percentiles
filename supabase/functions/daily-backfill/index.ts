import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// BallDontLie-based daily backfill (replaces ESPN)
// Maximizes GOAT tier subscription for NBA and NFL
// Falls back to ESPN for NHL and MLB
// ============================================================

const BDL_ENDPOINTS = {
  nba: "https://api.balldontlie.io/v1",
  nfl: "https://api.balldontlie.io/nfl/v1",
};

const ESPN_API_URLS: Record<string, string> = {
  nhl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
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
    "FLA": "Florida Panthers", "LA": "Los Angeles Kings", "MIN": "Minnesota Wild",
    "MTL": "Montreal Canadiens", "NSH": "Nashville Predators", "NJ": "New Jersey Devils",
    "NYI": "New York Islanders", "NYR": "New York Rangers", "OTT": "Ottawa Senators",
    "PHI": "Philadelphia Flyers", "PIT": "Pittsburgh Penguins", "SJ": "San Jose Sharks",
    "SEA": "Seattle Kraken", "STL": "St. Louis Blues", "TB": "Tampa Bay Lightning",
    "TOR": "Toronto Maple Leafs", "VAN": "Vancouver Canucks", "VGK": "Vegas Golden Knights",
    "WPG": "Winnipeg Jets", "WSH": "Washington Capitals", "UTAH": "Utah Hockey Club",
  },
  mlb: {
    "ARI": "Arizona Diamondbacks", "ATL": "Atlanta Braves", "BAL": "Baltimore Orioles",
    "BOS": "Boston Red Sox", "CHC": "Chicago Cubs", "CWS": "Chicago White Sox",
    "CIN": "Cincinnati Reds", "CLE": "Cleveland Guardians", "COL": "Colorado Rockies",
    "DET": "Detroit Tigers", "HOU": "Houston Astros", "KC": "Kansas City Royals",
    "LAA": "Los Angeles Angels", "LAD": "Los Angeles Dodgers", "MIA": "Miami Marlins",
    "MIL": "Milwaukee Brewers", "MIN": "Minnesota Twins", "NYM": "New York Mets",
    "NYY": "New York Yankees", "OAK": "Oakland Athletics", "PHI": "Philadelphia Phillies",
    "PIT": "Pittsburgh Pirates", "SD": "San Diego Padres", "SF": "San Francisco Giants",
    "SEA": "Seattle Mariners", "STL": "St. Louis Cardinals", "TB": "Tampa Bay Rays",
    "TEX": "Texas Rangers", "TOR": "Toronto Blue Jays", "WAS": "Washington Nationals",
  },
};

interface BDLGame {
  id: number;
  date: string;
  datetime?: string;
  season: number;
  status: string;
  postseason: boolean;
  home_team: { id: number; abbreviation: string; full_name: string };
  visitor_team: { id: number; abbreviation: string; full_name: string };
  home_team_score: number | null;
  visitor_team_score: number | null;
  week?: number;
}

// Caches
const franchiseCache = new Map<string, string>();
const teamCache = new Map<string, string>();

async function fetchWithRetry(url: string, headers: Record<string, string>, maxRetries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) return response;
      if (response.status === 429 || response.status >= 500) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return null;
    } catch {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  return null;
}

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

  const { data: created } = await supabase
    .from("franchises")
    .insert({ sport_id: sport, canonical_name: canonicalName })
    .select("id")
    .single();

  if (created) {
    franchiseCache.set(cacheKey, created.id);
    return created.id;
  }
  return null;
}

async function getOrCreateTeam(supabase: any, sport: string, abbrev: string, provider: string): Promise<string | null> {
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

  const { data: created } = await supabase
    .from("teams")
    .insert({
      sport_id: sport,
      provider_team_key: `${provider}-${sport}-${abbrev}`,
      name,
      abbrev,
    })
    .select("id")
    .single();

  if (created) {
    teamCache.set(cacheKey, created.id);
    return created.id;
  }
  return null;
}

function computeDecade(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

// Backfill from BallDontLie for NBA and NFL
async function backfillBDL(
  supabase: any,
  apiKey: string,
  sport: string,
  startDate: string,
  endDate: string
): Promise<{ inserted: number; updated: number; errors: number }> {
  const baseUrl = BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS];
  if (!baseUrl) return { inserted: 0, updated: 0, errors: 0 };

  const counters = { inserted: 0, updated: 0, errors: 0 };

  // Build dates array
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split("T")[0]);
  }

  // Fetch games from BDL
  const datesParam = dates.map(d => `dates[]=${d}`).join("&");
  let cursor: number | null = null;
  const games: BDLGame[] = [];

  while (true) {
    let url = `${baseUrl}/games?${datesParam}&per_page=100`;
    if (cursor) url += `&cursor=${cursor}`;

    const response = await fetchWithRetry(url, { "Authorization": apiKey, "Accept": "application/json" });
    if (!response) break;

    const data = await response.json();
    games.push(...(data.data || []));

    const nextCursor = data.meta?.next_cursor;
    if (!nextCursor) break;
    cursor = nextCursor;
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`[DAILY] Fetched ${games.length} ${sport} games from BallDontLie for ${startDate} to ${endDate}`);

  for (const game of games) {
    const isFinal = game.status === "Final" || game.status?.includes("Final");
    if (!isFinal) continue;

    const homeAbbrev = game.home_team?.abbreviation;
    const awayAbbrev = game.visitor_team?.abbreviation;
    if (!homeAbbrev || !awayAbbrev) continue;

    const homeTeamId = await getOrCreateTeam(supabase, sport, homeAbbrev, "bdl");
    const awayTeamId = await getOrCreateTeam(supabase, sport, awayAbbrev, "bdl");
    const homeFranchiseId = await getOrCreateFranchise(supabase, sport, homeAbbrev);
    const awayFranchiseId = await getOrCreateFranchise(supabase, sport, awayAbbrev);

    if (!homeTeamId || !awayTeamId) {
      counters.errors++;
      continue;
    }

    const providerGameKey = `bdl-${sport}-${game.id}`;
    const homeScore = game.home_team_score ?? 0;
    const awayScore = game.visitor_team_score ?? 0;
    const finalTotal = homeScore + awayScore;
    const decade = computeDecade(game.season);

    // Check if game exists
    const { data: existing } = await supabase
      .from("games")
      .select("id, home_score, away_score")
      .eq("provider_game_key", providerGameKey)
      .maybeSingle();

    if (existing) {
      // Update if scores differ
      if (existing.home_score !== homeScore || existing.away_score !== awayScore) {
        await supabase
          .from("games")
          .update({
            home_score: homeScore,
            away_score: awayScore,
            status: "final",
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        // Update matchup_games
        await supabase
          .from("matchup_games")
          .update({ total: finalTotal })
          .eq("game_id", existing.id);

        counters.updated++;
      }
    } else {
      // Insert new game
      const { data: newGame, error: insertError } = await supabase
        .from("games")
        .insert({
          sport_id: sport,
          provider_game_key: providerGameKey,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_franchise_id: homeFranchiseId,
          away_franchise_id: awayFranchiseId,
          home_score: homeScore,
          away_score: awayScore,
          start_time_utc: game.datetime || game.date,
          status: "final",
          season_year: game.season,
          decade,
          is_playoff: game.postseason || false,
          week_round: game.week,
        })
        .select("id")
        .single();

      if (insertError) {
        counters.errors++;
        continue;
      }

      counters.inserted++;

      // Insert matchup_games
      if (newGame) {
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
          played_at_utc: game.datetime || game.date,
          season_year: game.season,
          decade,
        });
      }
    }
  }

  return counters;
}

// Backfill from ESPN for NHL and MLB
async function backfillESPN(
  supabase: any,
  sport: string,
  startDate: string,
  endDate: string
): Promise<{ inserted: number; updated: number; errors: number }> {
  const baseUrl = ESPN_API_URLS[sport];
  if (!baseUrl) return { inserted: 0, updated: 0, errors: 0 };

  const counters = { inserted: 0, updated: 0, errors: 0 };

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0].replace(/-/g, "");
    const url = `${baseUrl}?dates=${dateStr}`;

    const response = await fetchWithRetry(url, { "Accept": "application/json" });
    if (!response) continue;

    const data = await response.json();

    for (const event of data.events || []) {
      if (!event.status?.type?.completed) continue;

      const competition = event.competitions?.[0];
      if (!competition) continue;

      const homeTeamRaw = competition.competitors.find((c: any) => c.homeAway === "home");
      const awayTeamRaw = competition.competitors.find((c: any) => c.homeAway === "away");
      if (!homeTeamRaw || !awayTeamRaw) continue;

      const homeAbbrev = homeTeamRaw.team.abbreviation;
      const awayAbbrev = awayTeamRaw.team.abbreviation;
      const homeScore = parseInt(homeTeamRaw.score, 10);
      const awayScore = parseInt(awayTeamRaw.score, 10);

      if (isNaN(homeScore) || isNaN(awayScore)) continue;

      const homeTeamId = await getOrCreateTeam(supabase, sport, homeAbbrev, "espn");
      const awayTeamId = await getOrCreateTeam(supabase, sport, awayAbbrev, "espn");
      const homeFranchiseId = await getOrCreateFranchise(supabase, sport, homeAbbrev);
      const awayFranchiseId = await getOrCreateFranchise(supabase, sport, awayAbbrev);

      if (!homeTeamId || !awayTeamId) {
        counters.errors++;
        continue;
      }

      const providerGameKey = `espn-${sport}-${event.id}`;
      const finalTotal = homeScore + awayScore;
      const seasonYear = event.season?.year || new Date(event.date).getFullYear();
      const decade = computeDecade(seasonYear);

      const { data: existing } = await supabase
        .from("games")
        .select("id, home_score, away_score")
        .eq("provider_game_key", providerGameKey)
        .maybeSingle();

      if (existing) {
        if (existing.home_score !== homeScore || existing.away_score !== awayScore) {
          await supabase
            .from("games")
            .update({
              home_score: homeScore,
              away_score: awayScore,
              status: "final",
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          await supabase
            .from("matchup_games")
            .update({ total: finalTotal })
            .eq("game_id", existing.id);

          counters.updated++;
        }
      } else {
        const { data: newGame, error: insertError } = await supabase
          .from("games")
          .insert({
            sport_id: sport,
            provider_game_key: providerGameKey,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_franchise_id: homeFranchiseId,
            away_franchise_id: awayFranchiseId,
            home_score: homeScore,
            away_score: awayScore,
            start_time_utc: event.date,
            status: "final",
            season_year: seasonYear,
            decade,
            is_playoff: event.season?.type === 3,
          })
          .select("id")
          .single();

        if (insertError) {
          counters.errors++;
          continue;
        }

        counters.inserted++;

        if (newGame) {
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
            played_at_utc: event.date,
            season_year: seasonYear,
            decade,
          });
        }
      }
    }

    await new Promise(r => setTimeout(r, 100));
  }

  return counters;
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
    let requestBody: { days_back?: number } = {};
    try {
      requestBody = await req.json();
    } catch {
      // Empty body OK
    }

    const daysBack = requestBody.days_back ?? 7;
    const bdlApiKey = Deno.env.get("BALLDONTLIE_KEY");

    if (!bdlApiKey) {
      throw new Error("BALLDONTLIE_KEY not configured");
    }

    // Calculate date range
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - daysBack + 1);

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    console.log(`[DAILY] Starting backfill from ${startDateStr} to ${endDateStr}`);

    // Create job run
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "daily-backfill",
        status: "running",
        details: { start_date: startDateStr, end_date: endDateStr },
      })
      .select("id")
      .single();

    const results: Record<string, { inserted: number; updated: number; errors: number }> = {};

    // NBA and NFL via BallDontLie (maximizing paid API)
    for (const sport of ["nba", "nfl"]) {
      console.log(`[DAILY] Backfilling ${sport} via BallDontLie`);
      results[sport] = await backfillBDL(supabase, bdlApiKey, sport, startDateStr, endDateStr);
    }

    // NHL and MLB via ESPN (free)
    for (const sport of ["nhl", "mlb"]) {
      console.log(`[DAILY] Backfilling ${sport} via ESPN`);
      results[sport] = await backfillESPN(supabase, sport, startDateStr, endDateStr);
    }

    // Update job run
    if (jobRun) {
      await supabase
        .from("job_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          details: {
            start_date: startDateStr,
            end_date: endDateStr,
            results,
          },
        })
        .eq("id", jobRun.id);
    }

    const totalInserted = Object.values(results).reduce((sum, r) => sum + r.inserted, 0);
    const totalUpdated = Object.values(results).reduce((sum, r) => sum + r.updated, 0);

    console.log(`[DAILY] Complete: ${totalInserted} inserted, ${totalUpdated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        start_date: startDateStr,
        end_date: endDateStr,
        inserted: totalInserted,
        updated: totalUpdated,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[DAILY] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
