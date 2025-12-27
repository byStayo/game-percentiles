import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ESPN Scoreboard API URLs
const ESPN_SCOREBOARD_URLS: Record<string, string> = {
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  nhl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
};

// ESPN abbreviation normalization
const ESPN_ABBREV_MAP: Record<string, Record<string, string>> = {
  nba: { "GS": "GSW", "NY": "NYK", "NO": "NOP", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS" },
  nfl: { "JAX": "JAC", "WSH": "WAS" },
  nhl: { "LA": "LAK", "UTAH": "UTA", "WSH": "WAS", "VGK": "VEG", "NAS": "NSH" },
  mlb: { "CHW": "CWS", "WSH": "WAS" },
};

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
    "HOU": "Houston Texans", "IND": "Indianapolis Colts", "JAC": "Jacksonville Jaguars",
    "JAX": "Jacksonville Jaguars", "KC": "Kansas City Chiefs",
    "LV": "Las Vegas Raiders", "LAC": "Los Angeles Chargers", "LAR": "Los Angeles Rams",
    "MIA": "Miami Dolphins", "MIN": "Minnesota Vikings", "NE": "New England Patriots",
    "NO": "New Orleans Saints", "NYG": "New York Giants", "NYJ": "New York Jets",
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
    "NAS": "Nashville Predators", "NJ": "New Jersey Devils",
    "NYI": "New York Islanders", "NYR": "New York Rangers", "OTT": "Ottawa Senators",
    "PHI": "Philadelphia Flyers", "PIT": "Pittsburgh Penguins", "SJ": "San Jose Sharks",
    "SEA": "Seattle Kraken", "STL": "St. Louis Blues", "TB": "Tampa Bay Lightning",
    "TOR": "Toronto Maple Leafs", "VAN": "Vancouver Canucks", "VGK": "Vegas Golden Knights",
    "VEG": "Vegas Golden Knights", "WPG": "Winnipeg Jets", "WSH": "Washington Capitals",
    "WAS": "Washington Capitals",
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
  },
};

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

// Fetch games for a single date
async function fetchGamesForDate(sport: string, dateStr: string): Promise<ParsedGame[]> {
  const baseUrl = ESPN_SCOREBOARD_URLS[sport];
  if (!baseUrl) return [];

  const abbrevMap = ESPN_ABBREV_MAP[sport] || {};
  const espnDate = dateStr.replace(/-/g, "");
  const url = `${baseUrl}?dates=${espnDate}`;

  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) return [];

    const data = await response.json();
    const games: ParsedGame[] = [];

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
    return [];
  }
}

// Fetch games in parallel batches
async function fetchGamesParallel(sport: string, dates: string[]): Promise<ParsedGame[]> {
  const allGames: ParsedGame[] = [];
  const batchSize = 20; // Fetch 20 dates at once

  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(d => fetchGamesForDate(sport, d)));
    for (const games of results) {
      allGames.push(...games);
    }
  }

  return allGames;
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

// Process games and insert
async function processAndInsertGames(
  supabase: any, 
  sport: string, 
  games: ParsedGame[]
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Get existing game keys
  const gameKeys = games.map(g => `espn-${sport}-${g.espnId}`);
  const { data: existingGames } = await supabase
    .from("games")
    .select("provider_game_key")
    .in("provider_game_key", gameKeys);

  const existingKeys = new Set((existingGames || []).map((g: any) => g.provider_game_key));
  const newGames = games.filter(g => !existingKeys.has(`espn-${sport}-${g.espnId}`));
  skipped = games.length - newGames.length;

  // Process in batches
  const batchSize = 100;
  for (let i = 0; i < newGames.length; i += batchSize) {
    const batch = newGames.slice(i, i + batchSize);
    
    for (const game of batch) {
      try {
        const homeFranchiseId = await getOrCreateFranchise(supabase, sport, game.homeAbbrev);
        const awayFranchiseId = await getOrCreateFranchise(supabase, sport, game.awayAbbrev);
        const homeTeamId = await getOrCreateTeam(supabase, sport, game.homeAbbrev);
        const awayTeamId = await getOrCreateTeam(supabase, sport, game.awayAbbrev);

        if (!homeTeamId || !awayTeamId) {
          skipped++;
          continue;
        }

        const finalTotal = game.homeScore + game.awayScore;
        const decade = computeDecade(game.seasonYear);
        const providerGameKey = `espn-${sport}-${game.espnId}`;

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
          if (gameError.message?.includes("duplicate")) skipped++;
          else errors++;
          continue;
        }

        // Insert matchup
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
        errors++;
      }
    }
  }

  return { inserted, skipped, errors };
}

// Generate dates for a year range
function generateDatesForYear(sport: string, year: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  let start: Date;
  let end: Date;

  switch (sport) {
    case "nba":
      start = new Date(year - 1, 9, 15); // Oct 15
      end = new Date(year, 5, 30); // June 30
      break;
    case "nfl":
      start = new Date(year, 8, 1); // Sep 1
      end = new Date(year + 1, 1, 15); // Feb 15
      break;
    case "nhl":
      start = new Date(year - 1, 9, 1); // Oct 1
      end = new Date(year, 5, 30); // June 30
      break;
    case "mlb":
      start = new Date(year, 2, 20); // Mar 20
      end = new Date(year, 10, 10); // Nov 10
      break;
    default:
      return dates;
  }

  if (end > today) end = today;
  if (start > today) return dates;

  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const sport = body.sport || "nba";
    const year = body.year || new Date().getFullYear();

    console.log(`[CHUNK] Starting ${sport} backfill for year ${year}`);

    const dates = generateDatesForYear(sport, year);
    console.log(`[CHUNK] Generated ${dates.length} dates for ${sport} ${year}`);

    if (dates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No dates to process", sport, year }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch games
    const games = await fetchGamesParallel(sport, dates);
    console.log(`[CHUNK] Fetched ${games.length} games for ${sport} ${year}`);

    // Insert games
    const result = await processAndInsertGames(supabase, sport, games);
    console.log(`[CHUNK] ${sport} ${year}: inserted=${result.inserted}, skipped=${result.skipped}, errors=${result.errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        sport,
        year,
        dates_processed: dates.length,
        games_found: games.length,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.log("[CHUNK] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
