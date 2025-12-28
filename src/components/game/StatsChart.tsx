import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsChartProps {
  p05: number;
  p95: number;
  dkLine?: number | null;
  dkPercentile?: number | null;
  finalTotal?: number | null;
  bestOverEdge?: number | null;
  bestUnderEdge?: number | null;
  nH2H?: number;
  className?: string;
}

export function StatsChart({
  p05,
  p95,
  dkLine,
  dkPercentile,
  finalTotal,
  bestOverEdge,
  bestUnderEdge,
  nH2H,
  className,
}: StatsChartProps) {
  // Calculate median as midpoint (approximate since we don't have actual median)
  const median = Math.round((p05 + p95) / 2);
  
  // Determine recommendation
  const hasOverEdge = (bestOverEdge ?? 0) > 0;
  const hasUnderEdge = (bestUnderEdge ?? 0) > 0;
  const P = dkPercentile ?? 50;
  
  const getRecommendation = () => {
    if (hasOverEdge && (!hasUnderEdge || (bestOverEdge ?? 0) > (bestUnderEdge ?? 0))) {
      return { type: "over", edge: bestOverEdge };
    }
    if (hasUnderEdge) {
      return { type: "under", edge: bestUnderEdge };
    }
    if (P <= 30) return { type: "lean-over", edge: null };
    if (P >= 70) return { type: "lean-under", edge: null };
    return { type: "none", edge: null };
  };
  
  const rec = getRecommendation();
  const isOver = rec.type === "over" || rec.type === "lean-over";
  const isUnder = rec.type === "under" || rec.type === "lean-under";
  const hasRec = rec.type !== "none";

  // For visual positioning
  const range = p95 - p05;
  const padding = range * 0.15;
  const min = Math.max(0, p05 - padding);
  const max = p95 + padding;
  const totalRange = max - min;

  const getPosition = (value: number) => {
    return Math.min(Math.max(((value - min) / totalRange) * 100, 2), 98);
  };

  const p05Pos = getPosition(p05);
  const p95Pos = getPosition(p95);
  const medianPos = getPosition(median);
  const dkPos = dkLine != null ? getPosition(dkLine) : null;
  const finalPos = finalTotal != null ? getPosition(finalTotal) : null;

  const isFinal = finalTotal != null;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Main recommendation banner */}
      {hasRec && dkLine != null && !isFinal && (
        <div
          className={cn(
            "flex items-center justify-between px-3 py-2 rounded-lg",
            isOver && "bg-status-over/15 border border-status-over/30",
            isUnder && "bg-status-under/15 border border-status-under/30"
          )}
        >
          <div className="flex items-center gap-2">
            {isOver ? (
              <TrendingUp className="h-4 w-4 text-status-over" />
            ) : (
              <TrendingDown className="h-4 w-4 text-status-under" />
            )}
            <span className={cn(
              "text-sm font-semibold",
              isOver ? "text-status-over" : "text-status-under"
            )}>
              {rec.type === "over" ? "OVER" : rec.type === "under" ? "UNDER" : 
               rec.type === "lean-over" ? "LEAN OVER" : "LEAN UNDER"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-lg font-bold tabular-nums",
              isOver ? "text-status-over" : "text-status-under"
            )}>
              {dkLine}
            </span>
            {rec.edge != null && rec.edge > 0 && (
              <span className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded",
                isOver ? "bg-status-over/20 text-status-over" : "bg-status-under/20 text-status-under"
              )}>
                +{rec.edge.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats grid - show key numbers */}
      <div className="grid grid-cols-4 gap-1 text-center">
        <div className="px-1.5 py-1.5 rounded-md bg-status-under/10">
          <div className="text-2xs text-status-under font-medium uppercase tracking-wide">5%ile</div>
          <div className="text-sm font-bold text-status-under tabular-nums">{p05}</div>
        </div>
        <div className="px-1.5 py-1.5 rounded-md bg-muted/50">
          <div className="text-2xs text-muted-foreground font-medium uppercase tracking-wide">Median</div>
          <div className="text-sm font-bold text-foreground tabular-nums">{median}</div>
        </div>
        <div className="px-1.5 py-1.5 rounded-md bg-status-over/10">
          <div className="text-2xs text-status-over font-medium uppercase tracking-wide">95%ile</div>
          <div className="text-sm font-bold text-status-over tabular-nums">{p95}</div>
        </div>
        <div className={cn(
          "px-1.5 py-1.5 rounded-md",
          dkLine != null ? "bg-foreground/10" : "bg-muted/30"
        )}>
          <div className="text-2xs text-muted-foreground font-medium uppercase tracking-wide">Line</div>
          <div className={cn(
            "text-sm font-bold tabular-nums",
            dkLine != null ? "text-foreground" : "text-muted-foreground/50"
          )}>
            {dkLine ?? "—"}
          </div>
        </div>
      </div>

      {/* Visual bar chart */}
      <div className="relative pt-3 pb-1">
        {/* Track */}
        <div className="relative h-2.5 bg-secondary rounded-full overflow-visible">
          {/* Under zone (below p05) */}
          <div
            className="absolute h-full bg-status-under/20 rounded-l-full"
            style={{ left: 0, width: `${p05Pos}%` }}
          />
          
          {/* Neutral zone (p05 to p95) */}
          <div
            className="absolute h-full bg-muted-foreground/10"
            style={{ left: `${p05Pos}%`, width: `${p95Pos - p05Pos}%` }}
          />
          
          {/* Over zone (above p95) */}
          <div
            className="absolute h-full bg-status-over/20 rounded-r-full"
            style={{ left: `${p95Pos}%`, right: 0 }}
          />

          {/* Median tick */}
          <div
            className="absolute top-1/2 w-0.5 h-4 bg-muted-foreground/50 -translate-y-1/2"
            style={{ left: `${medianPos}%` }}
          />

          {/* P05 tick */}
          <div
            className="absolute top-1/2 w-1 h-5 bg-status-under/60 -translate-y-1/2 rounded-sm"
            style={{ left: `${p05Pos}%`, transform: `translateX(-50%) translateY(-50%)` }}
          />

          {/* P95 tick */}
          <div
            className="absolute top-1/2 w-1 h-5 bg-status-over/60 -translate-y-1/2 rounded-sm"
            style={{ left: `${p95Pos}%`, transform: `translateX(-50%) translateY(-50%)` }}
          />

          {/* DK Line marker - prominent */}
          {dkPos !== null && (
            <div
              className={cn(
                "absolute top-1/2 w-4 h-4 rounded-full shadow-md ring-2 ring-background z-10",
                isOver && "bg-status-over",
                isUnder && "bg-status-under",
                !hasRec && "bg-foreground"
              )}
              style={{
                left: `${dkPos}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {/* Inner dot for prominence */}
              <div className="absolute inset-1 rounded-full bg-white/30" />
            </div>
          )}

          {/* Final total marker */}
          {finalPos !== null && (
            <div
              className={cn(
                "absolute top-1/2 w-3 h-3 rotate-45 ring-2 ring-background shadow-sm z-20",
                finalTotal! > (dkLine ?? 0) ? "bg-status-over" : "bg-status-under"
              )}
              style={{
                left: `${finalPos}%`,
                transform: "translate(-50%, -50%) rotate(45deg)",
              }}
            />
          )}
        </div>

        {/* Axis labels */}
        <div className="flex justify-between mt-1.5 text-2xs text-muted-foreground tabular-nums">
          <span>{Math.round(min)}</span>
          <span>{Math.round(max)}</span>
        </div>
      </div>

      {/* Final result display */}
      {isFinal && dkLine != null && (
        <div className={cn(
          "flex items-center justify-center gap-2 py-1.5 rounded-lg text-sm",
          finalTotal! > dkLine ? "bg-status-over/15" : "bg-status-under/15"
        )}>
          <span className="text-muted-foreground">Final:</span>
          <span className="font-bold">{finalTotal}</span>
          <span className={cn(
            "font-bold",
            finalTotal! > dkLine ? "text-status-over" : "text-status-under"
          )}>
            {finalTotal! > dkLine ? "OVER ✓" : finalTotal! < dkLine ? "UNDER ✓" : "PUSH"}
          </span>
        </div>
      )}

      {/* Sample size indicator */}
      {nH2H != null && nH2H < 10 && (
        <div className="text-center text-2xs text-muted-foreground/70">
          Based on {nH2H} historical games
        </div>
      )}
    </div>
  );
}
