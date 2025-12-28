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
  className?: string;
}

type PickType = "over" | "under" | "no-edge" | "insufficient" | "unavailable";

interface PickData {
  type: PickType;
  label: string;
  sublabel?: string;
  confidence?: number;
  icon: React.ReactNode;
  colors: string;
}

// Calculate confidence based on edge strength and sample size
function calculateEdgeConfidence(
  edgePoints: number,
  nH2H: number,
  p05: number | null | undefined,
  p95: number | null | undefined
): number {
  // Base confidence from sample size (0-40 points)
  const sampleConfidence = Math.min(40, (nH2H / 20) * 40);

  // Edge strength confidence (0-40 points)
  // Stronger edges = higher confidence
  const maxEdge = 5; // Consider 5+ points as maximum edge
  const edgeConfidence = Math.min(40, (edgePoints / maxEdge) * 40);

  // Historical range confidence (0-20 points)
  // Wider historical range = more reliable percentiles
  let rangeConfidence = 0;
  if (p05 !== null && p05 !== undefined && p95 !== null && p95 !== undefined) {
    const range = p95 - p05;
    // Expect reasonable ranges based on sport (simplified)
    const expectedRange = 15; // Rough average
    rangeConfidence = Math.min(20, (range / expectedRange) * 10 + 10);
  }

  return Math.round(sampleConfidence + edgeConfidence + rangeConfidence);
}

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
  className,
}: PickPillProps) {
  const getPickData = (): PickData => {
    // Rule 1: Insufficient H2H data
    if (nH2H < 5) {
      return {
        type: "insufficient",
        label: "INSUFFICIENT H2H",
        sublabel: `n=${nH2H}`,
        icon: <AlertTriangle className="h-4 w-4" />,
        colors: "bg-muted text-muted-foreground",
      };
    }

    // Rule 2: DK line unavailable
    if (!dkOffered || dkTotalLine === null) {
      return {
        type: "unavailable",
        label: "DK LINE UNAVAILABLE",
        icon: <XCircle className="h-4 w-4" />,
        colors: "bg-muted text-muted-foreground",
      };
    }

    // Rule 3: Use edge detection data when available (most accurate)
    const hasOverEdge = bestOverEdge && bestOverEdge > 0;
    const hasUnderEdge = bestUnderEdge && bestUnderEdge > 0;

    // If we have edge data, use it to determine the pick
    if (hasOverEdge || hasUnderEdge) {
      // Pick the stronger edge
      const overStrength = bestOverEdge ?? 0;
      const underStrength = bestUnderEdge ?? 0;

      if (overStrength > underStrength && p95OverLine) {
        const confidence = calculateEdgeConfidence(overStrength, nH2H, p05, p95);
        return {
          type: "over",
          label: `TAKE OVER ${p95OverLine}`,
          sublabel: `+${overStrength.toFixed(1)}`,
          confidence,
          icon: <TrendingUp className="h-4 w-4" />,
          colors: "bg-status-over text-white",
        };
      }

      if (underStrength > overStrength && p05UnderLine) {
        const confidence = calculateEdgeConfidence(underStrength, nH2H, p05, p95);
        return {
          type: "under",
          label: `TAKE UNDER ${p05UnderLine}`,
          sublabel: `+${underStrength.toFixed(1)}`,
          confidence,
          icon: <TrendingDown className="h-4 w-4" />,
          colors: "bg-status-under text-white",
        };
      }

      // If both are equal and non-zero, pick over (arbitrary tiebreaker)
      if (overStrength > 0 && p95OverLine) {
        const confidence = calculateEdgeConfidence(overStrength, nH2H, p05, p95);
        return {
          type: "over",
          label: `TAKE OVER ${p95OverLine}`,
          sublabel: `+${overStrength.toFixed(1)}`,
          confidence,
          icon: <TrendingUp className="h-4 w-4" />,
          colors: "bg-status-over text-white",
        };
      }
    }

    // Rule 4: Fallback to percentile-based logic when no edge data
    const P = dkLinePercentile !== null ? Math.round(dkLinePercentile) : 50;

    // Low P means DK line is below most historical games → Over value
    if (P <= 30) {
      // Lower confidence for percentile-only picks
      const confidence = Math.round(30 + (30 - P) + Math.min(20, nH2H));
      return {
        type: "over",
        label: `LEAN OVER ${dkTotalLine}`,
        sublabel: `P=${P}`,
        confidence,
        icon: <TrendingUp className="h-4 w-4" />,
        colors: "bg-status-over/80 text-white",
      };
    }

    // High P means DK line is above most historical games → Under value
    if (P >= 70) {
      const confidence = Math.round(30 + (P - 70) + Math.min(20, nH2H));
      return {
        type: "under",
        label: `LEAN UNDER ${dkTotalLine}`,
        sublabel: `P=${P}`,
        confidence,
        icon: <TrendingDown className="h-4 w-4" />,
        colors: "bg-status-under/80 text-white",
      };
    }

    return {
      type: "no-edge",
      label: "NO EDGE",
      sublabel: `P=${P}`,
      icon: <Minus className="h-4 w-4" />,
      colors: "bg-secondary text-muted-foreground",
    };
  };

  const pick = getPickData();
  const hasPick = pick.type === "over" || pick.type === "under";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all",
        pick.colors,
        hasPick && !isFinal && "shadow-md",
        isFinal && "opacity-70",
        className
      )}
    >
      {pick.icon}
      <span>{pick.label}</span>
      {pick.confidence !== undefined && (
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-xs font-bold tabular-nums",
            pick.confidence >= 70 ? "bg-white/30" : "bg-white/20"
          )}
        >
          {pick.confidence}%
        </span>
      )}
      {pick.sublabel && !pick.confidence && (
        <span
          className={cn(
            "ml-1 px-1.5 py-0.5 rounded text-xs font-medium",
            hasPick ? "bg-white/20" : "bg-foreground/10"
          )}
        >
          {pick.sublabel}
        </span>
      )}
    </div>
  );
}