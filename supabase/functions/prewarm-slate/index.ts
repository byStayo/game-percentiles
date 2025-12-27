import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SPORTS = ["nba", "nfl", "nhl", "mlb"];

// Rate limit: max concurrent hydrations
const MAX_CONCURRENT = 3;
const HYDRATE_DELAY_MS = 500;

interface PrewarmCounters {
  total_matchups: number;
  already_sufficient: number;
  hydration_queued: number;
  hydration_success: number;
  hydration_failed: number;
  errors: number;
}

async function getTodayMatchups(date: string, sportId: string) {
  const { data: games, error } = await supabase
    .from("games")
    .select(`
      id,
      home_team_id,
      away_team_id,
      home_franchise_id,
      away_franchise_id,
      sport_id
    `)
    .eq("sport_id", sportId)
    .gte("start_time_utc", `${date}T00:00:00Z`)
    .lt("start_time_utc", `${date}T23:59:59Z`);

  if (error) {
    console.error(`[PREWARM] Error fetching games for ${sportId}:`, error.message);
    return [];
  }

  return games || [];
}

async function checkMatchupSufficiency(
  sportId: string,
  franchiseHighId: string,
  franchiseLowId: string
): Promise<boolean> {
  // Check if any segment has n >= 5
  const { data: stats } = await supabase
    .from("matchup_stats")
    .select("n_games, segment_key")
    .eq("sport_id", sportId)
    .eq("franchise_high_id", franchiseHighId)
    .eq("franchise_low_id", franchiseLowId)
    .gte("n_games", 5)
    .limit(1);

  return Boolean(stats && stats.length > 0);
}

async function hydrateMatchup(
  sportId: string,
  homeTeamId: string,
  awayTeamId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/hydrate-matchup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          sport_id: sportId,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          horizon_years: 10,
        }),
      }
    );

    if (!response.ok) {
      console.error(`[PREWARM] Hydration failed for ${sportId} ${homeTeamId} vs ${awayTeamId}: ${response.status}`);
      return false;
    }

    const result = await response.json();
    console.log(`[PREWARM] Hydrated ${sportId}: ${result.games_inserted || 0} games inserted`);
    return true;
  } catch (err) {
    console.error(`[PREWARM] Hydration error:`, err);
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prewarmSport(date: string, sportId: string, counters: PrewarmCounters) {
  console.log(`[PREWARM] Processing ${sportId} for ${date}`);
  
  const games = await getTodayMatchups(date, sportId);
  console.log(`[PREWARM] Found ${games.length} games for ${sportId}`);

  const hydrationQueue: Array<{
    sportId: string;
    homeTeamId: string;
    awayTeamId: string;
  }> = [];

  for (const game of games) {
    counters.total_matchups++;

    if (!game.home_franchise_id || !game.away_franchise_id) {
      console.log(`[PREWARM] Missing franchise IDs for game ${game.id}`);
      continue;
    }

    // Order franchise IDs consistently
    const [franchiseHighId, franchiseLowId] = game.home_franchise_id < game.away_franchise_id
      ? [game.away_franchise_id, game.home_franchise_id]
      : [game.home_franchise_id, game.away_franchise_id];

    const hasSufficientData = await checkMatchupSufficiency(
      sportId,
      franchiseHighId,
      franchiseLowId
    );

    if (hasSufficientData) {
      counters.already_sufficient++;
      continue;
    }

    // Queue for hydration
    hydrationQueue.push({
      sportId,
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
    });
    counters.hydration_queued++;
  }

  // Process hydration queue with rate limiting
  console.log(`[PREWARM] Hydrating ${hydrationQueue.length} matchups for ${sportId}`);
  
  for (let i = 0; i < hydrationQueue.length; i += MAX_CONCURRENT) {
    const batch = hydrationQueue.slice(i, i + MAX_CONCURRENT);
    
    const results = await Promise.all(
      batch.map((item) => hydrateMatchup(item.sportId, item.homeTeamId, item.awayTeamId))
    );

    results.forEach((success) => {
      if (success) {
        counters.hydration_success++;
      } else {
        counters.hydration_failed++;
      }
    });

    // Rate limit between batches
    if (i + MAX_CONCURRENT < hydrationQueue.length) {
      await sleep(HYDRATE_DELAY_MS);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let date: string;
    let sports = SPORTS;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      // Use ET timezone for date
      const now = new Date();
      const etOffset = -5 * 60; // EST offset in minutes
      const etDate = new Date(now.getTime() + (etOffset - now.getTimezoneOffset()) * 60000);
      date = body.date || etDate.toISOString().split("T")[0];
      if (body.sport) {
        sports = [body.sport];
      }
    } else {
      // Default to today in ET
      const now = new Date();
      const etOffset = -5 * 60;
      const etDate = new Date(now.getTime() + (etOffset - now.getTimezoneOffset()) * 60000);
      date = etDate.toISOString().split("T")[0];
    }

    console.log(`[PREWARM] Starting prewarm for ${date}, sports: ${sports.join(", ")}`);

    // Log job start
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "prewarm-slate",
        status: "running",
        details: { date, sports },
      })
      .select()
      .single();

    const counters: PrewarmCounters = {
      total_matchups: 0,
      already_sufficient: 0,
      hydration_queued: 0,
      hydration_success: 0,
      hydration_failed: 0,
      errors: 0,
    };

    // Process each sport
    for (const sportId of sports) {
      try {
        await prewarmSport(date, sportId, counters);
      } catch (err) {
        console.error(`[PREWARM] Error processing ${sportId}:`, err);
        counters.errors++;
      }
    }

    // Update job run
    if (jobRun) {
      await supabase
        .from("job_runs")
        .update({
          status: counters.errors > 0 ? "partial" : "success",
          finished_at: new Date().toISOString(),
          details: { date, sports, counters },
        })
        .eq("id", jobRun.id);
    }

    console.log(`[PREWARM] Complete:`, JSON.stringify(counters));

    return new Response(
      JSON.stringify({
        success: true,
        date,
        sports,
        counters,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[PREWARM] Fatal error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
