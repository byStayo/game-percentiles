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

// ESPN abbreviation normalization - map all variants to canonical abbreviation
const ESPN_ABBREV_MAP: Record<string, Record<string, string>> = {
  nba: { "GS": "GSW", "NY": "NYK", "NO": "NOP", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS", "PHO": "PHX" },
  nfl: { "JAX": "JAC", "WSH": "WAS" },
  nhl: { "LA": "LAK", "UTAH": "UTA", "WSH": "WAS", "VGK": "VEG", "NAS": "NSH" },
  mlb: { "CHW": "CWS", "WSH": "WAS" },
};

// Canonical names for all 4 major sports
const FRANCHISE_MAPPINGS: Record<string, Record<string, string>> = {
  nba: {
    "ATL": "Atlanta Hawks", "BOS": "Boston Celtics", "BKN": "Brooklyn Nets", 
    "CHA": "Charlotte Hornets", "CHI": "Chicago Bulls", "CLE": "Cleveland Cavaliers",
    "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets", "DET": "Detroit Pistons",
    "GSW": "Golden State Warriors", "HOU": "Houston Rockets", "IND": "Indiana Pacers",
    "LAC": "LA Clippers", "LAL": "Los Angeles Lakers", "MEM": "Memphis Grizzlies",
    "MIA": "Miami Heat", "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans", "NYK": "New York Knicks", "OKC": "Oklahoma City Thunder",
    "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers", "PHX": "Phoenix Suns",
    "POR": "Portland Trail Blazers", "SAC": "Sacramento Kings", "SAS": "San Antonio Spurs",
    "TOR": "Toronto Raptors", "UTA": "Utah Jazz", "WAS": "Washington Wizards",
  },
  nfl: {
    "ARI": "Arizona Cardinals", "ATL": "Atlanta Falcons", "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills", "CAR": "Carolina Panthers", "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals", "CLE": "Cleveland Browns", "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos", "DET": "Detroit Lions", "GB": "Green Bay Packers",
    "HOU": "Houston Texans", "IND": "Indianapolis Colts", "JAC": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs", "LV": "Las Vegas Raiders", "LAC": "Los Angeles Chargers",
    "LAR": "Los Angeles Rams", "MIA": "Miami Dolphins", "MIN": "Minnesota Vikings",
    "NE": "New England Patriots", "NO": "New Orleans Saints", "NYG": "New York Giants",
    "NYJ": "New York Jets", "PHI": "Philadelphia Eagles", "PIT": "Pittsburgh Steelers",
    "SF": "San Francisco 49ers", "SEA": "Seattle Seahawks", "TB": "Tampa Bay Buccaneers",
    "TEN": "Tennessee Titans", "WAS": "Washington Commanders",
  },
  nhl: {
    "ANA": "Anaheim Ducks", "ARI": "Arizona Coyotes", "BOS": "Boston Bruins",
    "BUF": "Buffalo Sabres", "CGY": "Calgary Flames", "CAR": "Carolina Hurricanes",
    "CHI": "Chicago Blackhawks", "COL": "Colorado Avalanche", "CBJ": "Columbus Blue Jackets",
    "DAL": "Dallas Stars", "DET": "Detroit Red Wings", "EDM": "Edmonton Oilers",
    "FLA": "Florida Panthers", "LAK": "Los Angeles Kings", "MIN": "Minnesota Wild",
    "MTL": "Montreal Canadiens", "NSH": "Nashville Predators", "NJ": "New Jersey Devils",
    "NYI": "New York Islanders", "NYR": "New York Rangers", "OTT": "Ottawa Senators",
    "PHI": "Philadelphia Flyers", "PIT": "Pittsburgh Penguins", "SJ": "San Jose Sharks",
    "SEA": "Seattle Kraken", "STL": "St. Louis Blues", "TB": "Tampa Bay Lightning",
    "TOR": "Toronto Maple Leafs", "VAN": "Vancouver Canucks", "VEG": "Vegas Golden Knights",
    "WPG": "Winnipeg Jets", "WAS": "Washington Capitals", "UTA": "Utah Hockey Club",
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

// Normalize abbreviation using the mapping
function normalizeAbbrev(sport: string, rawAbbrev: string): string {
  const abbrevMap = ESPN_ABBREV_MAP[sport] || {};
  return abbrevMap[rawAbbrev] || rawAbbrev;
}

// Fetch games for a single date
async function fetchGamesForDate(sport: string, dateStr: string): Promise<ParsedGame[]> {
  const baseUrl = ESPN_SCOREBOARD_URLS[sport];
  if (!baseUrl) return [];

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

      const homeAbbrev = normalizeAbbrev(sport, homeTeam.team.abbreviation);
      const awayAbbrev = normalizeAbbrev(sport, awayTeam.team.abbreviation);

      // Skip if we don't have a mapping for this team (e.g., preseason/exhibition)
      const franchiseMap = FRANCHISE_MAPPINGS[sport] || {};
      if (!franchiseMap[homeAbbrev] || !franchiseMap[awayAbbrev]) {
        continue;
      }

      games.push({
        espnId: event.id,
        homeAbbrev,
        awayAbbrev,
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
  const batchSize = 30; // Fetch 30 dates at once

  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(d => fetchGamesForDate(sport, d)));
    for (const games of results) {
      allGames.push(...games);
    }
  }

  return allGames;
}

// Pre-load all teams and franchises for a sport
async function preloadTeamsAndFranchises(supabase: any, sport: string): Promise<{
  teamMap: Map<string, string>;
  franchiseMap: Map<string, string>;
}> {
  const teamMap = new Map<string, string>();
  const franchiseMap = new Map<string, string>();

  // Load all teams for this sport
  const { data: teams } = await supabase
    .from("teams")
    .select("id, abbrev")
    .eq("sport_id", sport);

  for (const team of teams || []) {
    if (team.abbrev) {
      teamMap.set(team.abbrev, team.id);
    }
  }

  // Load all franchises for this sport
  const { data: franchises } = await supabase
    .from("franchises")
    .select("id, canonical_name")
    .eq("sport_id", sport);

  // Create reverse mapping from canonical name to id
  const franchiseNameToId = new Map<string, string>();
  for (const franchise of franchises || []) {
    franchiseNameToId.set(franchise.canonical_name, franchise.id);
  }

  // Map abbreviation to franchise id using FRANCHISE_MAPPINGS
  const mapping = FRANCHISE_MAPPINGS[sport] || {};
  for (const [abbrev, canonicalName] of Object.entries(mapping)) {
    const franchiseId = franchiseNameToId.get(canonicalName);
    if (franchiseId) {
      franchiseMap.set(abbrev, franchiseId);
    }
  }

  return { teamMap, franchiseMap };
}

// Ensure team exists, create if not
async function ensureTeam(
  supabase: any,
  sport: string,
  abbrev: string,
  teamMap: Map<string, string>
): Promise<string | null> {
  if (teamMap.has(abbrev)) {
    return teamMap.get(abbrev)!;
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
    // Try to fetch if insert failed due to race condition
    const { data: existing } = await supabase
      .from("teams")
      .select("id")
      .eq("sport_id", sport)
      .eq("abbrev", abbrev)
      .maybeSingle();
    
    if (existing) {
      teamMap.set(abbrev, existing.id);
      return existing.id;
    }
    return null;
  }

  teamMap.set(abbrev, created.id);
  return created.id;
}

// Ensure franchise exists, create if not
async function ensureFranchise(
  supabase: any,
  sport: string,
  abbrev: string,
  franchiseMap: Map<string, string>
): Promise<string | null> {
  if (franchiseMap.has(abbrev)) {
    return franchiseMap.get(abbrev)!;
  }

  const mapping = FRANCHISE_MAPPINGS[sport] || {};
  const canonicalName = mapping[abbrev];
  if (!canonicalName) return null;

  const { data: created, error } = await supabase
    .from("franchises")
    .insert({ sport_id: sport, canonical_name: canonicalName })
    .select("id")
    .single();

  if (error) {
    // Try to fetch if insert failed due to race condition
    const { data: existing } = await supabase
      .from("franchises")
      .select("id")
      .eq("sport_id", sport)
      .eq("canonical_name", canonicalName)
      .maybeSingle();
    
    if (existing) {
      franchiseMap.set(abbrev, existing.id);
      return existing.id;
    }
    return null;
  }

  franchiseMap.set(abbrev, created.id);
  return created.id;
}

// Process games and insert using bulk operations
async function processAndInsertGames(
  supabase: any, 
  sport: string, 
  games: ParsedGame[]
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Pre-load teams and franchises
  const { teamMap, franchiseMap } = await preloadTeamsAndFranchises(supabase, sport);
  console.log(`[CHUNK] Preloaded ${teamMap.size} teams, ${franchiseMap.size} franchises for ${sport}`);

  // Get existing game keys to skip
  const gameKeys = games.map(g => `espn-${sport}-${g.espnId}`);
  
  // Query in batches of 500 to avoid query size limits
  const existingKeys = new Set<string>();
  for (let i = 0; i < gameKeys.length; i += 500) {
    const batch = gameKeys.slice(i, i + 500);
    const { data: existingGames } = await supabase
      .from("games")
      .select("provider_game_key")
      .in("provider_game_key", batch);
    
    for (const g of existingGames || []) {
      existingKeys.add(g.provider_game_key);
    }
  }

  const newGames = games.filter(g => !existingKeys.has(`espn-${sport}-${g.espnId}`));
  skipped = games.length - newGames.length;
  console.log(`[CHUNK] ${newGames.length} new games to insert, ${skipped} already exist`);

  if (newGames.length === 0) {
    return { inserted, skipped, errors };
  }

  // Prepare all games for bulk insert
  const gamesToInsert: any[] = [];
  const matchupsToInsert: any[] = [];

  for (const game of newGames) {
    const homeTeamId = await ensureTeam(supabase, sport, game.homeAbbrev, teamMap);
    const awayTeamId = await ensureTeam(supabase, sport, game.awayAbbrev, teamMap);
    const homeFranchiseId = await ensureFranchise(supabase, sport, game.homeAbbrev, franchiseMap);
    const awayFranchiseId = await ensureFranchise(supabase, sport, game.awayAbbrev, franchiseMap);

    if (!homeTeamId || !awayTeamId) {
      errors++;
      continue;
    }

    const finalTotal = game.homeScore + game.awayScore;
    const decade = computeDecade(game.seasonYear);
    const providerGameKey = `espn-${sport}-${game.espnId}`;

    gamesToInsert.push({
      sport_id: sport,
      provider_game_key: providerGameKey,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_score: game.homeScore,
      away_score: game.awayScore,
      // Note: final_total is a generated column, don't include it
      start_time_utc: game.startTimeUtc,
      status: "final",
      season_year: game.seasonYear,
      decade,
      is_playoff: game.isPlayoff,
      home_franchise_id: homeFranchiseId,
      away_franchise_id: awayFranchiseId,
      _espn_id: game.espnId, // Temporary for linking matchups
      _home_team_id: homeTeamId,
      _away_team_id: awayTeamId,
      _home_franchise_id: homeFranchiseId,
      _away_franchise_id: awayFranchiseId,
    });
  }

  // Insert games in batches
  const batchSize = 100;
  for (let i = 0; i < gamesToInsert.length; i += batchSize) {
    const batch = gamesToInsert.slice(i, i + batchSize);
    
    // Remove temporary fields before insert
    const cleanBatch = batch.map(g => {
      const { _espn_id, _home_team_id, _away_team_id, _home_franchise_id, _away_franchise_id, ...clean } = g;
      return clean;
    });

    const { data: insertedGames, error: insertError } = await supabase
      .from("games")
      .insert(cleanBatch)
      .select("id, provider_game_key");

    if (insertError) {
      console.log(`[CHUNK] Batch insert error:`, insertError.message);
      // Try individual inserts for this batch
      for (const game of cleanBatch) {
        const { data: single, error: singleErr } = await supabase
          .from("games")
          .insert(game)
          .select("id")
          .single();
        
        if (singleErr) {
          if (singleErr.message?.includes("duplicate")) skipped++;
          else errors++;
        } else if (single) {
          inserted++;
          // Find original game data for matchup
          const orig = batch.find(b => b.provider_game_key === game.provider_game_key);
          if (orig) {
            const [teamLowId, teamHighId] = [orig._home_team_id, orig._away_team_id].sort();
            const [franchiseLowId, franchiseHighId] = orig._home_franchise_id && orig._away_franchise_id
              ? [orig._home_franchise_id, orig._away_franchise_id].sort()
              : [null, null];

            matchupsToInsert.push({
              game_id: single.id,
              sport_id: sport,
              team_low_id: teamLowId,
              team_high_id: teamHighId,
              franchise_low_id: franchiseLowId,
              franchise_high_id: franchiseHighId,
              total: game.home_score + game.away_score,
              played_at_utc: game.start_time_utc,
              season_year: game.season_year,
              decade: game.decade,
            });
          }
        }
      }
    } else if (insertedGames) {
      inserted += insertedGames.length;
      
      // Create matchup records for inserted games
      for (const insertedGame of insertedGames) {
        const orig = batch.find(b => b.provider_game_key === insertedGame.provider_game_key);
        if (orig) {
          const [teamLowId, teamHighId] = [orig._home_team_id, orig._away_team_id].sort();
          const [franchiseLowId, franchiseHighId] = orig._home_franchise_id && orig._away_franchise_id
            ? [orig._home_franchise_id, orig._away_franchise_id].sort()
            : [null, null];

          matchupsToInsert.push({
            game_id: insertedGame.id,
            sport_id: sport,
            team_low_id: teamLowId,
            team_high_id: teamHighId,
            franchise_low_id: franchiseLowId,
            franchise_high_id: franchiseHighId,
            total: orig.home_score + orig.away_score,
            played_at_utc: orig.start_time_utc,
            season_year: orig.season_year,
            decade: orig.decade,
          });
        }
      }
    }
  }

  // Insert matchups in batches
  for (let i = 0; i < matchupsToInsert.length; i += 100) {
    const batch = matchupsToInsert.slice(i, i + 100);
    await supabase.from("matchup_games").insert(batch);
  }

  console.log(`[CHUNK] Inserted ${matchupsToInsert.length} matchup records`);

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
    console.log(`[CHUNK] Fetched ${games.length} completed games for ${sport} ${year}`);

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
    console.error("[CHUNK] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
