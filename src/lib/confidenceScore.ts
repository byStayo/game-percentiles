/**
 * Data Confidence Score Calculator
 * 
 * Computes a single reliability metric (0-100) weighing:
 * - Sample size: More games = more reliable
 * - Recency: More recent games = more applicable
 * - Roster continuity: Similar rosters = more predictive
 */

export interface ConfidenceFactors {
  sampleSize: number;
  recencyScore: number;
  rosterContinuity: number;
}

export interface ConfidenceResult {
  score: number;
  label: 'Excellent' | 'Good' | 'Fair' | 'Low' | 'Insufficient';
  color: string;
  factors: ConfidenceFactors;
}

// Weights for each factor (must sum to 1)
const WEIGHTS = {
  sampleSize: 0.40,
  recency: 0.30,
  rosterContinuity: 0.30,
};

// Sample size scoring (0-100)
function scoreSampleSize(nGames: number): number {
  if (nGames >= 20) return 100;
  if (nGames >= 15) return 90;
  if (nGames >= 10) return 75;
  if (nGames >= 7) return 60;
  if (nGames >= 5) return 45;
  if (nGames >= 3) return 25;
  return Math.max(0, nGames * 8);
}

// Recency scoring based on segment used (0-100)
function scoreRecency(segment: string | null | undefined, gamesWithinYears?: { 
  within1y?: number; 
  within3y?: number; 
  within5y?: number;
  total?: number;
}): number {
  // If we have detailed recency data
  if (gamesWithinYears) {
    const { within1y = 0, within3y = 0, within5y = 0, total = 1 } = gamesWithinYears;
    if (total === 0) return 0;
    
    // Weight: 50% for 1y, 30% for 1-3y, 20% for 3-5y
    const recentRatio = (within1y * 0.5 + (within3y - within1y) * 0.3 + (within5y - within3y) * 0.2) / total;
    return Math.round(recentRatio * 100);
  }
  
  // Fall back to segment-based scoring
  if (!segment) return 50;
  
  switch (segment) {
    case 'recency_weighted':
      return 90;
    case 'h2h_10y':
      return 75;
    case 'h2h_20y':
      return 55;
    case 'h2h_all':
      return 40;
    case 'franchise_10y':
      return 60;
    case 'franchise_20y':
      return 45;
    case 'franchise_all':
      return 30;
    case 'insufficient':
      return 10;
    default:
      return 50;
  }
}

// Roster continuity scoring (0-100)
// Higher continuity = more applicable historical data
function scoreRosterContinuity(
  homeContinuity: number | null | undefined,
  awayContinuity: number | null | undefined
): number {
  // If no continuity data, assume moderate (50%)
  if (homeContinuity === null && awayContinuity === null) {
    return 50;
  }
  
  const home = homeContinuity ?? 50;
  const away = awayContinuity ?? 50;
  
  // Average both teams' continuity scores
  return Math.round((home + away) / 2);
}

/**
 * Calculate overall confidence score
 */
export function calculateConfidence(params: {
  nGames: number;
  segment?: string | null;
  homeContinuity?: number | null;
  awayContinuity?: number | null;
  recencyData?: {
    within1y?: number;
    within3y?: number;
    within5y?: number;
    total?: number;
  };
}): ConfidenceResult {
  const { nGames, segment, homeContinuity, awayContinuity, recencyData } = params;
  
  const factors: ConfidenceFactors = {
    sampleSize: scoreSampleSize(nGames),
    recencyScore: scoreRecency(segment, recencyData),
    rosterContinuity: scoreRosterContinuity(homeContinuity, awayContinuity),
  };
  
  // Weighted average
  const score = Math.round(
    factors.sampleSize * WEIGHTS.sampleSize +
    factors.recencyScore * WEIGHTS.recency +
    factors.rosterContinuity * WEIGHTS.rosterContinuity
  );
  
  // Determine label and color
  let label: ConfidenceResult['label'];
  let color: string;
  
  if (score >= 80) {
    label = 'Excellent';
    color = 'text-status-live';
  } else if (score >= 60) {
    label = 'Good';
    color = 'text-status-under';
  } else if (score >= 40) {
    label = 'Fair';
    color = 'text-yellow-500';
  } else if (score >= 20) {
    label = 'Low';
    color = 'text-status-over';
  } else {
    label = 'Insufficient';
    color = 'text-muted-foreground';
  }
  
  return { score, label, color, factors };
}

/**
 * Get recency factor as a simple percentage (0-100)
 * Higher = more recent/applicable data
 */
export function getRecencyFactor(params: {
  segment?: string | null;
  homeContinuity?: number | null;
  awayContinuity?: number | null;
}): { score: number; label: string; color: string } {
  const recency = scoreRecency(params.segment);
  const continuity = scoreRosterContinuity(params.homeContinuity, params.awayContinuity);
  
  // Combine recency and continuity for a "data applicability" score
  const score = Math.round((recency * 0.5) + (continuity * 0.5));
  
  let label: string;
  let color: string;
  
  if (score >= 75) {
    label = 'High';
    color = 'text-status-live';
  } else if (score >= 50) {
    label = 'Med';
    color = 'text-yellow-500';
  } else {
    label = 'Low';
    color = 'text-status-over';
  }
  
  return { score, label, color };
}
