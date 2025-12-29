import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Database, Zap, AlertTriangle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TodayGame } from "@/hooks/useApi";

interface ConfidenceSummaryBadgeProps {
  games: TodayGame[];
  className?: string;
  showTooltip?: boolean;
  compact?: boolean;
}

interface ConfidenceBreakdown {
  h2hStrong: number;     // 10+ H2H games
  h2hModerate: number;   // 5-9 H2H games
  formBased: number;     // hybrid_form or recency_weighted with <5 H2H
  insufficient: number;  // insufficient data
  total: number;
}

function getConfidenceBreakdown(games: TodayGame[]): ConfidenceBreakdown {
  const breakdown: ConfidenceBreakdown = {
    h2hStrong: 0,
    h2hModerate: 0,
    formBased: 0,
    insufficient: 0,
    total: games.length,
  };

  games.forEach((game) => {
    const segment = game.segment_used;
    const nUsed = game.n_used ?? game.n_h2h;
    
    // Check if it's form-based (hybrid_form or insufficient H2H)
    if (segment === 'hybrid_form' || segment === 'recency_weighted') {
      breakdown.formBased++;
    } else if (segment === 'insufficient' || nUsed < 3) {
      breakdown.insufficient++;
    } else if (nUsed >= 10) {
      breakdown.h2hStrong++;
    } else if (nUsed >= 5) {
      breakdown.h2hModerate++;
    } else {
      breakdown.formBased++;
    }
  });

  return breakdown;
}

export function ConfidenceSummaryBadge({
  games,
  className,
  showTooltip = true,
  compact = false,
}: ConfidenceSummaryBadgeProps) {
  const breakdown = useMemo(() => getConfidenceBreakdown(games), [games]);
  
  if (breakdown.total === 0) return null;

  const h2hTotal = breakdown.h2hStrong + breakdown.h2hModerate;
  const h2hPercentage = Math.round((h2hTotal / breakdown.total) * 100);
  const hasStrongData = h2hPercentage >= 70;
  const hasModerateData = h2hPercentage >= 40;

  const content = (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
        hasStrongData
          ? "bg-status-live/10 border-status-live/30 text-status-live"
          : hasModerateData
            ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600"
            : "bg-muted/50 border-border text-muted-foreground",
        className
      )}
    >
      <Database className={cn("h-3.5 w-3.5", compact && "h-3 w-3")} />
      {compact ? (
        <span className="text-xs font-semibold tabular-nums">
          {h2hTotal}/{breakdown.total} H2H
        </span>
      ) : (
        <span className="text-xs font-medium">
          <span className="font-bold">{h2hTotal}</span> H2H
          {breakdown.formBased > 0 && (
            <span className="text-muted-foreground"> · {breakdown.formBased} Form</span>
          )}
        </span>
      )}
    </div>
  );

  if (!showTooltip) return content;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold">Data Quality Breakdown</div>
            <div className="space-y-1 text-sm">
              {breakdown.h2hStrong > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-status-live" />
                    Strong H2H (10+ games)
                  </span>
                  <span className="font-medium text-status-live">{breakdown.h2hStrong}</span>
                </div>
              )}
              {breakdown.h2hModerate > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3 w-3 text-status-under" />
                    Moderate H2H (5-9 games)
                  </span>
                  <span className="font-medium text-status-under">{breakdown.h2hModerate}</span>
                </div>
              )}
              {breakdown.formBased > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    Form-based (recent games)
                  </span>
                  <span className="font-medium text-yellow-500">{breakdown.formBased}</span>
                </div>
              )}
              {breakdown.insufficient > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    Insufficient data
                  </span>
                  <span className="font-medium text-muted-foreground">{breakdown.insufficient}</span>
                </div>
              )}
            </div>
            <div className="pt-1 border-t border-border/50 text-xs text-muted-foreground">
              H2H data is based on historical matchup games between these specific teams.
              Form-based uses recent games vs any opponent.
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Export the breakdown type for use elsewhere
export type { ConfidenceBreakdown };
export { getConfidenceBreakdown };
