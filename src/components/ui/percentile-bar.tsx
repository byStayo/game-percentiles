import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface PercentileBarProps {
  p05: number;
  p95: number;
  dkLine?: number | null;
  dkPercentile?: number | null;
  finalTotal?: number | null;
  className?: string;
  showRecommendation?: boolean;
}

export function PercentileBar({ p05, p95, dkLine, dkPercentile, finalTotal, className, showRecommendation = true }: PercentileBarProps) {
  const range = p95 - p05;
  const padding = range * 0.15;
  const min = Math.max(0, p05 - padding);
  const max = p95 + padding;
  const totalRange = max - min;

  const p05Position = ((p05 - min) / totalRange) * 100;
  const p95Position = ((p95 - min) / totalRange) * 100;
  const dkPosition = dkLine ? Math.min(Math.max(((dkLine - min) / totalRange) * 100, 4), 96) : null;
  const finalPosition = finalTotal ? Math.min(Math.max(((finalTotal - min) / totalRange) * 100, 2), 98) : null;

  // Determine recommendation based on percentile
  const getRecommendation = () => {
    if (dkPercentile == null) return null;
    if (dkPercentile >= 70) return { type: 'under' as const, strength: dkPercentile >= 85 ? 'strong' : 'moderate' };
    if (dkPercentile <= 30) return { type: 'over' as const, strength: dkPercentile <= 15 ? 'strong' : 'moderate' };
    return null;
  };

  const recommendation = getRecommendation();

  const getIndicatorStyle = (percentile: number | null | undefined) => {
    if (percentile == null) return { bg: "bg-muted-foreground", ring: "ring-muted-foreground/20" };
    if (percentile <= 30) return { bg: "bg-status-over", ring: "ring-status-over/20" };
    if (percentile >= 70) return { bg: "bg-status-under", ring: "ring-status-under/20" };
    return { bg: "bg-status-edge", ring: "ring-status-edge/20" };
  };

  const indicatorStyle = getIndicatorStyle(dkPercentile);

  // Determine if final went over or under the DK line
  const finalWentOver = finalTotal && dkLine && finalTotal > dkLine;
  const finalWentUnder = finalTotal && dkLine && finalTotal < dkLine;

  return (
    <div className={cn("", className)}>
      {/* Recommendation Badge - Only show when there's a signal and no final result */}
      {showRecommendation && recommendation && !finalTotal && (
        <div className="flex justify-center mb-3">
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm",
            recommendation.type === 'under' 
              ? "bg-status-under text-white" 
              : "bg-status-over text-white",
            recommendation.strength === 'strong' && "ring-2 ring-offset-2 ring-offset-background",
            recommendation.strength === 'strong' && recommendation.type === 'under' && "ring-status-under/50",
            recommendation.strength === 'strong' && recommendation.type === 'over' && "ring-status-over/50"
          )}>
            {recommendation.type === 'under' ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            <span>TAKE THE {recommendation.type.toUpperCase()}</span>
            {recommendation.strength === 'strong' && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-xs">STRONG</span>
            )}
          </div>
        </div>
      )}

      {/* P05 / P95 Range with clear labels */}
      <div className="flex justify-between items-end mb-2">
        <div className="text-center">
          <div className="text-2xs text-muted-foreground uppercase tracking-wide mb-0.5">5th %ile</div>
          <div className="text-sm font-bold tabular-nums text-status-under">{p05.toFixed(1)}</div>
        </div>
        
        {dkLine != null && (
          <div className="text-center">
            <div className="text-2xs text-muted-foreground uppercase tracking-wide mb-0.5">Line</div>
            <div className="text-sm font-bold tabular-nums">{dkLine.toFixed(1)}</div>
          </div>
        )}
        
        <div className="text-center">
          <div className="text-2xs text-muted-foreground uppercase tracking-wide mb-0.5">95th %ile</div>
          <div className="text-sm font-bold tabular-nums text-status-over">{p95.toFixed(1)}</div>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
        {/* Range fill */}
        <div
          className="absolute h-full bg-gradient-to-r from-status-under/40 via-muted-foreground/20 to-status-over/40 rounded-full"
          style={{
            left: `${p05Position}%`,
            width: `${p95Position - p05Position}%`,
          }}
        />

        {/* Final total marker (diamond shape) */}
        {finalPosition !== null && (
          <div
            className={cn(
              "absolute top-1/2 w-3.5 h-3.5 rotate-45 shadow-md border-2 border-background",
              finalWentOver ? "bg-status-over" : finalWentUnder ? "bg-status-under" : "bg-foreground"
            )}
            style={{ 
              left: `${finalPosition}%`, 
              transform: 'translate(-50%, -50%) rotate(45deg)' 
            }}
          />
        )}

        {/* DK Line marker (circle) */}
        {dkPosition !== null && (
          <div
            className={cn(
              "absolute top-1/2 w-4 h-4 rounded-full shadow-md ring-2 ring-background",
              indicatorStyle.bg,
              finalTotal && "opacity-60"
            )}
            style={{ 
              left: `${dkPosition}%`, 
              transform: 'translate(-50%, -50%)' 
            }}
          />
        )}
      </div>

      {/* Final result display */}
      {finalTotal && dkLine && (
        <div className="flex justify-center mt-2">
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
            finalWentOver ? "bg-status-over/15 text-status-over" : 
            finalWentUnder ? "bg-status-under/15 text-status-under" : 
            "bg-muted text-muted-foreground"
          )}>
            {finalWentOver ? <TrendingUp className="h-3 w-3" /> : finalWentUnder ? <TrendingDown className="h-3 w-3" /> : null}
            Final: {finalTotal.toFixed(1)} ({finalWentOver ? 'OVER' : finalWentUnder ? 'UNDER' : 'PUSH'})
          </div>
        </div>
      )}

      {/* Percentile indicator when no recommendation */}
      {dkPercentile != null && !recommendation && !finalTotal && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
            "bg-status-edge/10 text-status-edge"
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full", indicatorStyle.bg)} />
            P{Math.round(dkPercentile)} — No clear edge
          </span>
        </div>
      )}
    </div>
  );
}