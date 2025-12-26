import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get today's date in America/New_York timezone
function getTodayET(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    console.log('[API/STATUS] Fetching system status')

    const today = getTodayET()

    // Get last successful job run for each job type
    const jobTypes = ['backfill', 'ingest', 'compute', 'odds_refresh']
    const lastJobs: Record<string, any> = {}

    for (const jobName of jobTypes) {
      const { data: job } = await supabase
        .from('job_runs')
        .select('*')
        .eq('job_name', jobName)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (job) {
        lastJobs[jobName] = {
          id: job.id,
          status: job.status,
          started_at: job.started_at,
          finished_at: job.finished_at,
          duration_ms: job.finished_at 
            ? new Date(job.finished_at).getTime() - new Date(job.started_at).getTime() 
            : null,
          counters: (job.details as any)?.counters || null,
        }
      }
    }

    // Get today's odds coverage stats
    const { data: edges } = await supabase
      .from('daily_edges')
      .select('sport_id, dk_offered, is_visible')
      .eq('date_local', today)

    const oddsStats = {
      total_games: edges?.length || 0,
      visible_games: edges?.filter(e => e.is_visible).length || 0,
      with_dk_odds: edges?.filter(e => e.dk_offered).length || 0,
      unmatched: edges?.filter(e => e.is_visible && !e.dk_offered).length || 0,
      by_sport: {} as Record<string, { total: number; with_odds: number }>,
    }

    for (const edge of edges || []) {
      if (!oddsStats.by_sport[edge.sport_id]) {
        oddsStats.by_sport[edge.sport_id] = { total: 0, with_odds: 0 }
      }
      if (edge.is_visible) {
        oddsStats.by_sport[edge.sport_id].total++
        if (edge.dk_offered) {
          oddsStats.by_sport[edge.sport_id].with_odds++
        }
      }
    }

    // Get recent unmatched reasons from odds_refresh job
    const { data: recentOddsJob } = await supabase
      .from('job_runs')
      .select('details')
      .eq('job_name', 'odds_refresh')
      .eq('status', 'success')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sampleUnmatched = (recentOddsJob?.details as any)?.sample_unmatched || []

    // Database stats
    const { count: teamsCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })

    const { count: gamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })

    const { count: matchupsCount } = await supabase
      .from('matchup_games')
      .select('*', { count: 'exact', head: true })

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        date_et: today,
        jobs: lastJobs,
        today_coverage: oddsStats,
        sample_unmatched: sampleUnmatched,
        database: {
          teams: teamsCount || 0,
          games: gamesCount || 0,
          matchup_games: matchupsCount || 0,
        },
        mode: 'strict_hardcoded',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[API/STATUS] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
