import { cn } from "@/lib/utils";
import { Clock, TrendingUp, History } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SegmentBadgeProps {
  segment?: string | null;
  nUsed?: number | null;
  className?: string;
  showTooltip?: boolean;
}

const SEGMENT_LABELS: Record<string, { label: string; description: string; icon: typeof Clock }> = {
  h2h_1y: { label: "Last year", description: "Based on games from the last year", icon: Clock },
  h2h_3y: { label: "Last 3 years", description: "Based on games from the last 3 years", icon: Clock },
  h2h_5y: { label: "Last 5 years", description: "Based on games from the last 5 years", icon: Clock },
  h2h_10y: { label: "Last 10 years", description: "Based on games from the last 10 years", icon: Clock },
  h2h_20y: { label: "Last 20 years", description: "Based on games from the last 20 years", icon: History },
  h2h_all: { label: "All-time", description: "Based on all historical games between these teams", icon: History },
  recency_weighted: { label: "Recency weighted", description: "Recent games weighted higher (1yr=100%, 2yr=90%, 3yr=70%, 4yr=50%)", icon: TrendingUp },
  hybrid_form: { label: "Team form", description: "Based on each team's recent game totals (no direct H2H)", icon: TrendingUp },
  insufficient: { label: "Insufficient data", description: "Not enough historical data available", icon: Clock },
};

export function SegmentBadge({ segment, nUsed, className, showTooltip = true }: SegmentBadgeProps) {
  if (!segment) return null;

  const config = SEGMENT_LABELS[segment] || { 
    label: segment, 
    description: `Based on ${segment} segment`,
    icon: Clock 
  };

  const Icon = config.icon;

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-medium",
        segment === "insufficient" 
          ? "bg-destructive/10 text-destructive"
          : segment === "recency_weighted"
          ? "bg-status-live/10 text-status-live"
          : segment === "hybrid_form"
          ? "bg-status-over/10 text-status-over"
          : "bg-muted text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
      {nUsed !== null && nUsed !== undefined && (
        <span className="text-2xs opacity-70">({nUsed})</span>
      )}
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{config.description}</p>
          {nUsed && <p className="text-xs text-muted-foreground mt-1">{nUsed} games in sample</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function getSegmentLabel(segment?: string | null): string {
  if (!segment) return "";
  return SEGMENT_LABELS[segment]?.label || segment;
}
