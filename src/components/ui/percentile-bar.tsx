import { cn } from "@/lib/utils";

interface PercentileBarProps {
  p05: number;
  p95: number;
  dkLine?: number | null;
  dkPercentile?: number | null;
  className?: string;
}

export function PercentileBar({ p05, p95, dkLine, dkPercentile, className }: PercentileBarProps) {
  const range = p95 - p05;
  const padding = range * 0.1;
  const min = Math.max(0, p05 - padding);
  const max = p95 + padding;
  const totalRange = max - min;

  const p05Position = ((p05 - min) / totalRange) * 100;
  const p95Position = ((p95 - min) / totalRange) * 100;
  const dkPosition = dkLine ? ((dkLine - min) / totalRange) * 100 : null;

  const getPercentileColor = (percentile: number | null | undefined) => {
    if (percentile == null) return "bg-muted-foreground";
    if (percentile <= 10) return "bg-percentile-low";
    if (percentile >= 90) return "bg-percentile-high";
    return "bg-percentile-mid";
  };

  return (
    <div className={cn("relative", className)}>
      {/* Labels */}
      <div className="flex justify-between text-2xs text-muted-foreground mb-1">
        <span>P05: {p05.toFixed(1)}</span>
        <span>P95: {p95.toFixed(1)}</span>
      </div>

      {/* Bar container */}
      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
        {/* P05-P95 range */}
        <div
          className="absolute h-full bg-muted-foreground/30 rounded-full"
          style={{
            left: `${p05Position}%`,
            width: `${p95Position - p05Position}%`,
          }}
        />

        {/* P05 marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-muted-foreground"
          style={{ left: `${p05Position}%` }}
        />

        {/* P95 marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-muted-foreground"
          style={{ left: `${p95Position}%` }}
        />

        {/* DK line marker */}
        {dkPosition !== null && (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background shadow-sm",
              getPercentileColor(dkPercentile)
            )}
            style={{ left: `${Math.min(Math.max(dkPosition, 2), 98)}%`, transform: 'translate(-50%, -50%)' }}
          />
        )}
      </div>

      {/* DK line label */}
      {dkLine !== null && dkLine !== undefined && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className="text-2xs font-medium">DK: {dkLine.toFixed(1)}</span>
          {dkPercentile !== null && dkPercentile !== undefined && (
            <span className={cn(
              "text-2xs px-1.5 py-0.5 rounded-full font-medium",
              dkPercentile <= 10 ? "bg-percentile-low/10 text-percentile-low" :
              dkPercentile >= 90 ? "bg-percentile-high/10 text-percentile-high" :
              "bg-percentile-mid/10 text-percentile-mid"
            )}>
              P{Math.round(dkPercentile)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
