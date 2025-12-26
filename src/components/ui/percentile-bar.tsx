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
  const dkPosition = dkLine ? Math.min(Math.max(((dkLine - min) / totalRange) * 100, 4), 96) : null;

  const getIndicatorStyle = (percentile: number | null | undefined) => {
    if (percentile == null) return { bg: "bg-muted-foreground", ring: "ring-muted-foreground/20" };
    if (percentile <= 20) return { bg: "bg-status-under", ring: "ring-status-under/20" };
    if (percentile >= 80) return { bg: "bg-status-over", ring: "ring-status-over/20" };
    return { bg: "bg-status-edge", ring: "ring-status-edge/20" };
  };

  const indicatorStyle = getIndicatorStyle(dkPercentile);

  return (
    <div className={cn("", className)}>
      {/* Range labels */}
      <div className="flex justify-between items-center mb-2.5">
        <div className="text-xs">
          <span className="text-muted-foreground">Low </span>
          <span className="font-semibold tabular-nums">{p05.toFixed(1)}</span>
        </div>
        <div className="text-xs text-right">
          <span className="text-muted-foreground">High </span>
          <span className="font-semibold tabular-nums">{p95.toFixed(1)}</span>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-2.5 bg-secondary rounded-full overflow-hidden">
        {/* Range fill */}
        <div
          className="absolute h-full bg-gradient-to-r from-status-under/30 via-muted-foreground/20 to-status-over/30 rounded-full"
          style={{
            left: `${p05Position}%`,
            width: `${p95Position - p05Position}%`,
          }}
        />

        {/* Marker indicator */}
        {dkPosition !== null && (
          <div
            className={cn(
              "absolute top-1/2 w-4 h-4 rounded-full shadow-md ring-2 ring-background",
              indicatorStyle.bg
            )}
            style={{ 
              left: `${dkPosition}%`, 
              transform: 'translate(-50%, -50%)' 
            }}
          />
        )}
      </div>

      {/* DK line detail */}
      {dkLine !== null && dkLine !== undefined && dkPercentile !== null && dkPercentile !== undefined && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
            dkPercentile <= 20 ? "bg-status-under/10 text-status-under" :
            dkPercentile >= 80 ? "bg-status-over/10 text-status-over" :
            "bg-status-edge/10 text-status-edge"
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full", indicatorStyle.bg)} />
            P{Math.round(dkPercentile)}
          </span>
        </div>
      )}
    </div>
  );
}