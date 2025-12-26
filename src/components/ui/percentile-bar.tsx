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
  const padding = range * 0.15;
  const min = Math.max(0, p05 - padding);
  const max = p95 + padding;
  const totalRange = max - min;

  const p05Position = ((p05 - min) / totalRange) * 100;
  const p95Position = ((p95 - min) / totalRange) * 100;
  const dkPosition = dkLine ? Math.min(Math.max(((dkLine - min) / totalRange) * 100, 3), 97) : null;

  const getPercentileColor = (percentile: number | null | undefined) => {
    if (percentile == null) return "bg-muted-foreground";
    if (percentile <= 20) return "bg-percentile-low";
    if (percentile >= 80) return "bg-percentile-high";
    return "bg-percentile-mid";
  };

  const getPercentileTextColor = (percentile: number | null | undefined) => {
    if (percentile == null) return "text-muted-foreground";
    if (percentile <= 20) return "text-percentile-low";
    if (percentile >= 80) return "text-percentile-high";
    return "text-percentile-mid";
  };

  return (
    <div className={cn("relative", className)}>
      {/* Labels */}
      <div className="flex justify-between text-2xs text-muted-foreground mb-2">
        <span className="font-medium">P05: {p05.toFixed(1)}</span>
        <span className="font-medium">P95: {p95.toFixed(1)}</span>
      </div>

      {/* Bar container */}
      <div className="relative h-3 bg-secondary rounded-full">
        {/* P05-P95 range fill */}
        <div
          className="absolute h-full bg-muted-foreground/20 rounded-full"
          style={{
            left: `${p05Position}%`,
            width: `${p95Position - p05Position}%`,
          }}
        />

        {/* P05 marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-muted-foreground/60 rounded-full"
          style={{ left: `${p05Position}%` }}
        />

        {/* P95 marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-muted-foreground/60 rounded-full"
          style={{ left: `${p95Position}%` }}
        />

        {/* DK line marker */}
        {dkPosition !== null && (
          <div
            className={cn(
              "absolute top-1/2 w-4 h-4 rounded-full border-2 border-background shadow-md",
              getPercentileColor(dkPercentile)
            )}
            style={{ 
              left: `${dkPosition}%`, 
              transform: 'translate(-50%, -50%)' 
            }}
          />
        )}
      </div>

      {/* DK line label */}
      {dkLine !== null && dkLine !== undefined && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">DK Line:</span>
          <span className="text-sm font-semibold">{dkLine.toFixed(1)}</span>
          {dkPercentile !== null && dkPercentile !== undefined && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              dkPercentile <= 20 ? "bg-percentile-low/10" :
              dkPercentile >= 80 ? "bg-percentile-high/10" :
              "bg-percentile-mid/10",
              getPercentileTextColor(dkPercentile)
            )}>
              P{Math.round(dkPercentile)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
