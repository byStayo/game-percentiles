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
    "UTA": "UTA", "NOP": "NOP", "NYK": "NYK", "GSW": "GSW", "SAS": "SAS",
  },
  nfl: {
    "ARI": "ARI", "ATL": "ATL", "BAL": "BAL", "BUF": "BUF", "CAR": "CAR",
    "CHI": "CHI", "CIN": "CIN", "CLE": "CLE", "DAL": "DAL", "DEN": "DEN",
    "DET": "DET", "GB": "GB", "HOU": "HOU", "IND": "IND", "JAX": "JAC",
    "KC": "KC", "LV": "LV", "LAC": "LAC", "LAR": "LAR", "MIA": "MIA",
    "MIN": "MIN", "NE": "NE", "NO": "NO", "NYG": "NYG", "NYJ": "NYJ",
    "PHI": "PHI", "PIT": "PIT", "SF": "SF", "SEA": "SEA", "TB": "TB",
    "TEN": "TEN", "WSH": "WAS", "OAK": "LV", "STL": "LAR", "SD": "LAC",
    "JAC": "JAC", "WAS": "WAS",
  },
  nhl: {
    "ANA": "ANA", "ARI": "ARI", "BOS": "BOS", "BUF": "BUF", "CGY": "CGY",
    "CAR": "CAR", "CHI": "CHI", "COL": "COL", "CBJ": "CBJ", "DAL": "DAL",
    "DET": "DET", "EDM": "EDM", "FLA": "FLA", "LA": "LA", "MIN": "MIN",
    "MTL": "MTL", "NSH": "NSH", "NJ": "NJ", "NYI": "NYI", "NYR": "NYR",
    "OTT": "OTT", "PHI": "PHI", "PIT": "PIT", "SJ": "SJ", "SEA": "SEA",
    "STL": "STL", "TB": "TB", "TOR": "TOR", "VAN": "VAN", "VGK": "VGK",
    "WPG": "WPG", "WSH": "WSH", "UTAH": "UTA", "PHX": "ARI", "ATL": "WPG",
  },
  mlb: {
    "ARI": "ARI", "ATL": "ATL", "BAL": "BAL", "BOS": "BOS", "CHC": "CHC",
    "CHW": "CWS", "CIN": "CIN", "CLE": "CLE", "COL": "COL", "DET": "DET",
    "HOU": "HOU", "KC": "KC", "LAA": "LAA", "LAD": "LAD", "MIA": "MIA",
    "MIL": "MIL", "MIN": "MIN", "NYM": "NYM", "NYY": "NYY", "OAK": "OAK",
    "PHI": "PHI", "PIT": "PIT", "SD": "SD", "SF": "SF", "SEA": "SEA",
    "STL": "STL", "TB": "TB", "TEX": "TEX", "TOR": "TOR", "WSH": "WAS",
    "CWS": "CWS", "WAS": "WAS", "FLA": "MIA",
  },
};

// Season date ranges by sport
const SPORT_SEASONS: Record<string, { start: string; end: string }[]> = {
  nba: [
    // 2015-2025 NBA seasons (Oct-Jun)
    { start: "2015-10-27", end: "2016-06-20" },
    { start: "2016-10-25", end: "2017-06-13" },
    { start: "2017-10-17", end: "2018-06-09" },
    { start: "2018-10-16", end: "2019-06-14" },
    { start: "2019-10-22", end: "2020-10-12" }, // COVID extended
    { start: "2020-12-22", end: "2021-07-21" }, // COVID delayed start
    { start: "2021-10-19", end: "2022-06-17" },
    { start: "2022-10-18", end: "2023-06-13" },
    { start: "2023-10-24", end: "2024-06-18" },
    { start: "2024-10-22", end: "2025-06-30" },
  ],
  nfl: [
    // 2015-2025 NFL seasons (Sep-Feb)
    { start: "2015-09-10", end: "2016-02-08" },
    { start: "2016-09-08", end: "2017-02-06" },
    { start: "2017-09-07", end: "2018-02-05" },
    { start: "2018-09-06", end: "2019-02-04" },
    { start: "2019-09-05", end: "2020-02-03" },
    { start: "2020-09-10", end: "2021-02-08" },
    { start: "2021-09-09", end: "2022-02-14" },
    { start: "2022-09-08", end: "2023-02-13" },
    { start: "2023-09-07", end: "2024-02-12" },
    { start: "2024-09-05", end: "2025-02-10" },
  ],
  nhl: [
    // 2015-2025 NHL seasons (Oct-Jun)
    { start: "2015-10-07", end: "2016-06-13" },
    { start: "2016-10-12", end: "2017-06-12" },
    { start: "2017-10-04", end: "2018-06-08" },
    { start: "2018-10-03", end: "2019-06-13" },
    { start: "2019-10-02", end: "2020-09-29" }, // COVID bubble
    { start: "2021-01-13", end: "2021-07-08" }, // COVID delayed
    { start: "2021-10-12", end: "2022-06-27" },
    { start: "2022-10-07", end: "2023-06-14" },
    { start: "2023-10-10", end: "2024-06-25" },
    { start: "2024-10-04", end: "2025-06-30" },
  ],
  mlb: [
    // 2015-2025 MLB seasons (Mar/Apr-Oct/Nov)
    { start: "2015-04-05", end: "2015-11-02" },
    { start: "2016-04-03", end: "2016-11-03" },
    { start: "2017-04-02", end: "2017-11-02" },
    { start: "2018-03-29", end: "2018-10-29" },
    { start: "2019-03-28", end: "2019-10-31" },
    { start: "2020-07-23", end: "2020-10-28" }, // COVID shortened
    { start: "2021-04-01", end: "2021-11-03" },
    { start: "2022-04-07", end: "2022-11-06" },
    { start: "2023-03-30", end: "2023-11-02" },
    { start: "2024-03-28", end: "2024-11-03" },
    { start: "2025-03-27", end: "2025-11-05" },
  ],
};

interface ESPNEvent {
  id: string;
  date: string;
  status: { type: { completed: boolean } };
  competitions: Array<{
    competitors: Array<{
      team: { abbreviation: string; displayName: string };
      score: string;
      homeAway: "home" | "away";
    }>;
  }>;
}

interface ParsedGame {
  espnId: string;
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
  homeScore: number;
  awayScore: number;
  startTimeUtc: string;
}

async function fetchESPNGamesForDate(sport: string, dateStr: string): Promise<ParsedGame[]> {
  const baseUrl = ESPN_API_URLS[sport];
  if (!baseUrl) return [];

  const espnDate = dateStr.replace(/-/g, "");
  const url = `${baseUrl}?dates=${espnDate}`;

  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) return [];

    const data = await response.json();
    const games: ParsedGame[] = [];

    for (const event of (data.events || []) as ESPNEvent[]) {
      const competition = event.competitions?.[0];
      if (!competition || !event.status?.type?.completed) continue;

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
        startTimeUtc: event.date,
      });
    }

    return games;
  } catch (err) {
    console.log(`[ESPN] Error fetching ${sport} for ${dateStr}:`, err);
    return [];
  }
}

function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  for (let d = new Date(start); d <= end && d <= today; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}

async function backfillSport(
  supabase: any,
  sport: string,
  jobRunId: number
) {
  const seasons = SPORT_SEASONS[sport] || [];
  const mapping = ESPN_TO_DB[sport] || {};
  
  // Get team lookup
  const { data: teams } = await supabase
    .from("teams")
    .select("id, abbrev, name, city")
    .eq("sport_id", sport);

  const teamByAbbrev: Record<string, { id: string; name: string; city: string | null }> = {};
  for (const team of teams || []) {
    if (team.abbrev) teamByAbbrev[team.abbrev] = { id: team.id, name: team.name, city: team.city };
  }

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let seasonsProcessed = 0;

  for (const season of seasons) {
    const dates = generateDateRange(season.start, season.end);
    console.log(`[BACKFILL-ALL] ${sport} season ${season.start} to ${season.end}: ${dates.length} days`);

    let seasonInserted = 0;
    let batchCount = 0;

    for (const dateStr of dates) {
      try {
        const games = await fetchESPNGamesForDate(sport, dateStr);
        
        for (const game of games) {
          const homeAbbrev = mapping[game.homeTeamAbbrev] || game.homeTeamAbbrev;
          const awayAbbrev = mapping[game.awayTeamAbbrev] || game.awayTeamAbbrev;

          let homeTeam = teamByAbbrev[homeAbbrev];
          let awayTeam = teamByAbbrev[awayAbbrev];

          // Create team if not exists
          if (!homeTeam) {
            const { data: newTeam } = await supabase
              .from("teams")
              .insert({
                sport_id: sport,
                provider_team_key: `espn-${sport}-${homeAbbrev}`,
                name: game.homeTeamAbbrev,
                abbrev: homeAbbrev,
              })
              .select("id, name, city")
              .single();
            if (newTeam) {
              homeTeam = { id: newTeam.id, name: newTeam.name, city: newTeam.city };
              teamByAbbrev[homeAbbrev] = homeTeam;
            }
          }

          if (!awayTeam) {
            const { data: newTeam } = await supabase
              .from("teams")
              .insert({
                sport_id: sport,
                provider_team_key: `espn-${sport}-${awayAbbrev}`,
                name: game.awayTeamAbbrev,
                abbrev: awayAbbrev,
              })
              .select("id, name, city")
              .single();
            if (newTeam) {
              awayTeam = { id: newTeam.id, name: newTeam.name, city: newTeam.city };
              teamByAbbrev[awayAbbrev] = awayTeam;
            }
          }

          if (!homeTeam || !awayTeam) {
            totalSkipped++;
            continue;
          }

          const providerGameKey = `espn-${sport}-${game.espnId}`;
          const finalTotal = game.homeScore + game.awayScore;

          // Check if game exists
          const { data: existing } = await supabase
            .from("games")
            .select("id")
            .eq("provider_game_key", providerGameKey)
            .maybeSingle();

          if (existing) {
            totalSkipped++;
            continue;
          }

          // Insert game
          const { data: newGame, error: gameError } = await supabase
            .from("games")
            .insert({
              sport_id: sport,
              provider_game_key: providerGameKey,
              home_team_id: homeTeam.id,
              away_team_id: awayTeam.id,
              home_score: game.homeScore,
              away_score: game.awayScore,
              final_total: finalTotal,
              start_time_utc: game.startTimeUtc,
              status: "final",
            })
            .select("id")
            .single();

          if (gameError) {
            if (!gameError.message?.includes("duplicate")) {
              totalErrors++;
            } else {
              totalSkipped++;
            }
            continue;
          }

          // Insert matchup_games entry
          const [teamLowId, teamHighId] = [homeTeam.id, awayTeam.id].sort();
          await supabase.from("matchup_games").insert({
            game_id: newGame.id,
            sport_id: sport,
            team_low_id: teamLowId,
            team_high_id: teamHighId,
            total: finalTotal,
            played_at_utc: game.startTimeUtc,
          });

          totalInserted++;
          seasonInserted++;
        }

        batchCount++;
        // Rate limiting - be nice to ESPN API
        if (batchCount % 10 === 0) {
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (err) {
        console.log(`[BACKFILL-ALL] Error on ${dateStr}:`, err);
        totalErrors++;
      }
    }

    seasonsProcessed++;
    console.log(`[BACKFILL-ALL] ${sport} season complete: ${seasonInserted} new games`);

    // Update job progress
    await supabase
      .from("job_runs")
      .update({
        details: {
          sport,
          seasons_processed: seasonsProcessed,
          total_seasons: seasons.length,
          games_inserted: totalInserted,
          games_skipped: totalSkipped,
          errors: totalErrors,
          status: "running",
        },
      })
      .eq("id", jobRunId);
  }

  return { totalInserted, totalSkipped, totalErrors, seasonsProcessed };
}

async function recomputeAllMatchupStats(supabase: any, sport: string) {
  console.log(`[BACKFILL-ALL] Recomputing matchup stats for ${sport}...`);

  const { data: matchups } = await supabase
    .from("matchup_games")
    .select("sport_id, team_low_id, team_high_id")
    .eq("sport_id", sport);

  const uniqueMatchups = new Set<string>();
  matchups?.forEach((m: any) => {
    uniqueMatchups.add(`${m.team_low_id}|${m.team_high_id}`);
  });

  console.log(`[BACKFILL-ALL] Found ${uniqueMatchups.size} unique matchups for ${sport}`);

  let statsUpdated = 0;

  for (const key of uniqueMatchups) {
    const [teamLowId, teamHighId] = key.split("|");

    const { data: matchupGames } = await supabase
      .from("matchup_games")
      .select("total")
      .eq("sport_id", sport)
      .eq("team_low_id", teamLowId)
      .eq("team_high_id", teamHighId);

    if (!matchupGames || matchupGames.length === 0) continue;

    const totals = matchupGames.map((m: any) => Number(m.total)).sort((a: number, b: number) => a - b);
    const n = totals.length;

    const p05Index = Math.max(0, Math.ceil(0.05 * n) - 1);
    const p95Index = Math.min(n - 1, Math.ceil(0.95 * n) - 1);
    const medianIndex = Math.floor(n / 2);

    const statsData = {
      sport_id: sport,
      team_low_id: teamLowId,
      team_high_id: teamHighId,
      n_games: n,
      p05: totals[p05Index],
      p95: totals[p95Index],
      median: n % 2 === 0 ? (totals[medianIndex - 1] + totals[medianIndex]) / 2 : totals[medianIndex],
      min_total: totals[0],
      max_total: totals[n - 1],
      updated_at: new Date().toISOString(),
    };

    // Upsert stats
    const { data: existing } = await supabase
      .from("matchup_stats")
      .select("id")
      .eq("sport_id", sport)
      .eq("team_low_id", teamLowId)
      .eq("team_high_id", teamHighId)
      .maybeSingle();

    if (existing) {
      await supabase.from("matchup_stats").update(statsData).eq("id", existing.id);
    } else {
      await supabase.from("matchup_stats").insert(statsData);
    }

    statsUpdated++;
  }

  console.log(`[BACKFILL-ALL] Updated ${statsUpdated} matchup stats for ${sport}`);
  return statsUpdated;
}

async function runFullBackfill(supabase: any, sports: string[], jobRunId: number) {
  const results: Record<string, any> = {};

  for (const sport of sports) {
    console.log(`[BACKFILL-ALL] Starting ${sport}...`);
    
    const sportResult = await backfillSport(supabase, sport, jobRunId);
    results[sport] = sportResult;

    // Recompute stats after each sport
    const statsCount = await recomputeAllMatchupStats(supabase, sport);
    results[sport].statsUpdated = statsCount;

    console.log(`[BACKFILL-ALL] ${sport} complete:`, results[sport]);
  }

  // Mark job as complete
  await supabase
    .from("job_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: "success",
      details: results,
    })
    .eq("id", jobRunId);

  console.log(`[BACKFILL-ALL] All sports complete!`, results);
  return results;
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
    let sports = ["nba", "nfl", "nhl", "mlb"];
    let recomputeOnly = false;

    try {
      const body = await req.json();
      if (body.sports && Array.isArray(body.sports)) {
        sports = body.sports;
      }
      recomputeOnly = body.recompute_only === true;
    } catch {
      // Use defaults
    }

    // Create job run record
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "backfill-all",
        status: "running",
        details: { sports, recompute_only: recomputeOnly },
      })
      .select("id")
      .single();

    const jobRunId = jobRun?.id;

    if (recomputeOnly) {
      // Just recompute stats
      // @ts-ignore
      EdgeRuntime.waitUntil((async () => {
        const results: Record<string, number> = {};
        for (const sport of sports) {
          results[sport] = await recomputeAllMatchupStats(supabase, sport);
        }
        await supabase.from("job_runs").update({
          finished_at: new Date().toISOString(),
          status: "success",
          details: results,
        }).eq("id", jobRunId);
      })());

      return new Response(
        JSON.stringify({
          success: true,
          message: "Recomputing matchup stats in background",
          job_id: jobRunId,
          sports,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Run full backfill in background
    // @ts-ignore
    EdgeRuntime.waitUntil(runFullBackfill(supabase, sports, jobRunId));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Full historical backfill started (10 years, all sports)",
        job_id: jobRunId,
        sports,
        note: "This will take several hours. Check job_runs table for progress.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BACKFILL-ALL] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
