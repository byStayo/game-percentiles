import { cn } from "@/lib/utils";
import { Database, Activity, TrendingUp, AlertCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DataSourceIndicatorProps {
  segmentUsed?: string | null;
  nGames?: number;
  className?: string;
  showLabel?: boolean;
  size?: "xs" | "sm" | "md";
}

type DataSourceType = "h2h_recent" | "h2h_historical" | "hybrid_form" | "recency_weighted" | "insufficient";

interface DataSourceInfo {
  type: DataSourceType;
  label: string;
  shortLabel: string;
  description: string;
  details: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  reliability: number; // 1-5 scale
}

function getDataSourceInfo(segment?: string | null, nGames?: number): DataSourceInfo {
  // Hybrid form - uses each team's recent games (not H2H)
  if (segment === "hybrid_form") {
    return {
      type: "hybrid_form",
      label: "Form-Based",
      shortLabel: "Form",
      description: "Using each team's recent game totals",
      details: "When no head-to-head history exists, we analyze each team's recent scoring patterns from games against any opponent. This is less precise than H2H data but provides useful context based on current team form.",
      color: "text-status-over",
      bgColor: "bg-status-over/10",
      icon: <Activity className="h-3 w-3" />,
      reliability: 2,
    };
  }

  // Recency weighted H2H
  if (segment === "recency_weighted") {
    return {
      type: "recency_weighted",
      label: "Recent H2H",
      shortLabel: "Recent",
      description: "Weighted by how recently games were played",
      details: `Based on ${nGames ?? 0} head-to-head matchups with more weight given to recent games. Recent data is more predictive because team rosters and styles change over time.`,
      color: "text-status-live",
      bgColor: "bg-status-live/10",
      icon: <TrendingUp className="h-3 w-3" />,
      reliability: 5,
    };
  }

  // H2H segments with year ranges
  if (segment?.startsWith("h2h_")) {
    const yearRange = segment.replace("h2h_", "");
    const years = yearRange === "all" ? "all-time" : `last ${yearRange.replace("y", " year")}${yearRange !== "1y" ? "s" : ""}`;
    
    let reliability = 4;
    if (yearRange === "1y" || yearRange === "3y") reliability = 5;
    else if (yearRange === "5y") reliability = 4;
    else if (yearRange === "10y") reliability = 3;
    else reliability = 2;

    return {
      type: yearRange === "1y" || yearRange === "3y" ? "h2h_recent" : "h2h_historical",
      label: `H2H (${years})`,
      shortLabel: `${nGames ?? 0} H2H`,
      description: `Direct head-to-head history from ${years}`,
      details: `Based on ${nGames ?? 0} actual matchups between these teams from the ${years}. Head-to-head data is the gold standard for predicting game totals as it captures the specific dynamics of this matchup.`,
      color: reliability >= 4 ? "text-status-live" : "text-foreground",
      bgColor: reliability >= 4 ? "bg-status-live/10" : "bg-muted",
      icon: <Database className="h-3 w-3" />,
      reliability,
    };
  }

  // Insufficient data
  return {
    type: "insufficient",
    label: "Insufficient Data",
    shortLabel: "Low",
    description: "Not enough historical data",
    details: "We couldn't find enough historical data to make reliable predictions for this matchup. Consider using additional research for betting decisions.",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    icon: <AlertCircle className="h-3 w-3" />,
    reliability: 0,
  };
}

export function DataSourceIndicator({
  segmentUsed,
  nGames,
  className,
  showLabel = false,
  size = "sm",
}: DataSourceIndicatorProps) {
  const info = getDataSourceInfo(segmentUsed, nGames);

  const sizeClasses = {
    xs: "h-4 px-1 text-2xs gap-0.5",
    sm: "h-5 px-1.5 text-2xs gap-1",
    md: "h-6 px-2 text-xs gap-1.5",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center rounded-md font-medium cursor-help",
              info.bgColor,
              info.color,
              sizeClasses[size],
              className
            )}
          >
            {info.icon}
            {showLabel ? (
              <span>{info.label}</span>
            ) : (
              <span>{info.shortLabel}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-[280px] p-0 overflow-hidden"
          sideOffset={8}
        >
          <div className="space-y-0">
            {/* Header */}
            <div className={cn("flex items-center gap-2 px-3 py-2", info.bgColor)}>
              <div className={cn("p-1 rounded", info.bgColor, info.color)}>
                {info.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("font-semibold text-sm", info.color)}>{info.label}</p>
                <p className="text-xs text-muted-foreground">{info.description}</p>
              </div>
            </div>
            
            {/* Details */}
            <div className="px-3 py-2 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {info.details}
              </p>
              
              {/* Reliability meter */}
              <div className="flex items-center gap-2">
                <span className="text-2xs text-muted-foreground font-medium">Reliability:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        "w-3 h-1.5 rounded-full",
                        level <= info.reliability
                          ? info.reliability >= 4
                            ? "bg-status-live"
                            : info.reliability >= 2
                              ? "bg-status-over"
                              : "bg-destructive"
                          : "bg-muted"
                      )}
                    />
                  ))}
                </div>
                <span className="text-2xs text-muted-foreground">
                  {info.reliability >= 4 ? "High" : info.reliability >= 2 ? "Medium" : "Low"}
                </span>
              </div>
            </div>

            {/* Pro tip for form-based */}
            {info.type === "hybrid_form" && (
              <div className="flex items-start gap-2 px-3 py-2 bg-muted/50 border-t border-border">
                <Info className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-2xs text-muted-foreground">
                  <span className="font-medium">Pro tip:</span> Form-based predictions work best for teams on clear scoring streaks.
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Utility to get simple color class for inline use
export function getDataSourceColor(segment?: string | null): string {
  if (segment === "hybrid_form") return "text-status-over";
  if (segment === "recency_weighted") return "text-status-live";
  if (segment?.startsWith("h2h_1y") || segment?.startsWith("h2h_3y")) return "text-status-live";
  if (segment?.startsWith("h2h_")) return "text-foreground";
  return "text-muted-foreground";
}
