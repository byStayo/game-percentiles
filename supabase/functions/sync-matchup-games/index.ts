import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SYNC MATCHUP GAMES
 * 
 * This function repairs the data gap between `games` table and `matchup_games` table.
 * It finds all final games that are NOT in matchup_games and creates entries for them.
 * 
 * The matchup_games table is critical for H2H statistics - without entries there,
 * the compute-percentiles function falls back to hybrid_form which is less accurate.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let jobRunId: number | null = null;
  const counters = {
    total_missing: 0,
    synced: 0,
    errors: 0,
    by_sport: {} as Record<string, { missing: number; synced: number }>,
  };

  try {
    let requestBody: { sport?: string; limit?: number } = {};
    try {
      requestBody = await req.json();
    } catch {
      // Empty body is OK
    }

    const { sport, limit = 10000 } = requestBody;
    const sports = sport ? [sport] : ["nba", "nfl", "nhl", "mlb"];

    console.log(`[SYNC] Starting matchup_games sync for ${sports.join(", ")}, limit: ${limit}`);

    // Create job run
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "sync-matchup-games",
        details: { sports, limit, status: "running" },
      })
      .select()
      .single();
    
    jobRunId = jobRun?.id || null;

    for (const sportId of sports) {
      counters.by_sport[sportId] = { missing: 0, synced: 0 };

      // Find games that are NOT in matchup_games
      // Using a LEFT JOIN approach via raw query
      const { data: missingGames, error: queryError } = await supabase
        .from("games")
        .select(`
          id,
          sport_id,
          home_team_id,
          away_team_id,
          home_franchise_id,
          away_franchise_id,
          home_score,
          away_score,
          start_time_utc,
          season_year,
          decade
        `)
        .eq("sport_id", sportId)
        .eq("status", "final")
        .not("home_score", "is", null)
        .not("away_score", "is", null)
        .order("start_time_utc", { ascending: false })
        .limit(limit);

      if (queryError) {
        console.error(`[SYNC] Query error for ${sportId}: ${queryError.message}`);
        counters.errors++;
        continue;
      }

      if (!missingGames || missingGames.length === 0) {
        console.log(`[SYNC] No games found for ${sportId}`);
        continue;
      }

      // Get existing matchup_games game_ids in batches to avoid 1000 row limit
      const existingGameIds = new Set<string>();
      
      // Fetch in batches of 1000
      for (let offset = 0; offset < 50000; offset += 1000) {
        const { data: batch } = await supabase
          .from("matchup_games")
          .select("game_id")
          .eq("sport_id", sportId)
          .range(offset, offset + 999);
        
        if (!batch || batch.length === 0) break;
        for (const m of batch) existingGameIds.add(m.game_id);
      }

      console.log(`[SYNC] Found ${existingGameIds.size} existing matchup_games for ${sportId}`);

      const gamesToSync = missingGames.filter(g => !existingGameIds.has(g.id));

      counters.by_sport[sportId].missing = gamesToSync.length;
      counters.total_missing += gamesToSync.length;

      if (gamesToSync.length === 0) {
        console.log(`[SYNC] All ${sportId} games already synced`);
        continue;
      }

      console.log(`[SYNC] Found ${gamesToSync.length} ${sportId} games missing from matchup_games`);

      // Prepare batch inserts
      const matchupsToInsert = [];
      let skipNoTeam = 0;
      let skipNoTotal = 0;

      for (const game of gamesToSync) {
        const homeTeamId = game.home_team_id;
        const awayTeamId = game.away_team_id;
        const homeFranchiseId = game.home_franchise_id;
        const awayFranchiseId = game.away_franchise_id;

        if (!homeTeamId || !awayTeamId) {
          skipNoTeam++;
          continue;
        }

        const total = Number(game.home_score) + Number(game.away_score);
        if (isNaN(total) || total === 0) {
          skipNoTotal++;
          continue;
        }

        const [teamLowId, teamHighId] = [homeTeamId, awayTeamId].sort();
        const [franchiseLowId, franchiseHighId] = homeFranchiseId && awayFranchiseId
          ? [homeFranchiseId, awayFranchiseId].sort()
          : [null, null];

        matchupsToInsert.push({
          sport_id: sportId,
          game_id: game.id,
          team_low_id: teamLowId,
          team_high_id: teamHighId,
          franchise_low_id: franchiseLowId,
          franchise_high_id: franchiseHighId,
          total,
          played_at_utc: game.start_time_utc,
          season_year: game.season_year,
          decade: game.decade,
        });
      }

      console.log(`[SYNC] Prepared ${matchupsToInsert.length} inserts, skipped: ${skipNoTeam} no team, ${skipNoTotal} no total`);

      // Batch insert - use plain insert since we already filtered existing
      const BATCH_SIZE = 500;
      for (let i = 0; i < matchupsToInsert.length; i += BATCH_SIZE) {
        const batch = matchupsToInsert.slice(i, i + BATCH_SIZE);
        
        const { error: insertError } = await supabase
          .from("matchup_games")
          .insert(batch);

        if (insertError) {
          // Skip duplicate key errors
          if (!insertError.message?.includes("duplicate")) {
            console.error(`[SYNC] Insert error: ${insertError.message}`);
            counters.errors++;
          }
        } else {
          counters.synced += batch.length;
          counters.by_sport[sportId].synced += batch.length;
        }

        // Small delay between batches
        if (i + BATCH_SIZE < matchupsToInsert.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      console.log(`[SYNC] Synced ${counters.by_sport[sportId].synced} ${sportId} games`);
    }

    // Update job run
    if (jobRunId) {
      await supabase
        .from("job_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          details: { ...counters, status: "complete" },
        })
        .eq("id", jobRunId);
    }

    console.log(`[SYNC] Complete: ${counters.synced} synced, ${counters.errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        ...counters,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[SYNC] Fatal error: ${error}`);

    if (jobRunId) {
      await supabase
        .from("job_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          details: { error: String(error), counters },
        })
        .eq("id", jobRunId);
    }

    return new Response(
      JSON.stringify({ error: String(error), counters }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
