import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BallDontLie API endpoints - maximizing GOAT tier
const BDL_ENDPOINTS = {
  nba: "https://api.balldontlie.io/v1",
  nfl: "https://api.balldontlie.io/nfl/v1",
  nhl: "https://api.balldontlie.io/nhl/v1",
  mlb: "https://api.balldontlie.io/mlb/v1",
};

// Franchise mappings for consistent team identity across all sports
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
};

// BDL data interfaces
interface BDLGame {
  id: number;
  date: string;
  datetime?: string;
  season: number;
  status: string;
  postseason: boolean;
  home_team: { id: number; abbreviation: string; full_name: string; name: string };
  visitor_team: { id: number; abbreviation: string; full_name: string; name: string };
  home_team_score: number | null;
  visitor_team_score: number | null;
  week?: number;
}

interface BDLOdds {
  id: number;
  game_id: number;
  vendor: string;
  total_value: string;
  total_over_odds: number;
  total_under_odds: number;
  spread_value?: string;
  spread_home_odds?: number;
  spread_away_odds?: number;
  moneyline_home?: number;
  moneyline_away?: number;
  updated_at: string;
}

interface BDLInjury {
  id: number;
  player_id: number;
  first_name: string;
  last_name: string;
  position: string;
  team: { id: number; abbreviation: string };
  status: string;
  injury_type?: string;
  description?: string;
  report_date?: string;
  game_date?: string;
}

interface BDLStanding {
  team: { id: number; abbreviation: string; full_name: string };
  conference: string;
  division: string;
  wins: number;
  losses: number;
  win_pct?: number;
  games_back?: number;
  conference_wins?: number;
  conference_losses?: number;
  division_wins?: number;
  division_losses?: number;
  home_wins?: number;
  home_losses?: number;
  away_wins?: number;
  away_losses?: number;
  last_10?: string;
  streak?: string;
  points_for?: number;
  points_against?: number;
}

// Retry helper optimized for high-speed BDL GOAT tier (600 req/min)
async function fetchWithRetry(
  url: string,
  apiKey: string,
  maxRetries = 5,
  baseDelay = 100
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
        const delay = Math.min(baseDelay * Math.pow(2, attempt), 5000);
        console.log(`[BDL-SYNC] Rate limited, waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (response.status >= 500) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[BDL-SYNC] Server error ${response.status}, retry ${attempt + 1}/${maxRetries}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      console.error(`[BDL-SYNC] API error ${response.status}: ${await response.text().catch(() => "Unknown")}`);
      return null;
    } catch (err) {
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[BDL-SYNC] Network error, retry ${attempt + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return null;
}

// Parallel fetch helper to maximize API throughput
async function fetchParallel<T>(
  urls: string[],
  apiKey: string,
  concurrency = 10
): Promise<(T[] | null)[]> {
  const results: (T[] | null)[] = [];
  
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const response = await fetchWithRetry(url, apiKey);
        if (!response) return null;
        const data = await response.json();
        return data.data || [];
      })
    );
    results.push(...batchResults);
    
    // Small delay between batches to stay under 600 req/min
    if (i + concurrency < urls.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  return results;
}

// Caches for team/franchise lookups
const franchiseCache = new Map<string, string>();
const teamCache = new Map<string, string>();

async function ensureTeamAndFranchise(
  supabase: any,
  sport: string,
  abbrev: string
): Promise<{ teamId: string | null; franchiseId: string | null }> {
  const cacheKey = `${sport}:${abbrev}`;
  const mapping = FRANCHISE_MAPPINGS[sport] || {};
  const canonicalName = mapping[abbrev];

  if (!canonicalName) {
    return { teamId: null, franchiseId: null };
  }

  // Get or create franchise
  let franchiseId = franchiseCache.get(cacheKey);
  if (!franchiseId) {
    const { data: existing } = await supabase
      .from("franchises")
      .select("id")
      .eq("sport_id", sport)
      .eq("canonical_name", canonicalName)
      .maybeSingle();

    if (existing) {
      franchiseId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("franchises")
        .insert({ sport_id: sport, canonical_name: canonicalName })
        .select("id")
        .single();
      franchiseId = created?.id;
    }
    if (franchiseId) franchiseCache.set(cacheKey, franchiseId);
  }

  // Get or create team
  let teamId = teamCache.get(cacheKey);
  if (!teamId) {
    const { data: existing } = await supabase
      .from("teams")
      .select("id")
      .eq("sport_id", sport)
      .eq("abbrev", abbrev)
      .maybeSingle();

    if (existing) {
      teamId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("teams")
        .insert({
          sport_id: sport,
          provider_team_key: `bdl-${sport}-${abbrev}`,
          name: canonicalName,
          abbrev,
        })
        .select("id")
        .single();
      teamId = created?.id;
    }
    if (teamId) teamCache.set(cacheKey, teamId);
  }

  return { teamId: teamId || null, franchiseId: franchiseId || null };
}

function computeDecade(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

function getCurrentSeason(sport: string): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  if (sport === "nfl") {
    return month >= 3 ? year : year - 1;
  } else {
    return month >= 10 ? year : year - 1;
  }
}

function getCurrentNFLWeek(): number {
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 8, 5);
  if (now < seasonStart) return 1;
  const diffDays = Math.floor((now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(Math.floor(diffDays / 7) + 1, 22); // Include playoffs
}

// =========================================================================
// SYNC FUNCTIONS - Maximizing BallDontLie GOAT tier
// =========================================================================

// Backfill missing franchise IDs for games that have teams but no franchise mappings
async function backfillFranchiseIds(
  supabase: any,
  sport: string,
  dates: string[]
): Promise<{ fixed: number; errors: number }> {
  const counters = { fixed: 0, errors: 0 };
  
  // Find games for these dates with missing franchise IDs
  const dateStart = dates[0];
  const dateEnd = dates[dates.length - 1];
  
  const { data: gamesWithMissingFranchises } = await supabase
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
    .or("home_franchise_id.is.null,away_franchise_id.is.null");

  if (!gamesWithMissingFranchises || gamesWithMissingFranchises.length === 0) {
    return counters;
  }

  console.log(`[BDL-SYNC] Found ${gamesWithMissingFranchises.length} ${sport} games with missing franchise IDs`);

  for (const game of gamesWithMissingFranchises) {
    const updates: { home_franchise_id?: string; away_franchise_id?: string } = {};
    
    // Fix home franchise if missing
    if (!game.home_franchise_id && game.home_team?.abbrev) {
      const mapping = FRANCHISE_MAPPINGS[sport];
      const canonicalName = mapping?.[game.home_team.abbrev];
      
      if (canonicalName) {
        const { data: franchise } = await supabase
          .from("franchises")
          .select("id")
          .eq("sport_id", sport)
          .eq("canonical_name", canonicalName)
          .maybeSingle();
        
        if (franchise) {
          updates.home_franchise_id = franchise.id;
        }
      }
    }
    
    // Fix away franchise if missing
    if (!game.away_franchise_id && game.away_team?.abbrev) {
      const mapping = FRANCHISE_MAPPINGS[sport];
      const canonicalName = mapping?.[game.away_team.abbrev];
      
      if (canonicalName) {
        const { data: franchise } = await supabase
          .from("franchises")
          .select("id")
          .eq("sport_id", sport)
          .eq("canonical_name", canonicalName)
          .maybeSingle();
        
        if (franchise) {
          updates.away_franchise_id = franchise.id;
        }
      }
    }
    
    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("games")
        .update(updates)
        .eq("id", game.id);
      
      if (error) {
        counters.errors++;
      } else {
        counters.fixed++;
        
        // Also update matchup_games if it exists
        if (updates.home_franchise_id || updates.away_franchise_id) {
          const newHomeFranchise = updates.home_franchise_id || game.home_franchise_id;
          const newAwayFranchise = updates.away_franchise_id || game.away_franchise_id;
          
          if (newHomeFranchise && newAwayFranchise) {
            const [franchiseLowId, franchiseHighId] = [newHomeFranchise, newAwayFranchise].sort();
            
            await supabase
              .from("matchup_games")
              .update({
                franchise_low_id: franchiseLowId,
                franchise_high_id: franchiseHighId,
              })
              .eq("game_id", game.id);
          }
        }
      }
    }
  }
  
  if (counters.fixed > 0) {
    console.log(`[BDL-SYNC] Fixed ${counters.fixed} ${sport} games with missing franchise IDs`);
  }
  
  return counters;
}

async function syncGames(
  supabase: any,
  apiKey: string,
  sport: string,
  dates: string[]
): Promise<{ fetched: number; upserted: number; errors: number; bdlToDbMap: Map<number, string> }> {
  const baseUrl = BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS];
  if (!baseUrl) return { fetched: 0, upserted: 0, errors: 0, bdlToDbMap: new Map() };

  const counters = { fetched: 0, upserted: 0, errors: 0 };
  const bdlToDbMap = new Map<number, string>();

  // Fetch games with pagination
  const datesParam = dates.map(d => `dates[]=${d}`).join("&");
  let cursor: number | null = null;
  const games: BDLGame[] = [];

  while (true) {
    let url = `${baseUrl}/games?${datesParam}&per_page=100`;
    if (cursor) url += `&cursor=${cursor}`;

    const response = await fetchWithRetry(url, apiKey);
    if (!response) break;

    const data = await response.json();
    games.push(...(data.data || []));

    const nextCursor = data.meta?.next_cursor;
    if (!nextCursor) break;
    cursor = nextCursor;
    await new Promise(r => setTimeout(r, 50));
  }

  counters.fetched = games.length;
  console.log(`[BDL-SYNC] Fetched ${games.length} ${sport} games for dates: ${dates.slice(0, 3).join(", ")}...`);

  for (const game of games) {
    const homeAbbrev = game.home_team?.abbreviation;
    const awayAbbrev = game.visitor_team?.abbreviation;

    if (!homeAbbrev || !awayAbbrev) {
      counters.errors++;
      continue;
    }

    const home = await ensureTeamAndFranchise(supabase, sport, homeAbbrev);
    const away = await ensureTeamAndFranchise(supabase, sport, awayAbbrev);

    if (!home.teamId || !away.teamId) {
      counters.errors++;
      continue;
    }

    const providerGameKey = `bdl-${sport}-${game.id}`;
    const startTimeUtc = game.datetime || game.date;
    const isFinal = game.status === "Final" || game.status?.includes("Final");
    const homeScore = game.home_team_score;
    const awayScore = game.visitor_team_score;

    const gameData = {
      sport_id: sport,
      provider_game_key: providerGameKey,
      start_time_utc: startTimeUtc,
      home_team_id: home.teamId,
      away_team_id: away.teamId,
      home_franchise_id: home.franchiseId,
      away_franchise_id: away.franchiseId,
      home_score: isFinal ? homeScore : null,
      away_score: isFinal ? awayScore : null,
      status: isFinal ? "final" : game.status?.toLowerCase() === "scheduled" ? "scheduled" : "live",
      season_year: game.season,
      decade: computeDecade(game.season),
      is_playoff: game.postseason || false,
      week_round: game.week || null,
      last_seen_at: new Date().toISOString(),
    };

    const { data: existingGame } = await supabase
      .from("games")
      .select("id")
      .eq("sport_id", sport)
      .eq("provider_game_key", providerGameKey)
      .maybeSingle();

    let gameId: string | null = null;

    if (existingGame) {
      const { error: updateError } = await supabase
        .from("games")
        .update({
          start_time_utc: startTimeUtc,
          home_score: isFinal ? homeScore : null,
          away_score: isFinal ? awayScore : null,
          status: gameData.status,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existingGame.id);

      if (updateError) {
        counters.errors++;
        continue;
      }
      gameId = existingGame.id;
    } else {
      const { data: created, error: insertError } = await supabase
        .from("games")
        .insert(gameData)
        .select("id")
        .single();

      if (insertError) {
        counters.errors++;
        continue;
      }
      gameId = created?.id;
    }

    if (gameId) {
      counters.upserted++;
      bdlToDbMap.set(game.id, gameId);

      // Upsert matchup_games for final games
      if (isFinal && homeScore !== null && awayScore !== null) {
        const [teamLowId, teamHighId] = [home.teamId, away.teamId].sort();
        const [franchiseLowId, franchiseHighId] = [home.franchiseId, away.franchiseId]
          .filter(Boolean)
          .sort() as [string | null, string | null];

        await supabase
          .from("matchup_games")
          .upsert({
            sport_id: sport,
            team_low_id: teamLowId,
            team_high_id: teamHighId,
            franchise_low_id: franchiseLowId || null,
            franchise_high_id: franchiseHighId || null,
            game_id: gameId,
            played_at_utc: startTimeUtc,
            total: homeScore + awayScore,
            season_year: game.season,
            decade: computeDecade(game.season),
          }, { onConflict: "game_id", ignoreDuplicates: true });
      }
    }
  }

  return { ...counters, bdlToDbMap };
}

async function syncOdds(
  supabase: any,
  apiKey: string,
  sport: string,
  bdlToDbMap: Map<number, string>
): Promise<{ fetched: number; matched: number; errors: number }> {
  const baseUrl = BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS];
  if (!baseUrl) return { fetched: 0, matched: 0, errors: 0 };

  const counters = { fetched: 0, matched: 0, errors: 0 };
  const season = getCurrentSeason(sport);
  const week = sport === "nfl" ? getCurrentNFLWeek() : null;

  let url = `${baseUrl}/odds?season=${season}&per_page=100`;
  if (week) url += `&week=${week}`;

  const odds: BDLOdds[] = [];
  let cursor: number | null = null;

  while (true) {
    const pageUrl = cursor ? `${url}&cursor=${cursor}` : url;
    const response = await fetchWithRetry(pageUrl, apiKey);
    if (!response) break;

    const data = await response.json();
    odds.push(...(data.data || []));

    const nextCursor = data.meta?.next_cursor;
    if (!nextCursor) break;
    cursor = nextCursor;
    await new Promise(r => setTimeout(r, 50));
  }

  counters.fetched = odds.length;
  console.log(`[BDL-SYNC] Fetched ${odds.length} ${sport} odds entries`);

  // Group odds by game_id, prefer DraftKings
  const oddsMap = new Map<number, BDLOdds>();
  for (const odd of odds) {
    const existing = oddsMap.get(odd.game_id);
    if (!existing || odd.vendor?.toLowerCase().includes("draft")) {
      oddsMap.set(odd.game_id, odd);
    }
  }

  for (const [bdlGameId, odd] of oddsMap) {
    const dbGameId = bdlToDbMap.get(bdlGameId);
    if (!dbGameId) continue;

    const totalLine = parseFloat(odd.total_value);
    if (isNaN(totalLine)) continue;

    const { error } = await supabase
      .from("odds_snapshots")
      .insert({
        game_id: dbGameId,
        bookmaker: odd.vendor || "draftkings",
        market: "totals",
        total_line: totalLine,
        raw_payload: {
          source: "balldontlie",
          total_over_odds: odd.total_over_odds,
          total_under_odds: odd.total_under_odds,
          spread_value: odd.spread_value,
          spread_home_odds: odd.spread_home_odds,
          spread_away_odds: odd.spread_away_odds,
          moneyline_home: odd.moneyline_home,
          moneyline_away: odd.moneyline_away,
        },
      });

    if (!error) {
      counters.matched++;
    } else {
      counters.errors++;
    }
  }

  return counters;
}

async function syncInjuries(
  supabase: any,
  apiKey: string,
  sport: string
): Promise<{ fetched: number; upserted: number; errors: number }> {
  const baseUrl = BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS];
  if (!baseUrl) return { fetched: 0, upserted: 0, errors: 0 };

  const counters = { fetched: 0, upserted: 0, errors: 0 };

  const response = await fetchWithRetry(`${baseUrl}/player_injuries?per_page=250`, apiKey);
  if (!response) return counters;

  const data = await response.json();
  const injuries: BDLInjury[] = data.data || [];
  counters.fetched = injuries.length;

  console.log(`[BDL-SYNC] Fetched ${injuries.length} ${sport} injuries`);

  const today = new Date().toISOString().split("T")[0];
  const season = getCurrentSeason(sport);

  for (const injury of injuries) {
    const { teamId } = await ensureTeamAndFranchise(supabase, sport, injury.team?.abbreviation || "");

    const injuryData = {
      sport_id: sport,
      team_id: teamId,
      player_external_id: `bdl-${sport}-${injury.player_id}`,
      player_name: `${injury.first_name} ${injury.last_name}`,
      position: injury.position,
      injury_status: injury.status || "Unknown",
      injury_type: injury.injury_type,
      injury_details: injury.description,
      report_date: injury.report_date || today,
      game_date: injury.game_date || today,
      season_year: season,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("player_injuries")
      .upsert(injuryData, {
        onConflict: "sport_id,player_external_id,game_date",
        ignoreDuplicates: false,
      });

    if (!error) {
      counters.upserted++;
    } else {
      counters.errors++;
    }
  }

  return counters;
}

async function syncStandings(
  supabase: any,
  apiKey: string,
  sport: string
): Promise<{ fetched: number; upserted: number; errors: number }> {
  const baseUrl = BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS];
  if (!baseUrl) return { fetched: 0, upserted: 0, errors: 0 };

  const counters = { fetched: 0, upserted: 0, errors: 0 };
  const season = getCurrentSeason(sport);

  const response = await fetchWithRetry(`${baseUrl}/standings?season=${season}`, apiKey);
  if (!response) return counters;

  const data = await response.json();
  const standings: BDLStanding[] = data.data || [];
  counters.fetched = standings.length;

  console.log(`[BDL-SYNC] Fetched ${standings.length} ${sport} standings`);

  for (const standing of standings) {
    const abbrev = standing.team?.abbreviation;
    if (!abbrev) continue;

    const { teamId } = await ensureTeamAndFranchise(supabase, sport, abbrev);

    const standingData = {
      sport_id: sport,
      team_id: teamId,
      team_abbrev: abbrev,
      season_year: season,
      conference: standing.conference,
      division: standing.division,
      wins: standing.wins || 0,
      losses: standing.losses || 0,
      win_pct: standing.win_pct,
      games_back: standing.games_back,
      conf_wins: standing.conference_wins || 0,
      conf_losses: standing.conference_losses || 0,
      div_wins: standing.division_wins || 0,
      div_losses: standing.division_losses || 0,
      home_wins: standing.home_wins || 0,
      home_losses: standing.home_losses || 0,
      away_wins: standing.away_wins || 0,
      away_losses: standing.away_losses || 0,
      streak: standing.streak,
      last_10: standing.last_10,
      points_for: standing.points_for,
      points_against: standing.points_against,
      point_diff: standing.points_for && standing.points_against
        ? standing.points_for - standing.points_against
        : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("team_standings")
      .upsert(standingData, {
        onConflict: "sport_id,team_abbrev,season_year",
        ignoreDuplicates: false,
      });

    if (!error) {
      counters.upserted++;
    } else {
      counters.errors++;
    }
  }

  return counters;
}

// =========================================================================
// MAIN HANDLER
// =========================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const counters = {
    games: { fetched: 0, upserted: 0, errors: 0 },
    odds: { fetched: 0, matched: 0, errors: 0 },
    injuries: { fetched: 0, upserted: 0, errors: 0 },
    standings: { fetched: 0, upserted: 0, errors: 0 },
    franchises: { fixed: 0, errors: 0 },
  };

  let jobRunId: number | null = null;
  const startTime = Date.now();

  try {
    const apiKey = Deno.env.get("BALLDONTLIE_KEY");
    if (!apiKey) {
      throw new Error("BALLDONTLIE_KEY not configured");
    }

    let requestBody: {
      dates?: string[];
      days_ahead?: number;
      days_back?: number;
      sports?: string[];
      sync_games?: boolean;
      sync_odds?: boolean;
      sync_injuries?: boolean;
      sync_standings?: boolean;
    } = {};

    try {
      requestBody = await req.json();
    } catch {
      // Empty body OK
    }

    // Build date list
    const daysAhead = requestBody.days_ahead ?? 7;
    const daysBack = requestBody.days_back ?? 1;
    const dates: string[] = requestBody.dates || [];

    if (dates.length === 0) {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      // Include past days for score updates
      for (let i = -daysBack; i < daysAhead; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        dates.push(formatter.format(date));
      }
    }

    const sports = requestBody.sports || ["nfl", "nba"];
    const syncGamesFlag = requestBody.sync_games !== false;
    const syncOddsFlag = requestBody.sync_odds !== false;
    const syncInjuriesFlag = requestBody.sync_injuries !== false;
    const syncStandingsFlag = requestBody.sync_standings !== false;

    console.log(`[BDL-SYNC] Starting unified sync for ${sports.join(", ")}`);
    console.log(`[BDL-SYNC] Dates: ${dates.slice(0, 3).join(", ")}... (${dates.length} total)`);
    console.log(`[BDL-SYNC] Flags: games=${syncGamesFlag}, odds=${syncOddsFlag}, injuries=${syncInjuriesFlag}, standings=${syncStandingsFlag}`);

    // Create job run
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "bdl-sync",
        details: { dates, sports, sync_games: syncGamesFlag, sync_odds: syncOddsFlag },
      })
      .select()
      .single();

    jobRunId = jobRun?.id || null;

    // Process each sport
    for (const sport of sports) {
      if (!BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS]) continue;

      console.log(`[BDL-SYNC] Processing ${sport}...`);

      // 1. Sync games first (needed for odds matching)
      let bdlToDbMap = new Map<number, string>();
      if (syncGamesFlag) {
        const result = await syncGames(supabase, apiKey, sport, dates);
        counters.games.fetched += result.fetched;
        counters.games.upserted += result.upserted;
        counters.games.errors += result.errors;
        bdlToDbMap = result.bdlToDbMap;
        
        // 1b. Backfill any missing franchise IDs (fixes edge cases)
        const franchiseResult = await backfillFranchiseIds(supabase, sport, dates);
        counters.franchises.fixed += franchiseResult.fixed;
        counters.franchises.errors += franchiseResult.errors;
      }

      // 2. Sync odds (uses game mapping)
      if (syncOddsFlag && bdlToDbMap.size > 0) {
        const result = await syncOdds(supabase, apiKey, sport, bdlToDbMap);
        counters.odds.fetched += result.fetched;
        counters.odds.matched += result.matched;
        counters.odds.errors += result.errors;
      }

      // 3. Sync injuries (GOAT tier exclusive)
      if (syncInjuriesFlag) {
        const result = await syncInjuries(supabase, apiKey, sport);
        counters.injuries.fetched += result.fetched;
        counters.injuries.upserted += result.upserted;
        counters.injuries.errors += result.errors;
      }

      // 4. Sync standings
      if (syncStandingsFlag) {
        const result = await syncStandings(supabase, apiKey, sport);
        counters.standings.fetched += result.fetched;
        counters.standings.upserted += result.upserted;
        counters.standings.errors += result.errors;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Update job run
    if (jobRunId) {
      await supabase
        .from("job_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          details: {
            dates_count: dates.length,
            sports,
            duration_seconds: Number(duration),
            counters,
          },
        })
        .eq("id", jobRunId);
    }

    console.log(`[BDL-SYNC] Complete in ${duration}s:`, JSON.stringify(counters));

    return new Response(
      JSON.stringify({
        success: true,
        duration_seconds: Number(duration),
        sports,
        dates_count: dates.length,
        counters,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BDL-SYNC] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    if (jobRunId) {
      await supabase
        .from("job_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          details: { error: message, counters },
        })
        .eq("id", jobRunId);
    }

    return new Response(
      JSON.stringify({ success: false, error: message, counters }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
