import { cn } from "@/lib/utils";
import { calculateConfidence, type ConfidenceResult } from "@/lib/confidenceScore";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Shield, TrendingUp, Users, BarChart3 } from "lucide-react";

interface ConfidenceBadgeProps {
  nGames: number;
  segment?: string | null;
  homeContinuity?: number | null;
  awayContinuity?: number | null;
  showDetails?: boolean;
  className?: string;
}

export function ConfidenceBadge({
  nGames,
  segment,
  homeContinuity,
  awayContinuity,
  showDetails = true,
  className,
}: ConfidenceBadgeProps) {
  const confidence = calculateConfidence({
    nGames,
    segment,
    homeContinuity,
    awayContinuity,
  });

  const badge = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-2xs font-medium",
        "bg-secondary/50 border border-border/40",
        className
      )}
    >
      <Shield className={cn("h-3 w-3", confidence.color)} />
      <span className={confidence.color}>{confidence.score}</span>
    </div>
  );

  if (!showDetails) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="w-56 p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Data Confidence</span>
            <span className={cn("text-sm font-bold", confidence.color)}>
              {confidence.score}% — {confidence.label}
            </span>
          </div>
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <FactorRow
              icon={BarChart3}
              label="Sample Size"
              value={confidence.factors.sampleSize}
            />
            <FactorRow
              icon={TrendingUp}
              label="Recency"
              value={confidence.factors.recencyScore}
            />
            <FactorRow
              icon={Users}
              label="Roster Continuity"
              value={confidence.factors.rosterContinuity}
            />
          </div>
          <p className="text-2xs text-muted-foreground pt-1">
            Higher scores indicate more reliable predictions
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function FactorRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Shield;
  label: string;
  value: number;
}) {
  let color = "text-muted-foreground";
  if (value >= 70) color = "text-status-live";
  else if (value >= 45) color = "text-yellow-500";
  else if (value < 30) color = "text-status-over";

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <span className={cn("font-medium tabular-nums", color)}>{value}%</span>
    </div>
  );
}
