import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const importToken = Deno.env.get('IMPORT_TOKEN');
  if (!importToken) {
    console.error('[IMPORT-STATUS] IMPORT_TOKEN secret not configured');
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== importToken) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get game counts by sport
    const { data: gameCounts, error: gameError } = await supabase
      .from('games')
      .select('sport_id')
      .eq('status', 'final');

    if (gameError) {
      throw new Error(`Failed to fetch game counts: ${gameError.message}`);
    }

    const gamesBySport: Record<string, number> = {};
    for (const game of gameCounts || []) {
      gamesBySport[game.sport_id] = (gamesBySport[game.sport_id] || 0) + 1;
    }

    // Get matchup counts by sport
    const { data: matchupCounts, error: matchupError } = await supabase
      .from('matchup_games')
      .select('sport_id');

    if (matchupError) {
      throw new Error(`Failed to fetch matchup counts: ${matchupError.message}`);
    }

    const matchupsBySport: Record<string, number> = {};
    for (const m of matchupCounts || []) {
      matchupsBySport[m.sport_id] = (matchupsBySport[m.sport_id] || 0) + 1;
    }

    // Get last 5 import job runs
    const { data: recentJobs, error: jobsError } = await supabase
      .from('job_runs')
      .select('id, job_name, started_at, finished_at, status, details')
      .eq('job_name', 'import-games')
      .order('started_at', { ascending: false })
      .limit(5);

    if (jobsError) {
      console.warn('[IMPORT-STATUS] Failed to fetch job runs:', jobsError);
    }

    // Get last import timestamp
    const lastImport = recentJobs && recentJobs.length > 0 
      ? recentJobs[0].finished_at || recentJobs[0].started_at
      : null;

    console.log('[IMPORT-STATUS] Status fetched successfully');

    return new Response(JSON.stringify({
      games_by_sport: gamesBySport,
      matchups_by_sport: matchupsBySport,
      total_games: Object.values(gamesBySport).reduce((a, b) => a + b, 0),
      total_matchups: Object.values(matchupsBySport).reduce((a, b) => a + b, 0),
      last_import: lastImport,
      recent_jobs: (recentJobs || []).map(j => ({
        id: j.id,
        started_at: j.started_at,
        finished_at: j.finished_at,
        status: j.status,
        counters: (j.details as any)?.counters || null,
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[IMPORT-STATUS] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
