import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamSeasonStats {
  team_id: string;
  sport_id: string;
  season_year: number;
  wins: number;
  losses: number;
  ppg_avg: number;
  opp_ppg_avg: number;
}

// Get the season year for a game date
function getSeasonYear(date: Date, sport: string): number {
  const month = date.getMonth() + 1; // 0-indexed
  const year = date.getFullYear();

  // NBA/NHL/NFL seasons span two calendar years (e.g., 2023-24 season)
  // Games from Oct-Dec are part of the season that ends next year
  // Games from Jan-Jun are part of the season that started previous year
  if (sport === "nba" || sport === "nhl") {
    if (month >= 10) return year + 1; // Oct-Dec = next year's season
    if (month <= 6) return year; // Jan-Jun = current season year
    return year; // Jul-Sep = offseason, use current year
  }
  
  if (sport === "nfl") {
    // NFL season: Sep-Feb
    if (month >= 9) return year + 1; // Sep-Dec = next year's Super Bowl
    if (month <= 2) return year; // Jan-Feb = current season's playoffs
    return year; // Mar-Aug = offseason
  }
  
  // MLB runs within a calendar year (Mar-Nov)
  return year;
}

async function computeTeamSeasons(supabase: any, sport: string, startYear?: number, endYear?: number) {
  console.log(`[TEAM-SEASONS] Computing stats for ${sport}, years: ${startYear || 'all'} - ${endYear || 'all'}`);

  const { data: jobRun } = await supabase
    .from("job_runs")
    .insert({ job_name: `compute-team-seasons-${sport}`, status: "running" })
    .select("id")
    .single();

  // Fetch all final games for this sport
  let query = supabase
    .from("games")
    .select("id, home_team_id, away_team_id, home_score, away_score, start_time_utc")
    .eq("sport_id", sport)
    .eq("status", "final")
    .not("home_score", "is", null)
    .not("away_score", "is", null)
    .order("start_time_utc", { ascending: true });

  const { data: games, error: gamesError } = await query;

  if (gamesError) {
    console.error("[TEAM-SEASONS] Error fetching games:", gamesError);
    return { error: gamesError.message };
  }

  console.log(`[TEAM-SEASONS] Found ${games?.length || 0} games to process`);

  // Aggregate stats by team and season
  const statsMap: Record<string, TeamSeasonStats> = {};

  for (const game of games || []) {
    const gameDate = new Date(game.start_time_utc);
    const seasonYear = getSeasonYear(gameDate, sport);

    // Filter by year range if specified
    if (startYear && seasonYear < startYear) continue;
    if (endYear && seasonYear > endYear) continue;

    const homeScore = Number(game.home_score);
    const awayScore = Number(game.away_score);

    // Home team stats
    const homeKey = `${game.home_team_id}-${seasonYear}`;
    if (!statsMap[homeKey]) {
      statsMap[homeKey] = {
        team_id: game.home_team_id,
        sport_id: sport,
        season_year: seasonYear,
        wins: 0,
        losses: 0,
        ppg_avg: 0,
        opp_ppg_avg: 0,
      };
    }
    statsMap[homeKey].ppg_avg += homeScore;
    statsMap[homeKey].opp_ppg_avg += awayScore;
    if (homeScore > awayScore) {
      statsMap[homeKey].wins++;
    } else {
      statsMap[homeKey].losses++;
    }

    // Away team stats
    const awayKey = `${game.away_team_id}-${seasonYear}`;
    if (!statsMap[awayKey]) {
      statsMap[awayKey] = {
        team_id: game.away_team_id,
        sport_id: sport,
        season_year: seasonYear,
        wins: 0,
        losses: 0,
        ppg_avg: 0,
        opp_ppg_avg: 0,
      };
    }
    statsMap[awayKey].ppg_avg += awayScore;
    statsMap[awayKey].opp_ppg_avg += homeScore;
    if (awayScore > homeScore) {
      statsMap[awayKey].wins++;
    } else {
      statsMap[awayKey].losses++;
    }
  }

  // Convert totals to averages
  const teamSeasons: any[] = [];
  for (const key in statsMap) {
    const stats = statsMap[key];
    const totalGames = stats.wins + stats.losses;
    if (totalGames > 0) {
      teamSeasons.push({
        team_id: stats.team_id,
        sport_id: stats.sport_id,
        season_year: stats.season_year,
        wins: stats.wins,
        losses: stats.losses,
        ppg_avg: Math.round((stats.ppg_avg / totalGames) * 10) / 10,
        opp_ppg_avg: Math.round((stats.opp_ppg_avg / totalGames) * 10) / 10,
        updated_at: new Date().toISOString(),
      });
    }
  }

  console.log(`[TEAM-SEASONS] Computed stats for ${teamSeasons.length} team-seasons`);

  // Upsert all team seasons
  let upsertedCount = 0;
  let errorCount = 0;

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < teamSeasons.length; i += batchSize) {
    const batch = teamSeasons.slice(i, i + batchSize);
    const { error: upsertError } = await supabase
      .from("team_seasons")
      .upsert(batch, { onConflict: "team_id,season_year" });

    if (upsertError) {
      console.error(`[TEAM-SEASONS] Upsert error:`, upsertError.message);
      errorCount += batch.length;
    } else {
      upsertedCount += batch.length;
    }
  }

  // Update job run
  if (jobRun) {
    await supabase
      .from("job_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        details: {
          sport,
          start_year: startYear,
          end_year: endYear,
          games_processed: games?.length || 0,
          team_seasons_computed: teamSeasons.length,
          upserted: upsertedCount,
          errors: errorCount,
        },
      })
      .eq("id", jobRun.id);
  }

  console.log(`[TEAM-SEASONS] Complete: ${upsertedCount} upserted, ${errorCount} errors`);

  return {
    games_processed: games?.length || 0,
    team_seasons_computed: teamSeasons.length,
    upserted: upsertedCount,
    errors: errorCount,
  };
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
    let startYear: number | undefined;
    let endYear: number | undefined;
    let allSports = false;

    try {
      const body = await req.json();
      sport = body.sport || "nba";
      startYear = body.start_year;
      endYear = body.end_year;
      allSports = body.all_sports === true;
    } catch {
      // No body - use defaults
    }

    const results: Record<string, any> = {};

    if (allSports) {
      // Compute for all sports
      for (const s of ["nba", "nfl", "nhl", "mlb"]) {
        results[s] = await computeTeamSeasons(supabase, s, startYear, endYear);
      }
    } else {
      results[sport] = await computeTeamSeasons(supabase, sport, startYear, endYear);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[TEAM-SEASONS] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
