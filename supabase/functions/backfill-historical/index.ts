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

// Team name mappings (ESPN abbreviation -> our DB abbreviation)
const ESPN_TO_DB: Record<string, Record<string, string>> = {
  nba: {
    "ATL": "ATL", "BOS": "BOS", "BKN": "BKN", "CHA": "CHA", "CHI": "CHI",
    "CLE": "CLE", "DAL": "DAL", "DEN": "DEN", "DET": "DET", "GS": "GSW",
    "HOU": "HOU", "IND": "IND", "LAC": "LAC", "LAL": "LAL", "MEM": "MEM",
    "MIA": "MIA", "MIL": "MIL", "MIN": "MIN", "NO": "NOP", "NY": "NYK",
    "OKC": "OKC", "ORL": "ORL", "PHI": "PHI", "PHX": "PHX", "POR": "POR",
    "SAC": "SAC", "SA": "SAS", "TOR": "TOR", "UTAH": "UTA", "WSH": "WAS",
  },
  nfl: {
    "ARI": "ARI", "ATL": "ATL", "BAL": "BAL", "BUF": "BUF", "CAR": "CAR",
    "CHI": "CHI", "CIN": "CIN", "CLE": "CLE", "DAL": "DAL", "DEN": "DEN",
    "DET": "DET", "GB": "GB", "HOU": "HOU", "IND": "IND", "JAX": "JAC",
    "KC": "KC", "LV": "LV", "LAC": "LAC", "LAR": "LAR", "MIA": "MIA",
    "MIN": "MIN", "NE": "NE", "NO": "NO", "NYG": "NYG", "NYJ": "NYJ",
    "PHI": "PHI", "PIT": "PIT", "SF": "SF", "SEA": "SEA", "TB": "TB",
    "TEN": "TEN", "WSH": "WAS",
  },
  nhl: {
    "ANA": "ANA", "ARI": "ARI", "BOS": "BOS", "BUF": "BUF", "CGY": "CGY",
    "CAR": "CAR", "CHI": "CHI", "COL": "COL", "CBJ": "CBJ", "DAL": "DAL",
    "DET": "DET", "EDM": "EDM", "FLA": "FLA", "LA": "LA", "MIN": "MIN",
    "MTL": "MTL", "NSH": "NSH", "NJ": "NJ", "NYI": "NYI", "NYR": "NYR",
    "OTT": "OTT", "PHI": "PHI", "PIT": "PIT", "SJ": "SJ", "SEA": "SEA",
    "STL": "STL", "TB": "TB", "TOR": "TOR", "VAN": "VAN", "VGK": "VGK",
    "WPG": "WPG", "WSH": "WSH", "UTAH": "UTA",
  },
  mlb: {
    "ARI": "ARI", "ATL": "ATL", "BAL": "BAL", "BOS": "BOS", "CHC": "CHC",
    "CHW": "CWS", "CIN": "CIN", "CLE": "CLE", "COL": "COL", "DET": "DET",
    "HOU": "HOU", "KC": "KC", "LAA": "LAA", "LAD": "LAD", "MIA": "MIA",
    "MIL": "MIL", "MIN": "MIN", "NYM": "NYM", "NYY": "NYY", "OAK": "OAK",
    "PHI": "PHI", "PIT": "PIT", "SD": "SD", "SF": "SF", "SEA": "SEA",
    "STL": "STL", "TB": "TB", "TEX": "TEX", "TOR": "TOR", "WSH": "WAS",
  },
};

interface ESPNCompetitor {
  id: string;
  team: { id: string; abbreviation: string; displayName: string };
  score: string;
  homeAway: "home" | "away";
}

interface ESPNEvent {
  id: string;
  date: string;
  status: { type: { name: string; state: string; completed: boolean } };
  competitions: Array<{ id: string; competitors: ESPNCompetitor[] }>;
}

interface ESPNResponse {
  events: ESPNEvent[];
}

interface ParsedGame {
  espnId: string;
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
  homeScore: number;
  awayScore: number;
  gameDate: string;
  startTimeUtc: string;
}

async function fetchESPNGames(sport: string, dateStr: string): Promise<ParsedGame[]> {
  const baseUrl = ESPN_API_URLS[sport];
  if (!baseUrl) return [];

  const espnDate = dateStr.replace(/-/g, "");
  const url = `${baseUrl}?dates=${espnDate}`;

  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) return [];

    const data: ESPNResponse = await response.json();
    const games: ParsedGame[] = [];

    for (const event of data.events || []) {
      const competition = event.competitions?.[0];
      if (!competition) continue;

      const isComplete = event.status?.type?.completed === true;
      if (!isComplete) continue;

      const homeTeam = competition.competitors.find((c) => c.homeAway === "home");
      const awayTeam = competition.competitors.find((c) => c.homeAway === "away");

      if (!homeTeam || !awayTeam) continue;

      const homeScore = parseInt(homeTeam.score, 10);
      const awayScore = parseInt(awayTeam.score, 10);

      if (isNaN(homeScore) || isNaN(awayScore)) continue;

      games.push({
        espnId: event.id,
        homeTeamAbbrev: homeTeam.team.abbreviation,
        awayTeamAbbrev: awayTeam.team.abbreviation,
        homeScore,
        awayScore,
        gameDate: dateStr,
        startTimeUtc: event.date,
      });
    }

    return games;
  } catch {
    return [];
  }
}

function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}

async function runBackfill(
  supabase: any,
  sport: string,
  startDate: string,
  endDate: string,
  mode: string
) {
  const dates = generateDateRange(startDate, endDate);
  console.log(`[BACKFILL] Sport: ${sport}, Mode: ${mode}, Dates: ${dates.length} days (${startDate} to ${endDate})`);

  const { data: jobRun } = await supabase
    .from("job_runs")
    .insert({ job_name: `backfill-${sport}`, status: "running" })
    .select("id")
    .single();

  // Load team lookup table
  const { data: teams } = await supabase
    .from("teams")
    .select("id, abbrev, name")
    .eq("sport_id", sport);

  const teamByAbbrev: Record<string, { id: string; name: string }> = {};
  const teamByName: Record<string, { id: string; abbrev: string }> = {};
  for (const team of teams || []) {
    if (team.abbrev) teamByAbbrev[team.abbrev] = { id: team.id, name: team.name };
    if (team.name) teamByName[team.name] = { id: team.id, abbrev: team.abbrev };
  }

  let correctedCount = 0;
  let checkedCount = 0;
  let insertedCount = 0;
  let errorCount = 0;

  const mapping = ESPN_TO_DB[sport] || {};

  for (const dateStr of dates) {
    try {
      const espnGames = await fetchESPNGames(sport, dateStr);
      if (espnGames.length === 0) continue;

      console.log(`[BACKFILL] ${dateStr}: ${espnGames.length} games from ESPN`);

      const [year, month, day] = dateStr.split("-").map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

      // Get existing games for this date
      const { data: ourGames } = await supabase
        .from("games")
        .select(`
          id, home_score, away_score, final_total, provider_game_key,
          home_team:teams!games_home_team_id_fkey(id, abbrev, name),
          away_team:teams!games_away_team_id_fkey(id, abbrev, name)
        `)
        .eq("sport_id", sport)
        .gte("start_time_utc", startOfDay.toISOString())
        .lte("start_time_utc", endOfDay.toISOString());

      // Create lookup of existing games by team matchup
      const existingGamesByMatchup: Record<string, any> = {};
      for (const game of ourGames || []) {
        const homeTeam = game.home_team as unknown as { id: string; abbrev: string; name: string } | null;
        const awayTeam = game.away_team as unknown as { id: string; abbrev: string; name: string } | null;
        if (homeTeam?.abbrev && awayTeam?.abbrev) {
          const key = `${homeTeam.abbrev}-${awayTeam.abbrev}`;
          existingGamesByMatchup[key] = game;
        }
      }

      for (const espnGame of espnGames) {
        const homeAbbrev = mapping[espnGame.homeTeamAbbrev] || espnGame.homeTeamAbbrev;
        const awayAbbrev = mapping[espnGame.awayTeamAbbrev] || espnGame.awayTeamAbbrev;
        const matchupKey = `${homeAbbrev}-${awayAbbrev}`;

        const existingGame = existingGamesByMatchup[matchupKey];

        if (existingGame) {
          // Game exists - verify/correct scores
          checkedCount++;
          const scoreDiffers =
            existingGame.home_score !== espnGame.homeScore ||
            existingGame.away_score !== espnGame.awayScore;

          if (scoreDiffers && existingGame.status !== "scheduled") {
            const { error } = await supabase
              .from("games")
              .update({
                home_score: espnGame.homeScore,
                away_score: espnGame.awayScore,
                final_total: espnGame.homeScore + espnGame.awayScore,
                status: "final",
              })
              .eq("id", existingGame.id);

            if (!error) {
              correctedCount++;
              // Update matchup_games too
              await supabase
                .from("matchup_games")
                .update({ total: espnGame.homeScore + espnGame.awayScore })
                .eq("game_id", existingGame.id);
            } else {
              errorCount++;
            }
          }
        } else {
          // Game doesn't exist - INSERT it
          const homeTeam = teamByAbbrev[homeAbbrev];
          const awayTeam = teamByAbbrev[awayAbbrev];

          if (!homeTeam || !awayTeam) {
            console.log(`[BACKFILL] Missing team: ${homeAbbrev} or ${awayAbbrev}`);
            continue;
          }

          const providerGameKey = `espn-${sport}-${espnGame.espnId}`;
          const finalTotal = espnGame.homeScore + espnGame.awayScore;

          const { data: newGame, error: insertError } = await supabase
            .from("games")
            .insert({
              sport_id: sport,
              provider_game_key: providerGameKey,
              home_team_id: homeTeam.id,
              away_team_id: awayTeam.id,
              home_score: espnGame.homeScore,
              away_score: espnGame.awayScore,
              final_total: finalTotal,
              start_time_utc: espnGame.startTimeUtc,
              status: "final",
            })
            .select("id")
            .single();

          if (!insertError && newGame) {
            insertedCount++;

            // Also insert into matchup_games for stats
            const [teamHighId, teamLowId] = [homeTeam.id, awayTeam.id].sort();
            await supabase.from("matchup_games").insert({
              game_id: newGame.id,
              sport_id: sport,
              team_high_id: teamHighId,
              team_low_id: teamLowId,
              total: finalTotal,
              played_at_utc: espnGame.startTimeUtc,
            });
          } else if (insertError) {
            // Might be duplicate provider_game_key - that's OK
            if (!insertError.message?.includes("duplicate")) {
              console.error(`[BACKFILL] Insert error:`, insertError.message);
              errorCount++;
            }
          }
        }
      }

      // Rate limit protection
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.error(`[BACKFILL] Error on ${dateStr}:`, err);
      errorCount++;
    }
  }

  if (jobRun) {
    await supabase
      .from("job_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        details: {
          sport,
          mode,
          start_date: startDate,
          end_date: endDate,
          days_processed: dates.length,
          games_checked: checkedCount,
          games_corrected: correctedCount,
          games_inserted: insertedCount,
          errors: errorCount,
        },
      })
      .eq("id", jobRun.id);
  }

  console.log(`[BACKFILL] Complete: ${checkedCount} checked, ${correctedCount} corrected, ${insertedCount} inserted, ${errorCount} errors`);
  return { checkedCount, correctedCount, insertedCount, errorCount };
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
    let sport = "nba";
    let startDate = "";
    let endDate = "";
    let mode = "backfill"; // Changed default to backfill (insert + verify)
    let async = false;

    try {
      const body = await req.json();
      sport = body.sport || "nba";
      startDate = body.start_date;
      endDate = body.end_date;
      mode = body.mode || "backfill";
      async = body.async === true;
    } catch {
      // No body - use defaults for cron: last 7 days
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      endDate = today.toISOString().split("T")[0];
      startDate = weekAgo.toISOString().split("T")[0];
    }

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "start_date and end_date are required (YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For large date ranges or async flag, use background task
    const dates = generateDateRange(startDate, endDate);
    if (async || dates.length > 14) {
      console.log(`[BACKFILL] Running in background: ${dates.length} days`);
      
      // @ts-ignore - Deno edge runtime API
      EdgeRuntime.waitUntil(runBackfill(supabase, sport, startDate, endDate, mode));
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "Backfill started in background",
          sport,
          start_date: startDate,
          end_date: endDate,
          days_to_process: dates.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For small ranges, run synchronously
    const result = await runBackfill(supabase, sport, startDate, endDate, mode);

    return new Response(
      JSON.stringify({
        success: true,
        sport,
        mode,
        start_date: startDate,
        end_date: endDate,
        days_processed: dates.length,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[BACKFILL] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
