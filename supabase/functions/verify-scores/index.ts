import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Ball Don't Lie API - Free NBA data
const BDL_API_URL = "https://api.balldontlie.io/v1";

// Team name mapping from our DB names to Ball Don't Lie team abbreviations
const TEAM_NAME_TO_BDL: Record<string, string> = {
  // Our DB uses team abbreviations or short names
  "ATL": "ATL", "Hawks": "ATL",
  "BOS": "BOS", "Celtics": "BOS",
  "BKN": "BKN", "BRO": "BKN", "Nets": "BKN",
  "CHA": "CHA", "Hornets": "CHA",
  "CHI": "CHI", "Bulls": "CHI",
  "CLE": "CLE", "Cavaliers": "CLE",
  "DAL": "DAL", "Mavericks": "DAL",
  "DEN": "DEN", "Nuggets": "DEN",
  "DET": "DET", "Pistons": "DET",
  "GSW": "GSW", "GS": "GSW", "Warriors": "GSW",
  "HOU": "HOU", "Rockets": "HOU",
  "IND": "IND", "Pacers": "IND",
  "LAC": "LAC", "Clippers": "LAC",
  "LAL": "LAL", "Lakers": "LAL",
  "MEM": "MEM", "Grizzlies": "MEM",
  "MIA": "MIA", "Heat": "MIA",
  "MIL": "MIL", "Bucks": "MIL",
  "MIN": "MIN", "Timberwolves": "MIN",
  "NOP": "NOP", "NO": "NOP", "Pelicans": "NOP",
  "NYK": "NYK", "NY": "NYK", "Knicks": "NYK",
  "OKC": "OKC", "Thunder": "OKC",
  "ORL": "ORL", "Magic": "ORL",
  "PHI": "PHI", "76ers": "PHI",
  "PHX": "PHX", "PHO": "PHX", "Suns": "PHX",
  "POR": "POR", "Trail Blazers": "POR", "Blazers": "POR",
  "SAC": "SAC", "Kings": "SAC",
  "SAS": "SAS", "SA": "SAS", "Spurs": "SAS",
  "TOR": "TOR", "Raptors": "TOR",
  "UTA": "UTA", "Jazz": "UTA",
  "WAS": "WAS", "Wizards": "WAS",
};

interface BDLGame {
  id: number;
  date: string;
  home_team: {
    id: number;
    abbreviation: string;
    full_name: string;
  };
  visitor_team: {
    id: number;
    abbreviation: string;
    full_name: string;
  };
  home_team_score: number;
  visitor_team_score: number;
  status: string;
  period: number;
  postseason: boolean;
  season: number;
}

interface BDLResponse {
  data: BDLGame[];
  meta: {
    next_cursor: number | null;
    per_page: number;
  };
}

function formatDateForBDL(date: Date): string {
  // Ball Don't Lie expects YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTeamAbbrev(teamName: string): string | null {
  // Try direct lookup
  if (TEAM_NAME_TO_BDL[teamName]) {
    return TEAM_NAME_TO_BDL[teamName];
  }
  // Try uppercase
  const upper = teamName.toUpperCase();
  if (TEAM_NAME_TO_BDL[upper]) {
    return TEAM_NAME_TO_BDL[upper];
  }
  return null;
}

async function fetchBDLGames(date: string): Promise<BDLGame[]> {
  const url = `${BDL_API_URL}/games?dates[]=${date}`;
  console.log(`[VERIFY-SCORES] Fetching BDL games for ${date}: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    console.error(`[VERIFY-SCORES] BDL API error: ${response.status} ${response.statusText}`);
    throw new Error(`Ball Don't Lie API returned ${response.status}`);
  }

  const data: BDLResponse = await response.json();
  console.log(`[VERIFY-SCORES] BDL returned ${data.data.length} games for ${date}`);
  return data.data;
}

function matchGame(
  ourHomeTeam: string,
  ourAwayTeam: string,
  bdlGames: BDLGame[]
): BDLGame | null {
  const ourHomeAbbrev = getTeamAbbrev(ourHomeTeam);
  const ourAwayAbbrev = getTeamAbbrev(ourAwayTeam);

  if (!ourHomeAbbrev || !ourAwayAbbrev) {
    console.log(`[VERIFY-SCORES] Could not map teams: ${ourHomeTeam} vs ${ourAwayTeam}`);
    return null;
  }

  for (const bdlGame of bdlGames) {
    // BDL uses home_team and visitor_team (visitor = away)
    if (
      bdlGame.home_team.abbreviation === ourHomeAbbrev &&
      bdlGame.visitor_team.abbreviation === ourAwayAbbrev
    ) {
      return bdlGame;
    }
  }

  console.log(`[VERIFY-SCORES] No BDL match found for ${ourHomeAbbrev} vs ${ourAwayAbbrev}`);
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
    // Parse optional date from request body (defaults to last 3 days)
    let targetDates: string[] = [];
    try {
      const body = await req.json();
      if (body.date) {
        targetDates = [body.date];
      } else if (body.dates) {
        targetDates = body.dates;
      }
    } catch {
      // No body, use defaults
    }

    // If no dates specified, check games from last 3 days
    if (targetDates.length === 0) {
      const today = new Date();
      for (let i = 0; i < 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        targetDates.push(formatDateForBDL(d));
      }
    }

    console.log(`[VERIFY-SCORES] Checking dates: ${targetDates.join(", ")}`);

    // Create job run record
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

    // Fetch all final NBA games in the date range
    for (const dateStr of targetDates) {
      // Parse the date string and create UTC range for that day
      const [year, month, day] = dateStr.split("-").map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

      // Fetch our games for this date
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
        console.log(`[VERIFY-SCORES] No final NBA games found for ${dateStr}`);
        continue;
      }

      console.log(`[VERIFY-SCORES] Found ${ourGames.length} final NBA games for ${dateStr}`);

      // Fetch BDL games for this date
      let bdlGames: BDLGame[];
      try {
        bdlGames = await fetchBDLGames(dateStr);
      } catch (e) {
        console.error(`[VERIFY-SCORES] Failed to fetch BDL games for ${dateStr}:`, e);
        errorCount++;
        continue;
      }

      // Filter to only final games from BDL
      const finalBdlGames = bdlGames.filter(
        (g) => g.status === "Final" && g.home_team_score > 0 && g.visitor_team_score > 0
      );
      console.log(`[VERIFY-SCORES] BDL has ${finalBdlGames.length} final games for ${dateStr}`);

      // Match and verify each game
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

        const bdlMatch = matchGame(homeTeam, awayTeam, finalBdlGames);

        if (!bdlMatch) {
          console.log(`[VERIFY-SCORES] No BDL match for ${homeTeam} vs ${awayTeam}`);
          continue;
        }

        const bdlHomeScore = bdlMatch.home_team_score;
        const bdlAwayScore = bdlMatch.visitor_team_score;
        const bdlTotal = bdlHomeScore + bdlAwayScore;

        // Check if scores differ
        const scoreDiffers =
          ourGame.home_score !== bdlHomeScore ||
          ourGame.away_score !== bdlAwayScore;

        if (scoreDiffers) {
          console.log(
            `[VERIFY-SCORES] Score mismatch for ${homeTeam} vs ${awayTeam}: ` +
            `Our: ${ourGame.home_score}-${ourGame.away_score}=${ourGame.final_total}, ` +
            `BDL: ${bdlHomeScore}-${bdlAwayScore}=${bdlTotal}`
          );

          // Update the game with correct scores
          const { error: updateError } = await supabase
            .from("games")
            .update({
              home_score: bdlHomeScore,
              away_score: bdlAwayScore,
              final_total: bdlTotal,
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
                home: bdlHomeScore,
                away: bdlAwayScore,
                total: bdlTotal,
              },
            });

            // Also update matchup_games if exists
            const { error: matchupError } = await supabase
              .from("matchup_games")
              .update({ total: bdlTotal })
              .eq("game_id", ourGame.id);

            if (matchupError) {
              console.error(`[VERIFY-SCORES] Failed to update matchup_games for ${ourGame.id}:`, matchupError);
            }
          }
        } else {
          console.log(`[VERIFY-SCORES] Scores match for ${homeTeam} vs ${awayTeam}`);
        }
      }
    }

    // Update job run with results
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
            corrections: corrections.slice(0, 20), // Limit to first 20 for storage
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
