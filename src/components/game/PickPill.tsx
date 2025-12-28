import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, XCircle } from "lucide-react";

interface PickPillProps {
  nH2H: number;
  dkOffered: boolean;
  dkTotalLine: number | null;
  dkLinePercentile: number | null;
  bestOverEdge?: number | null;
  bestUnderEdge?: number | null;
  p95OverLine?: number | null;
  p05UnderLine?: number | null;
  p05?: number | null;
  p95?: number | null;
  isFinal?: boolean;
  compact?: boolean;
  className?: string;
}

type PickType = "over" | "under" | "no-edge" | "insufficient" | "unavailable";

interface PickData {
  type: PickType;
  label: string;
  line?: number | null;
  edgePoints?: number;
  icon: React.ReactNode;
  colors: string;
}

/**
 * RECOMMENDATION LOGIC:
 * 
 * 1. If nH2H < 5: "LOW DATA" - not enough historical games
 * 2. If DK line not offered: "NO LINE" - can't compare
 * 3. If we have edge data (bestOverEdge or bestUnderEdge > 0):
 *    - Pick the direction with the stronger edge
 *    - OVER = DK line is LOWER than historical p5 → games usually score MORE
 *    - UNDER = DK line is HIGHER than historical p95 → games usually score LESS
 * 4. Fallback to percentile if no edge data:
 *    - P ≤ 30: DK line below 30% of historical games → LEAN OVER
 *    - P ≥ 70: DK line above 70% of historical games → LEAN UNDER
 * 5. Otherwise: "NO EDGE"
 */

export function PickPill({
  nH2H,
  dkOffered,
  dkTotalLine,
  dkLinePercentile,
  bestOverEdge,
  bestUnderEdge,
  p95OverLine,
  p05UnderLine,
  p05,
  p95,
  isFinal = false,
  compact = false,
  className,
}: PickPillProps) {
  const getPickData = (): PickData => {
    // Rule 1: Insufficient data
    if (nH2H < 5) {
      return {
        type: "insufficient",
        label: "LOW DATA",
        icon: <AlertTriangle className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />,
        colors: "bg-muted text-muted-foreground",
      };
    }

    // Rule 2: No DK line available
    if (!dkOffered || dkTotalLine === null) {
      return {
        type: "unavailable",
        label: "NO LINE",
        icon: <XCircle className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />,
        colors: "bg-muted text-muted-foreground",
      };
    }

    // Rule 3: Use edge data when available (computed by backend)
    const overEdge = bestOverEdge ?? 0;
    const underEdge = bestUnderEdge ?? 0;

    if (overEdge > 0 || underEdge > 0) {
      if (overEdge > underEdge) {
        // OVER recommendation: DK line is below the historical p5
        // We bet the line won't go under (game will score more)
        return {
          type: "over",
          label: "OVER",
          line: dkTotalLine, // Bet the actual DK line
          edgePoints: overEdge,
          icon: <TrendingUp className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />,
          colors: "bg-status-over text-white",
        };
      } else {
        // UNDER recommendation: DK line is above the historical p95
        // We bet the line won't go over (game will score less)
        return {
          type: "under",
          label: "UNDER",
          line: dkTotalLine, // Bet the actual DK line
          edgePoints: underEdge,
          icon: <TrendingDown className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />,
          colors: "bg-status-under text-white",
        };
      }
    }

    // Rule 4: Fallback to percentile-based recommendation
    const P = dkLinePercentile !== null ? Math.round(dkLinePercentile) : 50;

    if (P <= 30) {
      // DK line is low relative to history → LEAN OVER
      return {
        type: "over",
        label: "LEAN OVER",
        line: dkTotalLine,
        icon: <TrendingUp className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />,
        colors: "bg-status-over/80 text-white",
      };
    }

    if (P >= 70) {
      // DK line is high relative to history → LEAN UNDER
      return {
        type: "under",
        label: "LEAN UNDER",
        line: dkTotalLine,
        icon: <TrendingDown className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />,
        colors: "bg-status-under/80 text-white",
      };
    }

    // Rule 5: No edge detected
    return {
      type: "no-edge",
      label: "NO EDGE",
      icon: <Minus className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />,
      colors: "bg-secondary text-muted-foreground",
    };
  };

  const pick = getPickData();
  const hasPick = pick.type === "over" || pick.type === "under";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all",
        compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
        pick.colors,
        hasPick && !isFinal && "shadow-md",
        isFinal && "opacity-70",
        className
      )}
    >
      {pick.icon}
      <span className="whitespace-nowrap">
        {pick.label}
        {pick.line !== undefined && pick.line !== null && (
          <span className="ml-1 font-bold">{pick.line}</span>
        )}
      </span>
      {pick.edgePoints !== undefined && pick.edgePoints > 0 && (
        <span
          className={cn(
            "px-1.5 py-0.5 rounded font-bold tabular-nums bg-white/25",
            compact ? "text-2xs" : "text-xs"
          )}
        >
          +{pick.edgePoints.toFixed(1)}
        </span>
      )}
    </div>
  );
}
