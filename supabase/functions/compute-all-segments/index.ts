import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * SEGMENT DEFINITIONS
 * Time windows for historical analysis with confidence weights
 */
const SEGMENTS = [
  { key: 'h2h_1y', yearsBack: 1, label: 'Last 1 Year', recencyWeight: 1.0 },
  { key: 'h2h_3y', yearsBack: 3, label: 'Last 3 Years', recencyWeight: 0.85 },
  { key: 'h2h_5y', yearsBack: 5, label: 'Last 5 Years', recencyWeight: 0.7 },
  { key: 'h2h_10y', yearsBack: 10, label: 'Last 10 Years', recencyWeight: 0.5 },
  { key: 'h2h_all', yearsBack: null, label: 'All Time', recencyWeight: 0.3 },
]

// Minimum games needed for statistical significance
const MIN_GAMES_EXCELLENT = 15  // 90%+ confidence
const MIN_GAMES_GOOD = 10       // 70%+ confidence  
const MIN_GAMES_FAIR = 5        // 50%+ confidence
const MIN_GAMES_MINIMUM = 3    // Can use but low confidence

interface SegmentStats {
  segment_key: string
  label: string
  n_games: number
  p05: number
  p95: number
  median: number
  min_total: number
  max_total: number
  range: number
  confidence: number
  confidence_label: string
  is_recommended: boolean
  recency_weight: number
  games_breakdown?: {
    by_year: Record<number, number>
  }
}

interface MatchupResult {
  sport_id: string
  team_low_id: string
  team_high_id: string
  franchise_low_id: string | null
  franchise_high_id: string | null
  segments: SegmentStats[]
  recommended_segment: string
  recommendation_reason: string
  total_historical_games: number
  data_quality: 'excellent' | 'good' | 'fair' | 'low' | 'insufficient'
}

/**
 * Calculate confidence score (0-100) based on:
 * - Sample size (40% weight)
 * - Recency (30% weight)
 * - Roster continuity (30% weight - if available)
 */
function calculateConfidence(
  nGames: number,
  recencyWeight: number,
  rosterContinuity: number | null = null
): { score: number; label: string } {
  // Sample size score (0-100)
  let sampleScore = 0
  if (nGames >= MIN_GAMES_EXCELLENT) sampleScore = 100
  else if (nGames >= MIN_GAMES_GOOD) sampleScore = 70 + (nGames - MIN_GAMES_GOOD) * 6
  else if (nGames >= MIN_GAMES_FAIR) sampleScore = 50 + (nGames - MIN_GAMES_FAIR) * 4
  else if (nGames >= MIN_GAMES_MINIMUM) sampleScore = 20 + (nGames - MIN_GAMES_MINIMUM) * 15
  else sampleScore = nGames * 6

  // Recency score (0-100)
  const recencyScore = recencyWeight * 100

  // Roster continuity score (0-100), default to 50% if unknown
  const rosterScore = rosterContinuity !== null ? rosterContinuity : 50

  // Weighted average
  const score = Math.round(
    sampleScore * 0.4 +
    recencyScore * 0.3 +
    rosterScore * 0.3
  )

  // Determine label
  let label: string
  if (score >= 80) label = 'Excellent'
  else if (score >= 60) label = 'Good'
  else if (score >= 40) label = 'Fair'
  else if (score >= 20) label = 'Low'
  else label = 'Insufficient'

  return { score, label }
}

/**
 * Select the best segment based on confidence and data availability
 */
function selectRecommendedSegment(segments: SegmentStats[]): { 
  segment: string
  reason: string 
} {
  // Filter segments with minimum games
  const validSegments = segments.filter(s => s.n_games >= MIN_GAMES_MINIMUM)
  
  if (validSegments.length === 0) {
    return { 
      segment: 'insufficient', 
      reason: 'Not enough historical data for reliable analysis' 
    }
  }

  // Strategy: Prefer most recent segment that has sufficient data
  // "Same players = more predictive" - recency wins when data is available
  
  // First, check if we have excellent recent data (1y or 3y with n>=10)
  const recentExcellent = validSegments.find(
    s => (s.segment_key === 'h2h_1y' || s.segment_key === 'h2h_3y') && s.n_games >= MIN_GAMES_GOOD
  )
  if (recentExcellent) {
    return {
      segment: recentExcellent.segment_key,
      reason: `${recentExcellent.n_games} games in ${recentExcellent.label} - most relevant with current rosters`
    }
  }

  // Otherwise, find the segment with highest confidence
  const sorted = [...validSegments].sort((a, b) => {
    // Primary: confidence score
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    // Secondary: recency (prefer more recent)
    return b.recency_weight - a.recency_weight
  })

  const best = sorted[0]
  return {
    segment: best.segment_key,
    reason: `${best.n_games} games (${best.confidence_label} confidence) - best balance of sample size and recency`
  }
}

/**
 * Compute percentiles for a given set of totals
 */
function computePercentiles(totals: number[]): {
  p05: number
  p95: number
  median: number
  min: number
  max: number
} {
  const sorted = [...totals].sort((a, b) => a - b)
  const n = sorted.length

  const p05Index = Math.max(0, Math.ceil(0.05 * n) - 1)
  const p95Index = Math.min(n - 1, Math.ceil(0.95 * n) - 1)
  const medianIndex = Math.floor(n / 2)

  return {
    p05: sorted[p05Index],
    p95: sorted[p95Index],
    median: n % 2 === 0 ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2 : sorted[medianIndex],
    min: sorted[0],
    max: sorted[n - 1],
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { 
      sport_id, 
      home_team_id, 
      away_team_id,
      home_franchise_id,
      away_franchise_id,
      home_roster_continuity,
      away_roster_continuity,
    } = await req.json()

    if (!sport_id || !home_team_id || !away_team_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sport_id, home_team_id, away_team_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const currentYear = new Date().getFullYear()
    
    // Normalize IDs (low/high for consistent lookups)
    const [teamLowId, teamHighId] = [home_team_id, away_team_id].sort()
    const [franchiseLowId, franchiseHighId] = home_franchise_id && away_franchise_id
      ? [home_franchise_id, away_franchise_id].sort()
      : [null, null]
    
    const usesFranchise = franchiseLowId && franchiseHighId
    
    // Average roster continuity for confidence calculation
    const avgRosterContinuity = home_roster_continuity !== undefined && away_roster_continuity !== undefined
      ? (home_roster_continuity + away_roster_continuity) / 2
      : null

    console.log(`[SEGMENTS] Computing all segments for ${sport_id}: ${teamLowId} vs ${teamHighId}`)

    // Fetch ALL historical games for this matchup
    let allGamesQuery = supabase
      .from('matchup_games')
      .select('total, season_year, played_at_utc')
      .eq('sport_id', sport_id)
      .order('played_at_utc', { ascending: false })

    if (usesFranchise) {
      allGamesQuery = allGamesQuery
        .eq('franchise_low_id', franchiseLowId)
        .eq('franchise_high_id', franchiseHighId)
    } else {
      allGamesQuery = allGamesQuery
        .eq('team_low_id', teamLowId)
        .eq('team_high_id', teamHighId)
    }

    const { data: allGames, error: gamesError } = await allGamesQuery

    if (gamesError) {
      throw new Error(`Failed to fetch games: ${gamesError.message}`)
    }

    const totalGames = allGames?.length || 0
    console.log(`[SEGMENTS] Found ${totalGames} total historical games`)

    // Compute stats for each segment
    const segmentStats: SegmentStats[] = []

    for (const segment of SEGMENTS) {
      // Filter games by time window
      const cutoffYear = segment.yearsBack !== null 
        ? currentYear - segment.yearsBack 
        : 0
      
      const segmentGames = (allGames || []).filter((g: any) => 
        (g.season_year || 0) >= cutoffYear
      )

      const nGames = segmentGames.length

      // Compute games breakdown by calendar year (from played_at_utc, not season_year)
      const byYear: Record<number, number> = {}
      segmentGames.forEach((g: any) => {
        // Use actual calendar year from played_at_utc, not season_year
        const playedYear = g.played_at_utc 
          ? new Date(g.played_at_utc).getFullYear()
          : g.season_year || currentYear
        byYear[playedYear] = (byYear[playedYear] || 0) + 1
      })

      if (nGames === 0) {
        // No games in this segment
        segmentStats.push({
          segment_key: segment.key,
          label: segment.label,
          n_games: 0,
          p05: 0,
          p95: 0,
          median: 0,
          min_total: 0,
          max_total: 0,
          range: 0,
          confidence: 0,
          confidence_label: 'Insufficient',
          is_recommended: false,
          recency_weight: segment.recencyWeight,
          games_breakdown: { by_year: byYear },
        })
        continue
      }

      // Calculate percentiles
      const totals = segmentGames.map((g: any) => Number(g.total))
      const { p05, p95, median, min, max } = computePercentiles(totals)

      // Calculate confidence
      const { score: confidence, label: confidenceLabel } = calculateConfidence(
        nGames,
        segment.recencyWeight,
        avgRosterContinuity
      )

      segmentStats.push({
        segment_key: segment.key,
        label: segment.label,
        n_games: nGames,
        p05,
        p95,
        median,
        min_total: min,
        max_total: max,
        range: p95 - p05,
        confidence,
        confidence_label: confidenceLabel,
        is_recommended: false,
        recency_weight: segment.recencyWeight,
        games_breakdown: { by_year: byYear },
      })
    }

    // Determine recommended segment
    const { segment: recommendedSegment, reason: recommendationReason } = selectRecommendedSegment(segmentStats)
    
    // Mark the recommended segment
    segmentStats.forEach(s => {
      s.is_recommended = s.segment_key === recommendedSegment
    })

    // Determine overall data quality
    const bestConfidence = Math.max(...segmentStats.map(s => s.confidence))
    let dataQuality: MatchupResult['data_quality']
    if (bestConfidence >= 80) dataQuality = 'excellent'
    else if (bestConfidence >= 60) dataQuality = 'good'
    else if (bestConfidence >= 40) dataQuality = 'fair'
    else if (bestConfidence >= 20) dataQuality = 'low'
    else dataQuality = 'insufficient'

    // Store/update all segment stats in matchup_stats table
    for (const stat of segmentStats) {
      if (stat.n_games === 0) continue

      const statsData = {
        sport_id,
        team_low_id: teamLowId,
        team_high_id: teamHighId,
        franchise_low_id: franchiseLowId,
        franchise_high_id: franchiseHighId,
        segment_key: stat.segment_key,
        n_games: stat.n_games,
        p05: stat.p05,
        p95: stat.p95,
        median: stat.median,
        min_total: stat.min_total,
        max_total: stat.max_total,
        updated_at: new Date().toISOString(),
      }

      // Upsert
      const { data: existing } = await supabase
        .from('matchup_stats')
        .select('id')
        .eq('sport_id', sport_id)
        .eq('team_low_id', teamLowId)
        .eq('team_high_id', teamHighId)
        .eq('segment_key', stat.segment_key)
        .maybeSingle()

      if (existing) {
        await supabase.from('matchup_stats').update(statsData).eq('id', existing.id)
      } else {
        await supabase.from('matchup_stats').insert(statsData)
      }
    }

    const result: MatchupResult = {
      sport_id,
      team_low_id: teamLowId,
      team_high_id: teamHighId,
      franchise_low_id: franchiseLowId,
      franchise_high_id: franchiseHighId,
      segments: segmentStats,
      recommended_segment: recommendedSegment,
      recommendation_reason: recommendationReason,
      total_historical_games: totalGames,
      data_quality: dataQuality,
    }

    console.log(`[SEGMENTS] Complete: ${totalGames} games, recommended: ${recommendedSegment} (${dataQuality})`)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[SEGMENTS] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
