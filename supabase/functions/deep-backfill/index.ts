import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BDL_ENDPOINTS = {
  nba: "https://api.balldontlie.io/v1",
  nfl: "https://api.balldontlie.io/nfl/v1",
};

// Historical data ranges
const HISTORICAL_RANGES = {
  nba: { start: 1946, end: new Date().getFullYear() },
  nfl: { start: 2002, end: new Date().getFullYear() },
};

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
    // Historical franchises
    "NJN": "Brooklyn Nets", "SEA": "Oklahoma City Thunder", "VAN": "Memphis Grizzlies",
    "NOH": "New Orleans Pelicans", "NOK": "New Orleans Pelicans", "CHA_OLD": "Charlotte Hornets",
    "CHH": "Charlotte Hornets", "BAL": "Washington Wizards", "CAP": "Washington Wizards",
    "BUF": "LA Clippers", "SDC": "LA Clippers", "KCK": "Sacramento Kings", "CIN": "Sacramento Kings",
    "ROC": "Sacramento Kings", "SYR": "Philadelphia 76ers", "PHW": "Golden State Warriors",
    "SFW": "Golden State Warriors", "MNL": "Los Angeles Lakers", "SDR": "Houston Rockets",
    "STL": "Atlanta Hawks", "MLH": "Atlanta Hawks", "TRI": "Atlanta Hawks",
  },
  nfl: {
    "ARI": "Arizona Cardinals", "ATL": "Atlanta Falcons", "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills", "CAR": "Carolina Panthers", "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals", "CLE": "Cleveland Browns", "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos", "DET": "Detroit Lions", "GB": "Green Bay Packers",
    "HOU": "Houston Texans", "IND": "Indianapolis Colts",
    "JAC": "Jacksonville Jaguars", "JAX": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs", "LV": "Las Vegas Raiders", "OAK": "Las Vegas Raiders",
    "LAR": "Los Angeles Rams", "STL": "Los Angeles Rams",
    "LAC": "Los Angeles Chargers", "SD": "Los Angeles Chargers",
    "MIA": "Miami Dolphins", "MIN": "Minnesota Vikings",
    "NE": "New England Patriots", "NO": "New Orleans Saints",
    "NYG": "New York Giants", "NYJ": "New York Jets",
    "PHI": "Philadelphia Eagles", "PIT": "Pittsburgh Steelers", "SF": "San Francisco 49ers",
    "SEA": "Seattle Seahawks", "TB": "Tampa Bay Buccaneers", "TEN": "Tennessee Titans",
    "WAS": "Washington Commanders", "WSH": "Washington Commanders",
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

async function fetchWithRetry(url: string, apiKey: string, maxRetries = 5): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "Authorization": apiKey, "Accept": "application/json" },
      });

      if (response.ok) return response;

      if (response.status === 429) {
        const delay = Math.min(100 * Math.pow(2, attempt), 5000);
        console.log(`[DEEP-BACKFILL] Rate limited, waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (response.status >= 500) {
        const delay = 100 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      console.error(`[DEEP-BACKFILL] API error ${response.status}`);
      return null;
    } catch {
      const delay = 100 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return null;
}

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

  let franchiseId = franchiseCache.get(`${sport}:${canonicalName}`);
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
    if (franchiseId) franchiseCache.set(`${sport}:${canonicalName}`, franchiseId);
  }

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

async function backfillSeason(
  supabase: any,
  apiKey: string,
  sport: string,
  season: number
): Promise<{ fetched: number; upserted: number; errors: number }> {
  const baseUrl = BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS];
  if (!baseUrl) return { fetched: 0, upserted: 0, errors: 0 };

  const counters = { fetched: 0, upserted: 0, errors: 0 };
  let cursor: number | null = null;
  const games: BDLGame[] = [];

  console.log(`[DEEP-BACKFILL] Fetching ${sport} season ${season}...`);

  while (true) {
    let url = `${baseUrl}/games?seasons[]=${season}&per_page=100`;
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
  console.log(`[DEEP-BACKFILL] Fetched ${games.length} games for ${sport} ${season}`);

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
      status: isFinal ? "final" : "scheduled",
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

      // Insert matchup_games for final games
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

  return counters;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bdlApiKey = Deno.env.get("BALLDONTLIE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const sport = body.sport || "nba"; // nba or nfl
    const startYear = body.startYear || HISTORICAL_RANGES[sport as keyof typeof HISTORICAL_RANGES]?.start || 2002;
    const endYear = body.endYear || new Date().getFullYear();
    const singleSeason = body.season; // Optional: backfill just one season

    console.log(`[DEEP-BACKFILL] Starting ${sport} backfill from ${startYear} to ${endYear}`);

    // Record job start
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: `deep-backfill-${sport}`,
        status: "running",
        details: { sport, startYear, endYear },
      })
      .select("id")
      .single();

    const totals = { fetched: 0, upserted: 0, errors: 0, seasons: 0 };

    if (singleSeason) {
      // Backfill single season
      const result = await backfillSeason(supabase, bdlApiKey, sport, singleSeason);
      totals.fetched += result.fetched;
      totals.upserted += result.upserted;
      totals.errors += result.errors;
      totals.seasons = 1;
    } else {
      // Backfill range of seasons - start from most recent for immediate value
      for (let season = endYear; season >= startYear; season--) {
        const result = await backfillSeason(supabase, bdlApiKey, sport, season);
        totals.fetched += result.fetched;
        totals.upserted += result.upserted;
        totals.errors += result.errors;
        totals.seasons++;

        // Log progress every 5 seasons
        if (totals.seasons % 5 === 0) {
          console.log(`[DEEP-BACKFILL] Progress: ${totals.seasons} seasons, ${totals.upserted} games`);
        }

        // Small delay between seasons to avoid overwhelming the API
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Update job status
    if (jobRun?.id) {
      await supabase
        .from("job_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          details: { sport, startYear, endYear, ...totals },
        })
        .eq("id", jobRun.id);
    }

    console.log(`[DEEP-BACKFILL] Complete: ${totals.seasons} seasons, ${totals.fetched} fetched, ${totals.upserted} upserted, ${totals.errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      sport,
      startYear,
      endYear,
      ...totals,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[DEEP-BACKFILL] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
