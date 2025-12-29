import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getTodayET(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function getDateOffset(startDate: string, daysAhead: number): string {
  // Start at noon UTC to avoid DST midnight weirdness, then format back to YYYY-MM-DD.
  const d = new Date(`${startDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

async function safeInvoke(supabase: any, fn: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    return { ok: false, error: error.message || String(error) };
  }
  return { ok: true, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let jobRunId: number | null = null;

  const startedAt = Date.now();

  try {
    const body = (await req.json().catch(() => ({}))) as {
      start_date?: string;
      days_ahead?: number;
      sports?: string[];
      skip_odds?: boolean;
      skip_prewarm?: boolean;
      use_recency_weighted?: boolean;
    };

    const startDate = body.start_date || getTodayET();
    const daysAhead = Math.max(0, Math.min(14, body.days_ahead ?? 7));
    const sports = (body.sports?.length ? body.sports : ["nfl", "nba"]).filter((s) => s === "nfl" || s === "nba");

    const skipOdds = Boolean(body.skip_odds);
    const skipPrewarm = Boolean(body.skip_prewarm);
    const useRecencyWeighted = body.use_recency_weighted ?? true;

    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "premium-week-refresh",
        status: "running",
        details: {
          start_date: startDate,
          days_ahead: daysAhead,
          sports,
          skip_odds: skipOdds,
          skip_prewarm: skipPrewarm,
          use_recency_weighted: useRecencyWeighted,
        },
      })
      .select()
      .single();

    jobRunId = jobRun?.id || null;

    const run = async () => {
      const results: Record<string, any> = {
        started_at: new Date().toISOString(),
        sports,
        dates: [],
        steps: {},
      };

      // 1) Repair historical gap for H2H (finals -> matchup_games)
      results.steps.sync = {};
      for (const sport of sports) {
        results.steps.sync[sport] = await safeInvoke(supabase, "sync-matchup-games", {
          sport,
          limit: 20000,
        });
      }

      // 2) For each date: ingest -> odds -> prewarm -> compute
      for (let d = 0; d <= daysAhead; d++) {
        const date = getDateOffset(startDate, d);
        results.dates.push(date);
        results.steps[date] = { ingest: {}, odds: {}, prewarm: {}, compute: null };

        for (const sport of sports) {
          // Ingest: NBA uses date, NFL ignores date (current-week), but passing date is harmless.
          results.steps[date].ingest[sport] = await safeInvoke(supabase, "ingest-games", {
            sport_id: sport,
            date,
          });

          if (!skipOdds) {
            results.steps[date].odds[sport] = await safeInvoke(supabase, "refresh-odds", {
              sport_id: sport,
              date,
            });
          }

          if (!skipPrewarm) {
            results.steps[date].prewarm[sport] = await safeInvoke(supabase, "prewarm-slate", {
              sport,
              date,
            });
          }
        }

        results.steps[date].compute = await safeInvoke(supabase, "compute-percentiles", {
          date,
          sports,
          use_recency_weighted: useRecencyWeighted,
        });
      }

      if (jobRunId) {
        await supabase
          .from("job_runs")
          .update({
            status: "success",
            finished_at: new Date().toISOString(),
            details: {
              ...results,
              duration_ms: Date.now() - startedAt,
            },
          })
          .eq("id", jobRunId);
      }
    };

    // Run in background so the HTTP request doesn't time out.
    // @ts-ignore - EdgeRuntime is available in Supabase edge runtime.
    EdgeRuntime.waitUntil(run());

    return new Response(
      JSON.stringify({
        success: true,
        started: true,
        job_run_id: jobRunId,
        start_date: startDate,
        days_ahead: daysAhead,
        sports,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (jobRunId) {
      await supabase
        .from("job_runs")
        .update({
          status: "fail",
          finished_at: new Date().toISOString(),
          details: { error: message },
        })
        .eq("id", jobRunId);
    }

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
