import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse cron schedule to human-readable format
function parseCronSchedule(schedule: string): string {
  const parts = schedule.split(' ');
  if (parts.length !== 5) return schedule;
  
  const [minute, hour, , ,] = parts;
  
  // Every X minutes pattern
  if (minute.includes('/')) {
    const interval = minute.split('/')[1];
    return `Every ${interval} min`;
  }
  
  // Every hour at specific minute
  if (hour === '*' && minute !== '*') {
    return `Hourly at :${minute.padStart(2, '0')}`;
  }
  
  // Specific hours
  if (hour !== '*' && minute !== '*') {
    const hours = hour.split(',');
    if (hours.length > 4) {
      return `${hours.length}x/day at :${minute.padStart(2, '0')}`;
    }
    const times = hours.slice(0, 3).map(h => {
      const hourNum = parseInt(h);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const hour12 = hourNum % 12 || 12;
      return `${hour12}:${minute.padStart(2, '0')}${ampm}`;
    });
    return times.join(', ') + (hours.length > 3 ? '...' : '') + ' UTC';
  }
  
  return schedule;
}

// Calculate next run time from cron schedule
function getNextRun(schedule: string): string | null {
  const parts = schedule.split(' ');
  if (parts.length !== 5) return null;
  
  const [minute, hour] = parts;
  const now = new Date();
  
  try {
    // Every X minutes
    if (minute.includes('/')) {
      const interval = parseInt(minute.split('/')[1]);
      const currentMin = now.getUTCMinutes();
      const nextMin = Math.ceil(currentMin / interval) * interval;
      const next = new Date(now);
      next.setUTCSeconds(0, 0);
      if (nextMin >= 60) {
        next.setUTCHours(next.getUTCHours() + 1);
        next.setUTCMinutes(nextMin - 60);
      } else {
        next.setUTCMinutes(nextMin);
      }
      if (next <= now) {
        next.setUTCMinutes(next.getUTCMinutes() + interval);
      }
      return next.toISOString();
    }
    
    // Hourly at specific minute
    if (hour === '*' && minute !== '*') {
      const min = parseInt(minute);
      const next = new Date(now);
      next.setUTCSeconds(0, 0);
      next.setUTCMinutes(min);
      if (next <= now) {
        next.setUTCHours(next.getUTCHours() + 1);
      }
      return next.toISOString();
    }
    
    // Specific hours
    if (hour !== '*' && minute !== '*') {
      const hours = hour.split(',').map(h => parseInt(h)).sort((a, b) => a - b);
      const min = parseInt(minute);
      
      for (const h of hours) {
        const next = new Date(now);
        next.setUTCSeconds(0, 0);
        next.setUTCHours(h, min);
        if (next > now) return next.toISOString();
      }
      
      // Tomorrow
      const next = new Date(now);
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(hours[0], min, 0, 0);
      return next.toISOString();
    }
  } catch {
    return null;
  }
  
  return null;
}

// Extract function name from command
function extractFunctionName(command: string): string {
  const match = command.match(/functions\/v1\/([a-z-]+)/);
  return match ? match[1] : 'unknown';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[API/CRON-STATUS] Fetching cron job data');

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) {
      throw new Error('SUPABASE_DB_URL not configured');
    }

    sql = postgres(dbUrl, { ssl: 'require' });

    // Fetch cron jobs
    const jobs = await sql`
      SELECT jobid, jobname, schedule, active, command 
      FROM cron.job 
      ORDER BY jobname
    `;

    // Fetch recent run history (last 24h)
    const runs = await sql`
      SELECT jobid, runid, status, return_message, start_time, end_time 
      FROM cron.job_run_details 
      WHERE start_time > NOW() - INTERVAL '24 hours'
      ORDER BY start_time DESC
      LIMIT 100
    `;

    console.log(`[API/CRON-STATUS] Found ${jobs.length} jobs, ${runs.length} runs in 24h`);

    // Process jobs
    const processedJobs = jobs.map(job => {
      const jobRuns = runs.filter(r => r.jobid === job.jobid);
      const lastRun = jobRuns[0] || null;
      const successCount = jobRuns.filter(r => r.status === 'succeeded').length;
      const failCount = jobRuns.filter(r => r.status === 'failed').length;
      
      return {
        id: job.jobid,
        name: job.jobname,
        function: extractFunctionName(job.command),
        schedule: job.schedule,
        schedule_human: parseCronSchedule(job.schedule),
        active: job.active,
        next_run: getNextRun(job.schedule),
        last_run: lastRun ? {
          status: lastRun.status,
          started_at: lastRun.start_time,
          ended_at: lastRun.end_time,
          duration_ms: lastRun.start_time && lastRun.end_time 
            ? new Date(lastRun.end_time).getTime() - new Date(lastRun.start_time).getTime()
            : null,
        } : null,
        stats_24h: {
          success: successCount,
          failed: failCount,
          total: jobRuns.length,
        },
      };
    });

    // Recent runs for activity feed
    const recentRuns = runs.slice(0, 15).map(r => {
      const job = jobs.find(j => j.jobid === r.jobid);
      return {
        job_name: job?.jobname || `Job #${r.jobid}`,
        function: job ? extractFunctionName(job.command) : 'unknown',
        status: r.status,
        started_at: r.start_time,
        duration_ms: r.start_time && r.end_time 
          ? new Date(r.end_time).getTime() - new Date(r.start_time).getTime()
          : null,
      };
    });

    // Summary stats
    const totalRuns = runs.length;
    const successRuns = runs.filter(r => r.status === 'succeeded').length;

    await sql.end();

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        jobs: processedJobs,
        recent_runs: recentRuns,
        summary: {
          total_jobs: jobs.length,
          active_jobs: jobs.filter(j => j.active).length,
          runs_24h: totalRuns,
          success_rate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 100,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[API/CRON-STATUS] Error:', error);
    if (sql) await sql.end();
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        jobs: [],
        recent_runs: [],
        summary: { total_jobs: 0, active_jobs: 0, runs_24h: 0, success_rate: 100 },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
