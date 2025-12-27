import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { SegmentBadge } from "@/components/game/SegmentBadge";
import { Layers, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import type { SegmentKey } from "@/components/game/SegmentSelector";

interface SegmentComparisonProps {
  homeTeamId: string;
  awayTeamId: string;
  dkLine?: number | null;
}

interface SegmentStats {
  segment: SegmentKey;
  n_games: number;
  p05: number | null;
  p95: number | null;
  median: number | null;
  min_total: number | null;
  max_total: number | null;
}

const COMPARISON_SEGMENTS: SegmentKey[] = [
  "h2h_1y",
  "h2h_3y",
  "h2h_5y",
  "h2h_10y",
  "h2h_all",
];

const segmentLabels: Record<string, string> = {
  h2h_1y: "1 Year",
  h2h_3y: "3 Years",
  h2h_5y: "5 Years",
  h2h_10y: "10 Years",
  h2h_20y: "20 Years",
  h2h_all: "All-Time",
  recency_weighted: "Weighted",
};

export function SegmentComparison({
  homeTeamId,
  awayTeamId,
  dkLine,
}: SegmentComparisonProps) {
  const [lowId, highId] = useMemo(
    () => [homeTeamId, awayTeamId].sort(),
    [homeTeamId, awayTeamId]
  );

  const { data: segmentStats, isLoading } = useQuery({
    queryKey: ["segment-comparison", lowId, highId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matchup_stats")
        .select("segment_key, n_games, p05, p95, median, min_total, max_total")
        .eq("team_low_id", lowId)
        .eq("team_high_id", highId)
        .in("segment_key", COMPARISON_SEGMENTS);

      if (error) throw error;

      return (data || []).map((s) => ({
        segment: s.segment_key as SegmentKey,
        n_games: s.n_games,
        p05: s.p05,
        p95: s.p95,
        median: s.median,
        min_total: s.min_total,
        max_total: s.max_total,
      })) as SegmentStats[];
    },
    enabled: !!lowId && !!highId,
  });

  // Sort by segment order
  const sortedStats = useMemo(() => {
    if (!segmentStats) return [];
    return COMPARISON_SEGMENTS
      .map((seg) => segmentStats.find((s) => s.segment === seg))
      .filter((s): s is SegmentStats => s !== undefined && s.n_games >= 3);
  }, [segmentStats]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (sortedStats.length < 2) {
    return null;
  }

  // Calculate variance between segments
  const medians = sortedStats.map((s) => s.median).filter((m): m is number => m !== null);
  const medianVariance = medians.length > 1
    ? Math.max(...medians) - Math.min(...medians)
    : 0;

  const p05s = sortedStats.map((s) => s.p05).filter((p): p is number => p !== null);
  const p95s = sortedStats.map((s) => s.p95).filter((p): p is number => p !== null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Segment Comparison
          {medianVariance > 5 && (
            <span className="ml-auto text-2xs px-2 py-0.5 rounded-full bg-status-over/10 text-status-over">
              High variance: ±{medianVariance.toFixed(0)} pts
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comparison Grid */}
        <div className="space-y-3">
          {sortedStats.map((stats, idx) => {
            const prevStats = idx > 0 ? sortedStats[idx - 1] : null;
            const medianDiff = prevStats?.median && stats.median
              ? stats.median - prevStats.median
              : null;

            return (
              <div key={stats.segment} className="space-y-2">
                {/* Segment Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SegmentBadge segment={stats.segment} nUsed={stats.n_games} />
                    <span className="text-xs text-muted-foreground">
                      {stats.n_games} games
                    </span>
                  </div>
                  {medianDiff !== null && (
                    <div className={cn(
                      "flex items-center gap-1 text-xs font-medium",
                      medianDiff > 0 ? "text-status-over" :
                      medianDiff < 0 ? "text-status-under" : "text-muted-foreground"
                    )}>
                      {medianDiff > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : medianDiff < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                      {medianDiff > 0 ? "+" : ""}{medianDiff.toFixed(1)}
                    </div>
                  )}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <StatCell label="P05" value={stats.p05} />
                  <StatCell label="Median" value={stats.median} highlight />
                  <StatCell label="P95" value={stats.p95} />
                  <StatCell label="Range" value={
                    stats.min_total !== null && stats.max_total !== null
                      ? stats.max_total - stats.min_total
                      : null
                  } suffix=" pts" />
                </div>

                {/* Percentile Bar */}
                {stats.p05 !== null && stats.p95 !== null && (
                  <PercentileBar
                    p05={stats.p05}
                    p95={stats.p95}
                    dkLine={dkLine}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="pt-3 border-t border-border/40 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>P05 Range:</span>
            <span className="font-medium">
              {Math.min(...p05s).toFixed(0)} – {Math.max(...p05s).toFixed(0)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span>P95 Range:</span>
            <span className="font-medium">
              {Math.min(...p95s).toFixed(0)} – {Math.max(...p95s).toFixed(0)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCell({
  label,
  value,
  highlight = false,
  suffix = "",
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
  suffix?: string;
}) {
  return (
    <div className={cn(
      "p-2 rounded-lg",
      highlight ? "bg-primary/10" : "bg-secondary/30"
    )}>
      <div className="text-sm font-bold tabular-nums">
        {value !== null ? `${value.toFixed(1)}${suffix}` : "—"}
      </div>
      <div className="text-2xs text-muted-foreground">{label}</div>
    </div>
  );
}
