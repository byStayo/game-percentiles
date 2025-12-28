import { cn } from "@/lib/utils";

interface MiniPercentileChartProps {
  p05: number | null;
  p95: number | null;
  dkLine: number | null;
  className?: string;
}

export function MiniPercentileChart({
  p05,
  p95,
  dkLine,
  className,
}: MiniPercentileChartProps) {
  if (p05 === null || p95 === null) return null;

  const range = p95 - p05;
  const padding = range * 0.15;
  const min = Math.max(0, p05 - padding);
  const max = p95 + padding;
  const totalRange = max - min;

  const p05Position = ((p05 - min) / totalRange) * 100;
  const p95Position = ((p95 - min) / totalRange) * 100;
  
  // Calculate DK line position, allowing it to go beyond visual bounds for "beyond extremes"
  let dkPosition: number | null = null;
  let isBeyondLow = false;
  let isBeyondHigh = false;
  
  if (dkLine !== null) {
    const rawPosition = ((dkLine - min) / totalRange) * 100;
    dkPosition = Math.min(Math.max(rawPosition, 2), 98);
    isBeyondLow = dkLine < p05;
    isBeyondHigh = dkLine > p95;
  }

  // Determine zone for coloring
  const getZone = () => {
    if (dkLine === null) return "neutral";
    if (isBeyondLow) return "over-extreme"; // DK line below p05 = strong over value
    if (isBeyondHigh) return "under-extreme"; // DK line above p95 = strong under value
    const dkPercentile = ((dkLine - p05) / range) * 100;
    if (dkPercentile <= 20) return "over";
    if (dkPercentile >= 80) return "under";
    return "neutral";
  };

  const zone = getZone();

  return (
    <div className={cn("w-full", className)}>
      {/* Chart */}
      <div className="relative h-5 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 bg-muted rounded-full" />
        
        {/* Historical range (p05 to p95) */}
        <div
          className={cn(
            "absolute h-1.5 rounded-full",
            zone === "over-extreme" && "bg-status-over/40",
            zone === "under-extreme" && "bg-status-under/40",
            zone === "over" && "bg-status-over/25",
            zone === "under" && "bg-status-under/25",
            zone === "neutral" && "bg-muted-foreground/20"
          )}
          style={{
            left: `${p05Position}%`,
            width: `${p95Position - p05Position}%`,
          }}
        />

        {/* P05 marker */}
        <div
          className="absolute w-0.5 h-3 bg-muted-foreground/50 rounded-full"
          style={{ left: `${p05Position}%`, transform: "translateX(-50%)" }}
        />

        {/* P95 marker */}
        <div
          className="absolute w-0.5 h-3 bg-muted-foreground/50 rounded-full"
          style={{ left: `${p95Position}%`, transform: "translateX(-50%)" }}
        />

        {/* DK Line marker */}
        {dkPosition !== null && (
          <>
            {/* Pulsing ring for beyond extremes */}
            {(isBeyondLow || isBeyondHigh) && (
              <div
                className={cn(
                  "absolute w-4 h-4 rounded-full animate-ping opacity-40",
                  isBeyondLow ? "bg-status-over" : "bg-status-under"
                )}
                style={{
                  left: `${dkPosition}%`,
                  transform: "translate(-50%, 0)",
                }}
              />
            )}
            {/* Main marker */}
            <div
              className={cn(
                "absolute w-3 h-3 rounded-full ring-2 ring-background shadow-sm z-10",
                zone === "over-extreme" && "bg-status-over",
                zone === "under-extreme" && "bg-status-under",
                zone === "over" && "bg-status-over",
                zone === "under" && "bg-status-under",
                zone === "neutral" && "bg-foreground"
              )}
              style={{
                left: `${dkPosition}%`,
                transform: "translate(-50%, 0)",
              }}
            />
          </>
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between items-center mt-0.5">
        <span className="text-2xs text-muted-foreground tabular-nums">{p05}</span>
        {dkLine !== null && (
          <span className={cn(
            "text-2xs font-medium tabular-nums",
            zone === "over-extreme" || zone === "over" ? "text-status-over" :
            zone === "under-extreme" || zone === "under" ? "text-status-under" :
            "text-muted-foreground"
          )}>
            DK: {dkLine}
          </span>
        )}
        <span className="text-2xs text-muted-foreground tabular-nums">{p95}</span>
      </div>
    </div>
  );
}
