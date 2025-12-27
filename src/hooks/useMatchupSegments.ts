import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SegmentStats {
  segment_key: string;
  label: string;
  n_games: number;
  p05: number;
  p95: number;
  median: number;
  min_total: number;
  max_total: number;
  range: number;
  confidence: number;
  confidence_label: string;
  is_recommended: boolean;
  recency_weight: number;
  games_breakdown?: {
    by_year: Record<number, number>;
  };
}

export interface MatchupSegmentsResult {
  sport_id: string;
  team_low_id: string;
  team_high_id: string;
  franchise_low_id: string | null;
  franchise_high_id: string | null;
  segments: SegmentStats[];
  recommended_segment: string;
  recommendation_reason: string;
  total_historical_games: number;
  data_quality: 'excellent' | 'good' | 'fair' | 'low' | 'insufficient';
}

interface UseMatchupSegmentsParams {
  sportId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeFranchiseId?: string | null;
  awayFranchiseId?: string | null;
  homeRosterContinuity?: number | null;
  awayRosterContinuity?: number | null;
  enabled?: boolean;
}

/**
 * Hook to fetch all segment statistics for a matchup with confidence scores
 */
export function useMatchupSegments({
  sportId,
  homeTeamId,
  awayTeamId,
  homeFranchiseId,
  awayFranchiseId,
  homeRosterContinuity,
  awayRosterContinuity,
  enabled = true,
}: UseMatchupSegmentsParams) {
  return useQuery({
    queryKey: ['matchup-segments', sportId, homeTeamId, awayTeamId],
    queryFn: async (): Promise<MatchupSegmentsResult> => {
      const { data, error } = await supabase.functions.invoke('compute-all-segments', {
        body: {
          sport_id: sportId,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_franchise_id: homeFranchiseId,
          away_franchise_id: awayFranchiseId,
          home_roster_continuity: homeRosterContinuity,
          away_roster_continuity: awayRosterContinuity,
        },
      });

      if (error) {
        throw new Error(`Failed to compute segments: ${error.message}`);
      }

      return data;
    },
    enabled: enabled && !!sportId && !!homeTeamId && !!awayTeamId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}

/**
 * Get confidence color based on score
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-status-live';
  if (confidence >= 60) return 'text-green-500';
  if (confidence >= 40) return 'text-yellow-500';
  if (confidence >= 20) return 'text-orange-500';
  return 'text-muted-foreground';
}

/**
 * Get data quality color
 */
export function getDataQualityColor(quality: MatchupSegmentsResult['data_quality']): string {
  switch (quality) {
    case 'excellent': return 'text-status-live';
    case 'good': return 'text-green-500';
    case 'fair': return 'text-yellow-500';
    case 'low': return 'text-orange-500';
    case 'insufficient': return 'text-muted-foreground';
  }
}

/**
 * Get data quality badge variant
 */
export function getDataQualityVariant(quality: MatchupSegmentsResult['data_quality']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (quality) {
    case 'excellent':
    case 'good':
      return 'default';
    case 'fair':
      return 'secondary';
    case 'low':
    case 'insufficient':
      return 'outline';
  }
}
