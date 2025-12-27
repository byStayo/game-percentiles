import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Loader2 } from "lucide-react";
import type { SegmentKey } from "@/components/game/SegmentSelector";

interface SegmentTimelineProps {
  homeTeamId: string;
  awayTeamId: string;
  dkLine?: number | null;
}

interface SegmentData {
  segment: SegmentKey;
  label: string;
  n_games: number;
  p05: number | null;
  p95: number | null;
  median: number | null;
}

const TIMELINE_SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "h2h_1y", label: "1Y" },
  { key: "h2h_3y", label: "3Y" },
  { key: "h2h_5y", label: "5Y" },
  { key: "h2h_10y", label: "10Y" },
  { key: "h2h_20y", label: "20Y" },
  { key: "h2h_all", label: "All" },
];

export function SegmentTimeline({
  homeTeamId,
  awayTeamId,
  dkLine,
}: SegmentTimelineProps) {
  const [lowId, highId] = useMemo(
    () => [homeTeamId, awayTeamId].sort(),
    [homeTeamId, awayTeamId]
  );

  const { data: segmentStats, isLoading } = useQuery({
    queryKey: ["segment-timeline", lowId, highId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matchup_stats")
        .select("segment_key, n_games, p05, p95, median")
        .eq("team_low_id", lowId)
        .eq("team_high_id", highId)
        .in("segment_key", TIMELINE_SEGMENTS.map(s => s.key));

      if (error) throw error;
      return data || [];
    },
    enabled: !!lowId && !!highId,
  });

  const timelineData = useMemo(() => {
    if (!segmentStats) return [];
    
    return TIMELINE_SEGMENTS.map(({ key, label }) => {
      const stats = segmentStats.find(s => s.segment_key === key);
      return {
        segment: key,
        label,
        n_games: stats?.n_games ?? 0,
        p05: stats?.p05 ?? null,
        p95: stats?.p95 ?? null,
        median: stats?.median ?? null,
      };
    }).filter(d => d.n_games > 0);
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

  if (timelineData.length < 2) {
    return null;
  }

  // Calculate the overall range for scaling
  const allP05 = timelineData.map(d => d.p05).filter((v): v is number => v !== null);
  const allP95 = timelineData.map(d => d.p95).filter((v): v is number => v !== null);
  const minValue = Math.min(...allP05) - 5;
  const maxValue = Math.max(...allP95) + 5;
  const range = maxValue - minValue;

  const getPosition = (value: number) => ((value - minValue) / range) * 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          P05/P95 Range by Time Window
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Chart */}
        <div className="relative h-48 mb-4">
          {/* Background grid */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className="border-t border-border/30 relative"
              >
                <span className="absolute -left-1 -translate-x-full text-2xs text-muted-foreground tabular-nums">
                  {Math.round(minValue + (range * (100 - pct)) / 100)}
                </span>
              </div>
            ))}
          </div>

          {/* DK Line reference */}
          {dkLine && dkLine >= minValue && dkLine <= maxValue && (
            <div
              className="absolute left-8 right-0 border-t-2 border-dashed border-primary/50 z-10"
              style={{ top: `${100 - getPosition(dkLine)}%` }}
            >
              <span className="absolute right-0 -translate-y-1/2 text-2xs bg-primary/20 text-primary px-1 rounded">
                DK {dkLine}
              </span>
            </div>
          )}

          {/* Timeline bars */}
          <div className="absolute left-10 right-4 top-2 bottom-6 flex items-end justify-around">
            {timelineData.map((data, idx) => {
              if (data.p05 === null || data.p95 === null) return null;
              
              const bottom = getPosition(data.p05);
              const top = getPosition(data.p95);
              const height = top - bottom;
              const medianPos = data.median ? getPosition(data.median) : null;

              return (
                <div
                  key={data.segment}
                  className="flex flex-col items-center gap-1 flex-1"
                >
                  {/* Bar container */}
                  <div className="relative w-full h-full flex justify-center">
                    {/* Range bar */}
                    <div
                      className={cn(
                        "absolute w-6 rounded-md transition-all",
                        idx === 0 ? "bg-primary/70" : "bg-muted-foreground/30"
                      )}
                      style={{
                        bottom: `${bottom}%`,
                        height: `${height}%`,
                      }}
                    >
                      {/* P95 label */}
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xs tabular-nums font-medium">
                        {data.p95.toFixed(0)}
                      </span>
                      {/* Median line */}
                      {medianPos !== null && (
                        <div
                          className="absolute left-0 right-0 h-0.5 bg-foreground/80"
                          style={{
                            bottom: `${((medianPos - bottom) / height) * 100}%`,
                          }}
                        />
                      )}
                      {/* P05 label */}
                      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-2xs tabular-nums font-medium">
                        {data.p05.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex justify-around pl-10 pr-4">
          {timelineData.map((data) => (
            <div key={data.segment} className="flex flex-col items-center flex-1">
              <span className="text-xs font-medium">{data.label}</span>
              <span className="text-2xs text-muted-foreground">n={data.n_games}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-primary/70" />
            <span>Most Recent</span>
          </div>
          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <div className="w-3 h-0.5 bg-foreground/80" />
            <span>Median</span>
          </div>
          {dkLine && (
            <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <div className="w-3 border-t-2 border-dashed border-primary/50" />
              <span>DK Line</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}