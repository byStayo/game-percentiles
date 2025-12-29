import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Get today's date in ET timezone
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

// Get date string for N days from today
function getDateOffset(daysAhead: number): string {
  const now = new Date()
  const etOffset = -5 * 60 // EST offset
  const etDate = new Date(now.getTime() + (etOffset - now.getTimezoneOffset()) * 60000)
  etDate.setDate(etDate.getDate() + daysAhead)
  return etDate.toISOString().split('T')[0]
}

// Helper to call edge functions
async function callEdgeFunction(functionName: string, body: Record<string, unknown> = {}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[MORNING] ${functionName} failed: ${response.status} - ${errorText}`)
      return { success: false, error: `${response.status}: ${errorText}` }
    }

    const data = await response.json()
    console.log(`[MORNING] ${functionName} completed:`, JSON.stringify(data).slice(0, 200))
    return { success: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[MORNING] ${functionName} error:`, message)
    return { success: false, error: message }
  }
}

// Sleep helper
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const results: Record<string, { success: boolean; data?: unknown; error?: string }> = {}
  const startTime = Date.now()

  try {
    let requestBody: { days_ahead?: number; skip_odds?: boolean } = {}
    try {
      requestBody = await req.json()
    } catch {
      // Empty body is OK
    }

    const daysAhead = requestBody.days_ahead ?? 7 // Default to 7 days
    const skipOdds = requestBody.skip_odds ?? false
    const today = getTodayET()

    console.log(`[MORNING] Starting comprehensive refresh for ${daysAhead} days starting ${today}`)

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({
        job_name: 'morning-refresh',
        status: 'running',
        details: { today, days_ahead: daysAhead },
      })
      .select()
      .single()

    const jobRunId = jobRun?.id

    // ================================================================
    // STEP 1: Unified BDL sync - games, odds, injuries, standings
    // Maximizes BallDontLie GOAT tier (600 req/min)
    // ================================================================
    console.log(`[MORNING] Step 1: Unified BDL sync for ${daysAhead} days`)
    
    results['bdl_sync'] = await callEdgeFunction('bdl-sync', {
      days_ahead: daysAhead,
      days_back: 1, // Include yesterday for score updates
      sports: ['nfl', 'nba'],
      sync_games: true,
      sync_odds: true,
      sync_injuries: true,
      sync_standings: true,
    })
    
    await sleep(1000)

    // ================================================================
    // STEP 2: Refresh odds for NHL/MLB (fallback to The Odds API)
    // ================================================================
    if (!skipOdds) {
      console.log(`[MORNING] Step 2: Refreshing NHL/MLB odds`)
      results['refresh_odds'] = await callEdgeFunction('refresh-odds', {})
      await sleep(1000)
    }

    // ================================================================
    // STEP 3: Prewarm matchup data for the week (hydrate if needed)
    // ================================================================
    console.log(`[MORNING] Step 3: Prewarming matchups for ${daysAhead} days`)
    
    for (let i = 0; i < Math.min(daysAhead, 3); i++) { // Only prewarm next 3 days to save API calls
      const date = getDateOffset(i)
      const key = `prewarm_day_${i}`
      results[key] = await callEdgeFunction('prewarm-slate', { date })
      
      // Rate limit between prewarm calls
      if (i < 2) {
        await sleep(2000)
      }
    }

    // ================================================================
    // STEP 4: Run data health check to fix any missing franchise IDs
    // ================================================================
    console.log(`[MORNING] Step 4: Running data health check`)
    results['data_health_check'] = await callEdgeFunction('data-health-check', {
      days_ahead: daysAhead,
      days_back: 1,
      sports: ['nba', 'nfl', 'nhl', 'mlb'],
    })
    await sleep(500)

    // ================================================================
    // STEP 5: Compute percentiles for today (priority)
    // ================================================================
    console.log(`[MORNING] Step 5: Computing percentiles for today`)
    results['compute_today'] = await callEdgeFunction('compute-percentiles', {
      date: today,
      use_recency_weighted: true,
    })

    // ================================================================
    // STEP 6: Compute percentiles for upcoming days
    // ================================================================
    console.log(`[MORNING] Step 6: Computing percentiles for upcoming days`)
    
    for (let i = 1; i < Math.min(daysAhead, 3); i++) { // Compute next 2 days
      const date = getDateOffset(i)
      const key = `compute_day_${i}`
      results[key] = await callEdgeFunction('compute-percentiles', {
        date,
        use_recency_weighted: true,
      })
      await sleep(500)
    }

    // ================================================================
    // STEP 7: Daily backfill to get yesterday's final scores
    // ================================================================
    console.log(`[MORNING] Step 7: Running daily backfill for final scores`)
    results['daily_backfill'] = await callEdgeFunction('daily-backfill', {})

    // ================================================================
    // STEP 8: Update parlay results with any finalized games
    // ================================================================
    console.log(`[MORNING] Step 8: Updating parlay results`)
    results['update_parlays'] = await callEdgeFunction('update-parlay-results', {})

    // Calculate summary
    const totalSteps = Object.keys(results).length
    const successfulSteps = Object.values(results).filter(r => r.success).length
    const failedSteps = totalSteps - successfulSteps
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    // Update job run
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          status: failedSteps > 0 ? 'partial' : 'success',
          finished_at: new Date().toISOString(),
          details: {
            today,
            days_ahead: daysAhead,
            duration_seconds: Number(duration),
            total_steps: totalSteps,
            successful_steps: successfulSteps,
            failed_steps: failedSteps,
            results,
          },
        })
        .eq('id', jobRunId)
    }

    console.log(`[MORNING] Complete: ${successfulSteps}/${totalSteps} steps in ${duration}s`)

    return new Response(
      JSON.stringify({
        success: failedSteps === 0,
        today,
        days_ahead: daysAhead,
        duration_seconds: Number(duration),
        summary: {
          total: totalSteps,
          success: successfulSteps,
          failed: failedSteps,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[MORNING] Fatal error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message, results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})