import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BallDontLie API endpoints for NFL and NBA
const BDL_ENDPOINTS = {
  nba: "https://api.balldontlie.io/v1",
  nfl: "https://api.balldontlie.io/nfl/v1",
};

// Franchise mappings for consistent team identity
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
    "OAK": "Las Vegas Raiders", "SD": "Los Angeles Chargers", "STL": "Los Angeles Rams",
  },
};

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
  updated_at: string;
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

// Fetch games for specific dates from BallDontLie
async function fetchGamesByDates(
  sport: string,
  dates: string[],
  apiKey: string
): Promise<BDLGame[]> {
  const baseUrl = BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS];
  if (!baseUrl) return [];

  const games: BDLGame[] = [];
  const datesParam = dates.map(d => `dates[]=${d}`).join("&");
  let cursor: number | null = null;
  let pageCount = 0;
  const maxPages = 10;

  while (pageCount < maxPages) {
    let url = `${baseUrl}/games?${datesParam}&per_page=100`;
    if (cursor) url += `&cursor=${cursor}`;

    const response = await fetchWithRetry(url, apiKey);
    if (!response) break;

    const data = await response.json();
    const pageGames = data.data || [];
    games.push(...pageGames);

    pageCount++;
    const nextCursor = data.meta?.next_cursor;
    if (!nextCursor) break;
    cursor = nextCursor;
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`[BDL] Fetched ${games.length} games for ${sport} on dates: ${dates.join(", ")}`);
  return games;
}

// Fetch betting odds from BallDontLie (GOAT tier)
async function fetchOdds(
  sport: string,
  season: number,
  week: number | null,
  apiKey: string
): Promise<BDLOdds[]> {
  const baseUrl = BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS];
  if (!baseUrl) return [];

  const odds: BDLOdds[] = [];
  let cursor: number | null = null;
  let pageCount = 0;
  const maxPages = 5;

  // Build URL based on sport
  let url = `${baseUrl}/odds?season=${season}&per_page=100`;
  if (sport === "nfl" && week) {
    url += `&week=${week}`;
  }

  while (pageCount < maxPages) {
    const pageUrl = cursor ? `${url}&cursor=${cursor}` : url;
    const response = await fetchWithRetry(pageUrl, apiKey);
    if (!response) break;

    const data = await response.json();
    odds.push(...(data.data || []));

    pageCount++;
    const nextCursor = data.meta?.next_cursor;
    if (!nextCursor) break;
    cursor = nextCursor;
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`[BDL] Fetched ${odds.length} odds entries for ${sport} season ${season}${week ? ` week ${week}` : ""}`);
  return odds;
}

// Caches
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
    // NFL season starts in September
    return month >= 3 ? year : year - 1;
  } else {
    // NBA season spans years (Oct-June), use the start year
    return month >= 10 ? year : year - 1;
  }
}

function getCurrentNFLWeek(): number {
  // Approximate NFL week calculation
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 8, 5); // Approx Sept 5
  if (now < seasonStart) return 1;
  const diffDays = Math.floor((now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(Math.floor(diffDays / 7) + 1, 18);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const counters = { games_fetched: 0, games_upserted: 0, odds_fetched: 0, odds_matched: 0, errors: 0 };
  let jobRunId: number | null = null;

  try {
    const apiKey = Deno.env.get("BALLDONTLIE_KEY");
    if (!apiKey) {
      throw new Error("BALLDONTLIE_KEY not configured");
    }

    let requestBody: {
      dates?: string[];
      days_ahead?: number;
      sports?: string[];
      include_odds?: boolean;
    } = {};

    try {
      requestBody = await req.json();
    } catch {
      // Empty body OK
    }

    // Determine dates to fetch
    const daysAhead = requestBody.days_ahead ?? 7;
    const dates: string[] = requestBody.dates || [];
    
    if (dates.length === 0) {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      
      for (let i = 0; i < daysAhead; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        dates.push(formatter.format(date));
      }
    }

    const sports = requestBody.sports || ["nfl", "nba"];
    const includeOdds = requestBody.include_odds !== false;

    console.log(`[BDL-INGEST] Starting for ${sports.join(", ")} on dates: ${dates.join(", ")}`);

    // Create job run
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "ingest-bdl",
        details: { dates, sports, include_odds: includeOdds },
      })
      .select()
      .single();

    jobRunId = jobRun?.id || null;

    const sportResults: Record<string, { games: number; odds: number }> = {};

    for (const sport of sports) {
      if (!BDL_ENDPOINTS[sport as keyof typeof BDL_ENDPOINTS]) continue;

      sportResults[sport] = { games: 0, odds: 0 };

      try {
        // Fetch games by dates
        const games = await fetchGamesByDates(sport, dates, apiKey);
        counters.games_fetched += games.length;

        // Store BDL game_id -> our game_id mapping for odds
        const bdlToDbGameId = new Map<number, string>();

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
            console.warn(`[BDL-INGEST] Missing team for ${homeAbbrev} vs ${awayAbbrev}`);
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
          };

          // Check if game exists first
          const { data: existingGame } = await supabase
            .from("games")
            .select("id")
            .eq("sport_id", sport)
            .eq("provider_game_key", providerGameKey)
            .maybeSingle();

          let gameId: string | null = null;

          if (existingGame) {
            // Update existing game
            const { error: updateError } = await supabase
              .from("games")
              .update({
                start_time_utc: startTimeUtc,
                home_score: isFinal ? homeScore : null,
                away_score: isFinal ? awayScore : null,
                status: isFinal ? "final" : game.status?.toLowerCase() === "scheduled" ? "scheduled" : "live",
                last_seen_at: new Date().toISOString(),
              })
              .eq("id", existingGame.id);

            if (updateError) {
              console.error(`[BDL-INGEST] Game update error: ${updateError.message}`);
              counters.errors++;
              continue;
            }
            gameId = existingGame.id;
          } else {
            // Insert new game
            const { data: created, error: insertError } = await supabase
              .from("games")
              .insert(gameData)
              .select("id")
              .single();

            if (insertError) {
              console.error(`[BDL-INGEST] Game insert error: ${insertError.message}`);
              counters.errors++;
              continue;
            }
            gameId = created?.id;
          }

          if (gameId) {
            counters.games_upserted++;
            sportResults[sport].games++;
            bdlToDbGameId.set(game.id, gameId);

            // If game is final, upsert matchup_games
            if (isFinal && homeScore !== null && awayScore !== null) {
              const [teamLowId, teamHighId] = [home.teamId, away.teamId].sort();
              const [franchiseLowId, franchiseHighId] = [home.franchiseId, away.franchiseId].sort((a, b) => {
                if (!a) return 1;
                if (!b) return -1;
                return a.localeCompare(b);
              });

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

        // Fetch and store odds if requested and we have games
        if (includeOdds && bdlToDbGameId.size > 0) {
          const season = getCurrentSeason(sport);
          const week = sport === "nfl" ? getCurrentNFLWeek() : null;
          const odds = await fetchOdds(sport, season, week, apiKey);
          counters.odds_fetched += odds.length;

          // Group odds by game_id, preferring DraftKings
          const oddsByGame = new Map<number, BDLOdds>();
          for (const o of odds) {
            // Prefer DraftKings
            if (o.vendor === "draftkings" || !oddsByGame.has(o.game_id)) {
              oddsByGame.set(o.game_id, o);
            }
          }

          for (const [bdlGameId, oddsData] of oddsByGame) {
            const dbGameId = bdlToDbGameId.get(bdlGameId);
            if (!dbGameId) continue;

            const totalLine = parseFloat(oddsData.total_value);
            if (isNaN(totalLine)) continue;

            // Store in odds_snapshots
            await supabase
              .from("odds_snapshots")
              .insert({
                game_id: dbGameId,
                bookmaker: oddsData.vendor || "draftkings",
                market: "totals",
                total_line: totalLine,
                raw_payload: oddsData,
              });

            counters.odds_matched++;
            sportResults[sport].odds++;
          }
        }
      } catch (sportError) {
        console.error(`[BDL-INGEST] Error for ${sport}:`, sportError);
        counters.errors++;
      }
    }

    // Update job run
    if (jobRunId) {
      await supabase
        .from("job_runs")
        .update({
          status: counters.errors > 0 ? "partial" : "success",
          finished_at: new Date().toISOString(),
          details: { dates, sports, counters, by_sport: sportResults },
        })
        .eq("id", jobRunId);
    }

    console.log(`[BDL-INGEST] Complete: ${JSON.stringify(counters)}`);

    return new Response(
      JSON.stringify({
        success: counters.errors === 0,
        dates,
        sports,
        counters,
        by_sport: sportResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BDL-INGEST] Fatal error:", error);

    if (jobRunId) {
      await supabase
        .from("job_runs")
        .update({
          status: "fail",
          finished_at: new Date().toISOString(),
          details: { error: error instanceof Error ? error.message : "Unknown error", counters },
        })
        .eq("id", jobRunId);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
