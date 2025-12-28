import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParlayLeg {
  game_id: string;
  sport_id: string;
  pick: "over" | "under";
  line: number;
  hit_probability: number;
  home_team: string;
  away_team: string;
  result?: "hit" | "miss" | "pending";
  final_total?: number;
}

interface LockParlayRecord {
  id: string;
  created_at: string;
  num_legs: number;
  legs_hit: number;
  legs_pending: number;
  is_complete: boolean;
  is_win: boolean;
  combined_probability: number;
  legs: ParlayLeg[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("Starting parlay results update...");

    // Fetch all incomplete parlays
    const { data: incompleteParlays, error: fetchError } = await supabase
      .from("lock_parlay_history")
      .select("*")
      .eq("is_complete", false);

    if (fetchError) {
      throw new Error(`Failed to fetch parlays: ${fetchError.message}`);
    }

    if (!incompleteParlays || incompleteParlays.length === 0) {
      console.log("No incomplete parlays to update");
      return new Response(
        JSON.stringify({ message: "No incomplete parlays to update", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${incompleteParlays.length} incomplete parlays to check`);

    let updatedCount = 0;
    const updates: { id: string; changes: Partial<LockParlayRecord> }[] = [];

    for (const parlay of incompleteParlays) {
      const legs = parlay.legs as ParlayLeg[];
      let legsHit = 0;
      let legsPending = 0;
      let updatedLegs: ParlayLeg[] = [];

      // Collect all game IDs that need checking
      const gameIds = legs
        .filter(leg => leg.result === "pending" || !leg.result)
        .map(leg => leg.game_id);

      if (gameIds.length === 0) {
        // All legs already have results, calculate final state
        legsHit = legs.filter(l => l.result === "hit").length;
        const isComplete = true;
        const isWin = legsHit === legs.length;

        updates.push({
          id: parlay.id,
          changes: {
            legs_hit: legsHit,
            legs_pending: 0,
            is_complete: isComplete,
            is_win: isWin,
          }
        });
        continue;
      }

      // Fetch game results for pending legs
      const { data: games, error: gamesError } = await supabase
        .from("games")
        .select("id, final_total, status")
        .in("id", gameIds);

      if (gamesError) {
        console.error(`Error fetching games for parlay ${parlay.id}:`, gamesError.message);
        continue;
      }

      const gameMap = new Map(games?.map(g => [g.id, g]) || []);

      // Update each leg
      updatedLegs = legs.map(leg => {
        if (leg.result && leg.result !== "pending") {
          // Already has result
          if (leg.result === "hit") legsHit++;
          return leg;
        }

        const game = gameMap.get(leg.game_id);
        if (!game || game.status !== "final" || game.final_total === null) {
          // Game not finished yet
          legsPending++;
          return { ...leg, result: "pending" as const };
        }

        // Determine if leg hit
        const finalTotal = game.final_total;
        let result: "hit" | "miss";

        if (leg.pick === "over") {
          result = finalTotal > leg.line ? "hit" : "miss";
        } else {
          result = finalTotal < leg.line ? "hit" : "miss";
        }

        if (result === "hit") legsHit++;

        return {
          ...leg,
          result,
          final_total: finalTotal,
        };
      });

      const isComplete = legsPending === 0;
      const isWin = isComplete && legsHit === legs.length;

      // Check if anything changed
      if (
        parlay.legs_hit !== legsHit ||
        parlay.legs_pending !== legsPending ||
        parlay.is_complete !== isComplete
      ) {
        updates.push({
          id: parlay.id,
          changes: {
            legs: updatedLegs,
            legs_hit: legsHit,
            legs_pending: legsPending,
            is_complete: isComplete,
            is_win: isWin,
          }
        });
      }
    }

    // Apply updates
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("lock_parlay_history")
        .update(update.changes)
        .eq("id", update.id);

      if (updateError) {
        console.error(`Failed to update parlay ${update.id}:`, updateError.message);
      } else {
        updatedCount++;
        console.log(`Updated parlay ${update.id}: hit=${update.changes.legs_hit}, pending=${update.changes.legs_pending}, complete=${update.changes.is_complete}, win=${update.changes.is_win}`);
      }
    }

    console.log(`Successfully updated ${updatedCount} parlays`);

    return new Response(
      JSON.stringify({
        message: "Parlay results updated",
        checked: incompleteParlays.length,
        updated: updatedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating parlay results:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
