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

// Team name mappings (ESPN abbreviation -> our standard abbreviation)
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
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
  homeScore: number;
  awayScore: number;
  gameDate: string;
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
        homeTeamAbbrev: homeTeam.team.abbreviation,
        awayTeamAbbrev: awayTeam.team.abbreviation,
        homeScore,
        awayScore,
        gameDate: event.date,
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

  let correctedCount = 0;
  let checkedCount = 0;
  let errorCount = 0;

  for (const dateStr of dates) {
    try {
      const espnGames = await fetchESPNGames(sport, dateStr);
      if (espnGames.length === 0) continue;

      console.log(`[BACKFILL] ${dateStr}: ${espnGames.length} games from ESPN`);

      const [year, month, day] = dateStr.split("-").map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

      const { data: ourGames } = await supabase
        .from("games")
        .select(`
          id, home_score, away_score, final_total,
          home_team:teams!games_home_team_id_fkey(id, name),
          away_team:teams!games_away_team_id_fkey(id, name)
        `)
        .eq("sport_id", sport)
        .eq("status", "final")
        .gte("start_time_utc", startOfDay.toISOString())
        .lte("start_time_utc", endOfDay.toISOString());

      for (const ourGame of ourGames || []) {
        checkedCount++;
        const homeTeamData = ourGame.home_team as unknown as { id: string; name: string } | null;
        const awayTeamData = ourGame.away_team as unknown as { id: string; name: string } | null;
        const homeTeam = homeTeamData?.name;
        const awayTeam = awayTeamData?.name;

        if (!homeTeam || !awayTeam) continue;

        const mapping = ESPN_TO_DB[sport] || {};
        for (const espnGame of espnGames) {
          const espnHomeDb = mapping[espnGame.homeTeamAbbrev] || espnGame.homeTeamAbbrev;
          const espnAwayDb = mapping[espnGame.awayTeamAbbrev] || espnGame.awayTeamAbbrev;

          if (homeTeam === espnHomeDb && awayTeam === espnAwayDb) {
            const scoreDiffers =
              ourGame.home_score !== espnGame.homeScore ||
              ourGame.away_score !== espnGame.awayScore;

            if (scoreDiffers) {
              const { error } = await supabase
                .from("games")
                .update({
                  home_score: espnGame.homeScore,
                  away_score: espnGame.awayScore,
                })
                .eq("id", ourGame.id);

              if (!error) {
                correctedCount++;
                await supabase
                  .from("matchup_games")
                  .update({ total: espnGame.homeScore + espnGame.awayScore })
                  .eq("game_id", ourGame.id);
              } else {
                errorCount++;
              }
            }
            break;
          }
        }
      }

      // Rate limit protection
      await new Promise((r) => setTimeout(r, 50));
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
          errors: errorCount,
        },
      })
      .eq("id", jobRun.id);
  }

  console.log(`[BACKFILL] Complete: ${checkedCount} checked, ${correctedCount} corrected, ${errorCount} errors`);
  return { checkedCount, correctedCount, errorCount };
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
    let mode = "verify";
    let async = false;

    try {
      const body = await req.json();
      sport = body.sport || "nba";
      startDate = body.start_date;
      endDate = body.end_date;
      mode = body.mode || "verify";
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
