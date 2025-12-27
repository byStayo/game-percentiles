import { cn } from "@/lib/utils";
import { getRecencyFactor } from "@/lib/confidenceScore";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Timer } from "lucide-react";

interface RecencyIndicatorProps {
  segment?: string | null;
  homeContinuity?: number | null;
  awayContinuity?: number | null;
  showTooltip?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function RecencyIndicator({
  segment,
  homeContinuity,
  awayContinuity,
  showTooltip = true,
  size = "sm",
  className,
}: RecencyIndicatorProps) {
  const recency = getRecencyFactor({ segment, homeContinuity, awayContinuity });

  const indicator = (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium",
        size === "sm" 
          ? "px-1.5 py-0.5 text-2xs" 
          : "px-2 py-1 text-xs",
        "bg-secondary/50 border border-border/40",
        className
      )}
    >
      <Timer className={cn(
        recency.color,
        size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
      )} />
      <span className={recency.color}>{recency.label}</span>
    </div>
  );

  if (!showTooltip) {
    return indicator;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{indicator}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-medium">Data Applicability: {recency.score}%</div>
          <p className="text-2xs text-muted-foreground">
            {recency.score >= 75
              ? "Historical data is highly applicable to current matchup"
              : recency.score >= 50
              ? "Historical data is moderately applicable"
              : "Historical data may have limited applicability due to roster changes or age"}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
