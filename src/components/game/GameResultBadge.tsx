import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

interface GameResultBadgeProps {
  finalTotal: number | null;
  dkLine: number | null;
  edgeType: "over" | "under" | "both" | "none";
  className?: string;
}

export function GameResultBadge({ finalTotal, dkLine, edgeType, className }: GameResultBadgeProps) {
  if (finalTotal === null || dkLine === null || edgeType === "none") return null;

  const isOver = finalTotal > dkLine;
  const isPush = finalTotal === dkLine;

  // Determine if the edge pick hit
  // For "both", we consider the stronger edge direction
  const edgePredictedOver = edgeType === "over" || edgeType === "both";
  const edgePredictedUnder = edgeType === "under";
  
  let result: "hit" | "miss" | "push";
  if (isPush) {
    result = "push";
  } else if (edgePredictedOver && isOver) {
    result = "hit";
  } else if (edgePredictedUnder && !isOver) {
    result = "hit";
  } else {
    result = "miss";
  }

  const Icon = result === "hit" ? CheckCircle2 : result === "miss" ? XCircle : MinusCircle;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Badge 
        variant="outline" 
        className={cn(
          "text-2xs px-1.5 py-0.5 gap-1",
          result === "hit" && "bg-status-over/10 text-status-over border-status-over/30",
          result === "miss" && "bg-status-live/10 text-status-live border-status-live/30",
          result === "push" && "bg-muted text-muted-foreground border-border"
        )}
      >
        <Icon className="h-3 w-3" />
        <span className="font-semibold tabular-nums">{finalTotal}</span>
        <span className="opacity-70">{isOver ? "OVER" : isPush ? "PUSH" : "UNDER"}</span>
      </Badge>
    </div>
  );
}
