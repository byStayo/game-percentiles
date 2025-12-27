import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, XCircle } from "lucide-react";

interface PickPillProps {
  nH2H: number;
  dkOffered: boolean;
  dkTotalLine: number | null;
  dkLinePercentile: number | null;
  isFinal?: boolean;
  className?: string;
}

type PickType = "over" | "under" | "no-edge" | "insufficient" | "unavailable";

interface PickData {
  type: PickType;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  colors: string;
}

export function PickPill({
  nH2H,
  dkOffered,
  dkTotalLine,
  dkLinePercentile,
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

    // Rule 3: Compute P and determine pick
    const P = dkLinePercentile !== null ? Math.round(dkLinePercentile) : 50;

    if (P >= 70) {
      return {
        type: "under",
        label: `TAKE UNDER ${dkTotalLine}`,
        sublabel: `P=${P}`,
        icon: <TrendingDown className="h-4 w-4" />,
        colors: "bg-status-under text-white",
      };
    }

    if (P <= 30) {
      return {
        type: "over",
        label: `TAKE OVER ${dkTotalLine}`,
        sublabel: `P=${P}`,
        icon: <TrendingUp className="h-4 w-4" />,
        colors: "bg-status-over text-white",
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
      {pick.sublabel && (
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
