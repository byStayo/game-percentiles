import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ESPN Scoreboard API URLs - we'll search historical dates
const ESPN_SCOREBOARD_URLS: Record<string, string> = {
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  nhl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
};

// ESPN abbreviation normalization
const ESPN_ABBREV_MAP: Record<string, Record<string, string>> = {
  nba: { "GS": "GSW", "NY": "NYK", "NO": "NOP", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS", "PHO": "PHX" },
  nfl: { "JAX": "JAC", "WSH": "WAS" },
  nhl: { "LA": "LAK", "UTAH": "UTA", "WSH": "WAS", "VGK": "VEG", "NAS": "NSH" },
  mlb: { "CHW": "CWS", "WSH": "WAS" },
};

// Canonical names for franchises
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

function normalizeAbbrev(sport: string, rawAbbrev: string): string {
  const abbrevMap = ESPN_ABBREV_MAP[sport] || {};
  return abbrevMap[rawAbbrev] || rawAbbrev;
}

function computeDecade(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

// Generate season date ranges for a sport going back N years
function getSeasonDates(sport: string, yearsBack: number): { startDate: Date; endDate: Date }[] {
  const currentYear = new Date().getFullYear();
  const seasons: { startDate: Date; endDate: Date }[] = [];

  for (let i = 0; i < yearsBack; i++) {
    const year = currentYear - i;
    let start: Date;
    let end: Date;

    switch (sport) {
      case "nba":
        start = new Date(year - 1, 9, 15); // Oct 15
        end = new Date(year, 5, 30);       // June 30
        break;
      case "nfl":
        start = new Date(year, 8, 1);      // Sept 1
        end = new Date(year + 1, 1, 15);   // Feb 15
        break;
      case "nhl":
        start = new Date(year - 1, 9, 1);  // Oct 1
        end = new Date(year, 5, 30);       // June 30
        break;
      case "mlb":
        start = new Date(year, 2, 20);     // March 20
        end = new Date(year, 10, 15);      // Nov 15
        break;
      default:
        continue;
    }

    // Don't go into the future
    const today = new Date();
    if (end > today) end = today;
    if (start > today) continue;

    seasons.push({ startDate: start, endDate: end });
  }

  return seasons;
}

// Fetch matchup games for a specific pair of teams from ESPN
async function fetchMatchupGamesFromESPN(
  sport: string,
  teamAAbbrev: string,
  teamBAbbrev: string,
  yearsBack: number
): Promise<ParsedGame[]> {
  const baseUrl = ESPN_SCOREBOARD_URLS[sport];
  if (!baseUrl) return [];

  const matchupGames: ParsedGame[] = [];
  const seasons = getSeasonDates(sport, yearsBack);
  const today = new Date();

  // For each season, sample key dates (weekly for NFL, every 3 days for others)
  for (const season of seasons) {
    let currentDate = new Date(season.startDate);
    const stepDays = sport === "nfl" ? 7 : 3;

    while (currentDate <= season.endDate && currentDate <= today) {
      const dateStr = currentDate.toISOString().split("T")[0].replace(/-/g, "");
      const url = `${baseUrl}?dates=${dateStr}`;

      try {
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (response.ok) {
          const data = await response.json();
          
          for (const event of data.events || []) {
            const competition = event.competitions?.[0];
            if (!competition || !event.status?.type?.completed) continue;

            const homeTeam = competition.competitors.find((c: any) => c.homeAway === "home");
            const awayTeam = competition.competitors.find((c: any) => c.homeAway === "away");
            if (!homeTeam || !awayTeam) continue;

            const homeAbbrev = normalizeAbbrev(sport, homeTeam.team.abbreviation);
            const awayAbbrev = normalizeAbbrev(sport, awayTeam.team.abbreviation);

            // Check if this is the matchup we want
            const isMatchup = (
              (homeAbbrev === teamAAbbrev && awayAbbrev === teamBAbbrev) ||
              (homeAbbrev === teamBAbbrev && awayAbbrev === teamAAbbrev)
            );

            if (!isMatchup) continue;

            const homeScore = parseInt(homeTeam.score, 10);
            const awayScore = parseInt(awayTeam.score, 10);
            if (isNaN(homeScore) || isNaN(awayScore)) continue;

            matchupGames.push({
              espnId: event.id,
              homeAbbrev,
              awayAbbrev,
              homeScore,
              awayScore,
              startTimeUtc: event.date,
              seasonYear: event.season?.year || currentDate.getFullYear(),
              isPlayoff: event.season?.type === 3,
            });
          }
        }
      } catch {
        // Continue on error
      }

      currentDate.setDate(currentDate.getDate() + stepDays);
    }
  }

  // Remove duplicates by espnId
  const seen = new Set<string>();
  return matchupGames.filter(g => {
    if (seen.has(g.espnId)) return false;
    seen.add(g.espnId);
    return true;
  });
}

// Insert games into DB, return how many were added
async function insertMatchupGames(
  supabase: any,
  sport: string,
  games: ParsedGame[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // Get existing game keys
  const gameKeys = games.map(g => `espn-${sport}-${g.espnId}`);
  const existingKeys = new Set<string>();

  for (let i = 0; i < gameKeys.length; i += 500) {
    const batch = gameKeys.slice(i, i + 500);
    const { data } = await supabase
      .from("games")
      .select("provider_game_key")
      .in("provider_game_key", batch);
    for (const g of data || []) existingKeys.add(g.provider_game_key);
  }

  const newGames = games.filter(g => !existingKeys.has(`espn-${sport}-${g.espnId}`));
  skipped = games.length - newGames.length;

  if (newGames.length === 0) return { inserted, skipped };

  // Load teams and franchises
  const { data: teams } = await supabase.from("teams").select("id, abbrev").eq("sport_id", sport);
  const { data: franchises } = await supabase.from("franchises").select("id, canonical_name").eq("sport_id", sport);

  const teamMap = new Map<string, string>((teams || []).filter((t: any) => t.abbrev).map((t: any) => [t.abbrev as string, t.id as string]));
  const franchiseNameToId = new Map<string, string>((franchises || []).map((f: any) => [f.canonical_name as string, f.id as string]));
  const mapping = FRANCHISE_MAPPINGS[sport] || {};
  const franchiseMap = new Map<string, string>();
  for (const [abbrev, name] of Object.entries(mapping)) {
    const id = franchiseNameToId.get(name);
    if (id) franchiseMap.set(abbrev, id);
  }

  for (const game of newGames) {
    const homeTeamId = teamMap.get(game.homeAbbrev);
    const awayTeamId = teamMap.get(game.awayAbbrev);
    const homeFranchiseId = franchiseMap.get(game.homeAbbrev);
    const awayFranchiseId = franchiseMap.get(game.awayAbbrev);

    if (!homeTeamId || !awayTeamId) continue;

    const providerGameKey = `espn-${sport}-${game.espnId}`;
    const decade = computeDecade(game.seasonYear);

    const { data: insertedGame, error } = await supabase
      .from("games")
      .insert({
        sport_id: sport,
        provider_game_key: providerGameKey,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_score: game.homeScore,
        away_score: game.awayScore,
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

    if (error) {
      if (!error.message?.includes("duplicate")) console.log(`[HYDRATE] Insert error: ${error.message}`);
      continue;
    }

    if (insertedGame) {
      inserted++;

      // Insert matchup_games row
      const [teamLowId, teamHighId] = [homeTeamId, awayTeamId].sort();
      const [franchiseLowId, franchiseHighId] = homeFranchiseId && awayFranchiseId
        ? [homeFranchiseId, awayFranchiseId].sort()
        : [null, null];

      await supabase.from("matchup_games").insert({
        game_id: insertedGame.id,
        sport_id: sport,
        team_low_id: teamLowId,
        team_high_id: teamHighId,
        franchise_low_id: franchiseLowId,
        franchise_high_id: franchiseHighId,
        total: game.homeScore + game.awayScore,
        played_at_utc: game.startTimeUtc,
        season_year: game.seasonYear,
        decade,
      });
    }
  }

  return { inserted, skipped };
}

// Compute matchup stats after hydration
async function recomputeMatchupStats(
  supabase: any,
  sport: string,
  teamLowId: string,
  teamHighId: string,
  franchiseLowId: string | null,
  franchiseHighId: string | null
): Promise<{ n_games: number; segments_updated: string[] }> {
  const currentYear = new Date().getFullYear();
  const segments = [
    { key: "h2h_1y", yearsBack: 1 },
    { key: "h2h_3y", yearsBack: 3 },
    { key: "h2h_5y", yearsBack: 5 },
    { key: "h2h_10y", yearsBack: 10 },
    { key: "h2h_all", yearsBack: null },
  ];

  const segmentsUpdated: string[] = [];
  let totalGames = 0;

  for (const segment of segments) {
    let query = supabase
      .from("matchup_games")
      .select("total")
      .eq("sport_id", sport);

    if (franchiseLowId && franchiseHighId) {
      query = query.eq("franchise_low_id", franchiseLowId).eq("franchise_high_id", franchiseHighId);
    } else {
      query = query.eq("team_low_id", teamLowId).eq("team_high_id", teamHighId);
    }

    if (segment.yearsBack !== null) {
      query = query.gte("season_year", currentYear - segment.yearsBack);
    }

    const { data: games } = await query;
    const n = games?.length || 0;
    if (segment.key === "h2h_all") totalGames = n;

    if (n === 0) continue;

    const totals = games.map((g: any) => Number(g.total)).sort((a: number, b: number) => a - b);
    const p05Index = Math.max(0, Math.ceil(0.05 * n) - 1);
    const p95Index = Math.min(n - 1, Math.ceil(0.95 * n) - 1);
    const medianIndex = Math.floor(n / 2);
    const median = n % 2 === 0 ? (totals[medianIndex - 1] + totals[medianIndex]) / 2 : totals[medianIndex];

    const statsData = {
      sport_id: sport,
      team_low_id: teamLowId,
      team_high_id: teamHighId,
      franchise_low_id: franchiseLowId,
      franchise_high_id: franchiseHighId,
      segment_key: segment.key,
      n_games: n,
      p05: totals[p05Index],
      p95: totals[p95Index],
      median,
      min_total: totals[0],
      max_total: totals[n - 1],
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("matchup_stats")
      .select("id")
      .eq("sport_id", sport)
      .eq("team_low_id", teamLowId)
      .eq("team_high_id", teamHighId)
      .eq("segment_key", segment.key)
      .maybeSingle();

    if (existing) {
      await supabase.from("matchup_stats").update(statsData).eq("id", existing.id);
    } else {
      await supabase.from("matchup_stats").insert(statsData);
    }

    segmentsUpdated.push(segment.key);
  }

  return { n_games: totalGames, segments_updated: segmentsUpdated };
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
    const { sport_id, team_a_id, team_b_id, years_back = 10 } = await req.json();

    if (!sport_id || !team_a_id || !team_b_id) {
      return new Response(
        JSON.stringify({ error: "Missing sport_id, team_a_id, or team_b_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[HYDRATE] Starting hydration for ${sport_id}: ${team_a_id} vs ${team_b_id}, ${years_back} years`);

    // Get team abbreviations
    const { data: teamA } = await supabase.from("teams").select("abbrev").eq("id", team_a_id).single();
    const { data: teamB } = await supabase.from("teams").select("abbrev").eq("id", team_b_id).single();

    if (!teamA?.abbrev || !teamB?.abbrev) {
      return new Response(
        JSON.stringify({ error: "Could not find team abbreviations", team_a_id, team_b_id }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize team order
    const [teamLowId, teamHighId] = [team_a_id, team_b_id].sort();

    // Get franchise IDs if available
    const { data: games } = await supabase
      .from("games")
      .select("home_franchise_id, away_franchise_id")
      .or(`home_team_id.eq.${team_a_id},away_team_id.eq.${team_a_id}`)
      .eq("sport_id", sport_id)
      .limit(1);

    let franchiseLowId: string | null = null;
    let franchiseHighId: string | null = null;

    if (games?.[0]) {
      const fIds = [games[0].home_franchise_id, games[0].away_franchise_id].filter(Boolean);
      if (fIds.length === 2) {
        [franchiseLowId, franchiseHighId] = fIds.sort();
      }
    }

    // Log job start
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "hydrate-matchup",
        details: { sport_id, team_a: teamA.abbrev, team_b: teamB.abbrev, years_back },
      })
      .select("id")
      .single();

    // Fetch historical matchup games from ESPN
    const espnGames = await fetchMatchupGamesFromESPN(sport_id, teamA.abbrev, teamB.abbrev, years_back);
    console.log(`[HYDRATE] Found ${espnGames.length} games from ESPN`);

    // Insert new games
    const { inserted, skipped } = await insertMatchupGames(supabase, sport_id, espnGames);
    console.log(`[HYDRATE] Inserted ${inserted} new games, skipped ${skipped} existing`);

    // Recompute matchup stats for all segments
    const { n_games, segments_updated } = await recomputeMatchupStats(
      supabase,
      sport_id,
      teamLowId,
      teamHighId,
      franchiseLowId,
      franchiseHighId
    );

    // Update job run
    if (jobRun?.id) {
      await supabase
        .from("job_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "success",
          details: {
            sport_id,
            team_a: teamA.abbrev,
            team_b: teamB.abbrev,
            years_back,
            espn_found: espnGames.length,
            inserted,
            skipped,
            n_games_total: n_games,
            segments_updated,
          },
        })
        .eq("id", jobRun.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sport_id,
        team_a: teamA.abbrev,
        team_b: teamB.abbrev,
        espn_found: espnGames.length,
        inserted,
        skipped,
        n_games_total: n_games,
        segments_updated,
        hydrated: inserted > 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[HYDRATE] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
