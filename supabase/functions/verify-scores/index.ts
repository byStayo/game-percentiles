import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ESPN API - Free, no auth required
const ESPN_API_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";

// Team name mapping from our DB names to ESPN team abbreviations
// Our DB stores team abbreviations like "ATL", "MIA", "WAS" etc.
const TEAM_NAME_TO_ESPN: Record<string, string> = {
  // Atlanta Hawks
  "ATL": "ATL", "Hawks": "ATL",
  // Boston Celtics
  "BOS": "BOS", "Celtics": "BOS",
  // Brooklyn Nets
  "BKN": "BKN", "BRO": "BKN", "Nets": "BKN",
  // Charlotte Hornets
  "CHA": "CHA", "CHO": "CHA", "Hornets": "CHA",
  // Chicago Bulls
  "CHI": "CHI", "Bulls": "CHI",
  // Cleveland Cavaliers
  "CLE": "CLE", "Cavaliers": "CLE",
  // Dallas Mavericks
  "DAL": "DAL", "Mavericks": "DAL",
  // Denver Nuggets
  "DEN": "DEN", "Nuggets": "DEN",
  // Detroit Pistons
  "DET": "DET", "Pistons": "DET",
  // Golden State Warriors
  "GSW": "GS", "GS": "GS", "Warriors": "GS",
  // Houston Rockets
  "HOU": "HOU", "Rockets": "HOU",
  // Indiana Pacers
  "IND": "IND", "Pacers": "IND",
  // LA Clippers
  "LAC": "LAC", "Clippers": "LAC",
  // LA Lakers
  "LAL": "LAL", "Lakers": "LAL",
  // Memphis Grizzlies
  "MEM": "MEM", "Grizzlies": "MEM",
  // Miami Heat
  "MIA": "MIA", "Heat": "MIA",
  // Milwaukee Bucks
  "MIL": "MIL", "Bucks": "MIL",
  // Minnesota Timberwolves
  "MIN": "MIN", "Timberwolves": "MIN",
  // New Orleans Pelicans
  "NOP": "NO", "NO": "NO", "Pelicans": "NO",
  // New York Knicks
  "NYK": "NY", "NY": "NY", "Knicks": "NY",
  // Oklahoma City Thunder
  "OKC": "OKC", "Thunder": "OKC",
  // Orlando Magic
  "ORL": "ORL", "Magic": "ORL",
  // Philadelphia 76ers
  "PHI": "PHI", "76ers": "PHI",
  // Phoenix Suns
  "PHX": "PHX", "PHO": "PHX", "Suns": "PHX",
  // Portland Trail Blazers
  "POR": "POR", "Trail Blazers": "POR", "Blazers": "POR",
  // Sacramento Kings
  "SAC": "SAC", "Kings": "SAC",
  // San Antonio Spurs
  "SAS": "SA", "SA": "SA", "Spurs": "SA",
  // Toronto Raptors
  "TOR": "TOR", "Raptors": "TOR",
  // Utah Jazz
  "UTA": "UTAH", "UTAH": "UTAH", "Jazz": "UTAH",
  // Washington Wizards
  "WAS": "WSH", "WSH": "WSH", "Wizards": "WSH",
};

interface ESPNCompetitor {
  id: string;
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
  };
  score: string;
  homeAway: "home" | "away";
}

interface ESPNEvent {
  id: string;
  date: string;
  status: {
    type: {
      name: string;
      state: string;
      completed: boolean;
    };
  };
  competitions: Array<{
    id: string;
    competitors: ESPNCompetitor[];
  }>;
}

interface ESPNResponse {
  events: ESPNEvent[];
}

function formatDateForESPN(date: Date): string {
  // ESPN expects YYYYMMDD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function getTeamAbbrev(teamName: string): string | null {
  if (TEAM_NAME_TO_ESPN[teamName]) {
    return TEAM_NAME_TO_ESPN[teamName];
  }
  const upper = teamName.toUpperCase();
  if (TEAM_NAME_TO_ESPN[upper]) {
    return TEAM_NAME_TO_ESPN[upper];
  }
  return null;
}

interface ParsedGame {
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
  homeScore: number;
  awayScore: number;
  isComplete: boolean;
}

async function fetchESPNGames(dateStr: string): Promise<ParsedGame[]> {
  // Convert YYYY-MM-DD to YYYYMMDD
  const espnDate = dateStr.replace(/-/g, "");
  const url = `${ESPN_API_URL}?dates=${espnDate}`;
  console.log(`[VERIFY-SCORES] Fetching ESPN games for ${dateStr}: ${url}`);

  const response = await fetch(url, {
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) {
    console.error(`[VERIFY-SCORES] ESPN API error: ${response.status} ${response.statusText}`);
    throw new Error(`ESPN API returned ${response.status}`);
  }

  const data: ESPNResponse = await response.json();
  console.log(`[VERIFY-SCORES] ESPN returned ${data.events?.length || 0} games for ${dateStr}`);

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
      isComplete,
    });
  }

  return games;
}

function matchGame(
  ourHomeTeam: string,
  ourAwayTeam: string,
  espnGames: ParsedGame[]
): ParsedGame | null {
  const ourHomeAbbrev = getTeamAbbrev(ourHomeTeam);
  const ourAwayAbbrev = getTeamAbbrev(ourAwayTeam);

  if (!ourHomeAbbrev || !ourAwayAbbrev) {
    console.log(`[VERIFY-SCORES] Could not map teams: ${ourHomeTeam} vs ${ourAwayTeam}`);
    return null;
  }

  for (const espnGame of espnGames) {
    if (
      espnGame.homeTeamAbbrev === ourHomeAbbrev &&
      espnGame.awayTeamAbbrev === ourAwayAbbrev
    ) {
      return espnGame;
    }
  }

  console.log(`[VERIFY-SCORES] No ESPN match found for ${ourHomeAbbrev} vs ${ourAwayAbbrev}`);
  return null;
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
    let targetDates: string[] = [];
    try {
      const body = await req.json();
      if (body.date) {
        targetDates = [body.date];
      } else if (body.dates) {
        targetDates = body.dates;
      }
    } catch {
      // No body
    }

    // If no dates specified, check games from last 3 days
    if (targetDates.length === 0) {
      const today = new Date();
      for (let i = 0; i < 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        targetDates.push(`${year}-${month}-${day}`);
      }
    }

    console.log(`[VERIFY-SCORES] Checking dates: ${targetDates.join(", ")}`);

    const { data: jobRun, error: jobError } = await supabase
      .from("job_runs")
      .insert({ job_name: "verify-scores", status: "running" })
      .select("id")
      .single();

    if (jobError) {
      console.error("[VERIFY-SCORES] Failed to create job run:", jobError);
    }

    let correctedCount = 0;
    let checkedCount = 0;
    let errorCount = 0;
    const corrections: Array<{
      game_id: string;
      teams: string;
      old_scores: { home: number; away: number; total: number };
      new_scores: { home: number; away: number; total: number };
    }> = [];

    for (const dateStr of targetDates) {
      const [year, month, day] = dateStr.split("-").map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

      const { data: ourGames, error: gamesError } = await supabase
        .from("games")
        .select(`
          id,
          home_score,
          away_score,
          final_total,
          status,
          start_time_utc,
          home_team:teams!games_home_team_id_fkey(id, name),
          away_team:teams!games_away_team_id_fkey(id, name)
        `)
        .eq("sport_id", "nba")
        .eq("status", "final")
        .gte("start_time_utc", startOfDay.toISOString())
        .lte("start_time_utc", endOfDay.toISOString());

      if (gamesError) {
        console.error(`[VERIFY-SCORES] Error fetching our games for ${dateStr}:`, gamesError);
        errorCount++;
        continue;
      }

      if (!ourGames || ourGames.length === 0) {
        console.log(`[VERIFY-SCORES] No final NBA games found in our DB for ${dateStr}`);
        continue;
      }

      console.log(`[VERIFY-SCORES] Found ${ourGames.length} final NBA games in our DB for ${dateStr}`);

      // Fetch ESPN games for this date AND the previous day
      // (to handle timezone differences between UTC storage and ET game dates)
      let espnGames: ParsedGame[] = [];
      try {
        const currentGames = await fetchESPNGames(dateStr);
        espnGames.push(...currentGames);
        
        // Also check previous day (games at midnight UTC are often yesterday in ET)
        const prevDate = new Date(year, month - 1, day);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevYear = prevDate.getFullYear();
        const prevMonth = String(prevDate.getMonth() + 1).padStart(2, "0");
        const prevDay = String(prevDate.getDate()).padStart(2, "0");
        const prevDateStr = `${prevYear}-${prevMonth}-${prevDay}`;
        
        const prevGames = await fetchESPNGames(prevDateStr);
        espnGames.push(...prevGames);
        
        console.log(`[VERIFY-SCORES] Combined ESPN games (${dateStr} + ${prevDateStr}): ${espnGames.length} final games`);
      } catch (e) {
        console.error(`[VERIFY-SCORES] Failed to fetch ESPN games for ${dateStr}:`, e);
        errorCount++;
        continue;
      }

      for (const ourGame of ourGames) {
        checkedCount++;

        const homeTeamData = ourGame.home_team as unknown as { id: string; name: string } | null;
        const awayTeamData = ourGame.away_team as unknown as { id: string; name: string } | null;
        const homeTeam = homeTeamData?.name;
        const awayTeam = awayTeamData?.name;

        if (!homeTeam || !awayTeam) {
          console.log(`[VERIFY-SCORES] Missing team names for game ${ourGame.id}`);
          continue;
        }

        const espnMatch = matchGame(homeTeam, awayTeam, espnGames);

        if (!espnMatch) {
          console.log(`[VERIFY-SCORES] No ESPN match for ${homeTeam} vs ${awayTeam}`);
          continue;
        }

        const espnHomeScore = espnMatch.homeScore;
        const espnAwayScore = espnMatch.awayScore;
        const espnTotal = espnHomeScore + espnAwayScore;

        const scoreDiffers =
          ourGame.home_score !== espnHomeScore ||
          ourGame.away_score !== espnAwayScore;

        if (scoreDiffers) {
          console.log(
            `[VERIFY-SCORES] Score mismatch for ${homeTeam} vs ${awayTeam}: ` +
            `Our: ${ourGame.home_score}-${ourGame.away_score}=${ourGame.final_total}, ` +
            `ESPN: ${espnHomeScore}-${espnAwayScore}=${espnTotal}`
          );

          // Note: final_total is a generated column, so we only update the scores
          const { error: updateError } = await supabase
            .from("games")
            .update({
              home_score: espnHomeScore,
              away_score: espnAwayScore,
            })
            .eq("id", ourGame.id);

          if (updateError) {
            console.error(`[VERIFY-SCORES] Failed to update game ${ourGame.id}:`, updateError);
            errorCount++;
          } else {
            correctedCount++;
            corrections.push({
              game_id: ourGame.id,
              teams: `${homeTeam} vs ${awayTeam}`,
              old_scores: {
                home: ourGame.home_score ?? 0,
                away: ourGame.away_score ?? 0,
                total: ourGame.final_total ?? 0,
              },
              new_scores: {
                home: espnHomeScore,
                away: espnAwayScore,
                total: espnTotal,
              },
            });

            // Also update matchup_games if exists
            const { error: matchupError } = await supabase
              .from("matchup_games")
              .update({ total: espnTotal })
              .eq("game_id", ourGame.id);

            if (matchupError) {
              console.error(`[VERIFY-SCORES] Failed to update matchup_games for ${ourGame.id}:`, matchupError);
            }
          }
        } else {
          console.log(`[VERIFY-SCORES] Scores match for ${homeTeam} vs ${awayTeam}: ${espnHomeScore}-${espnAwayScore}=${espnTotal}`);
        }
      }
    }

    if (jobRun) {
      await supabase
        .from("job_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          details: {
            dates_checked: targetDates,
            games_checked: checkedCount,
            games_corrected: correctedCount,
            errors: errorCount,
            corrections: corrections.slice(0, 20),
          },
        })
        .eq("id", jobRun.id);
    }

    console.log(`[VERIFY-SCORES] Complete: ${checkedCount} checked, ${correctedCount} corrected, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        dates_checked: targetDates,
        games_checked: checkedCount,
        games_corrected: correctedCount,
        errors: errorCount,
        corrections,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[VERIFY-SCORES] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
