import { Database, TrendingUp, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodayDebugInfo } from "@/hooks/useApi";

interface CoverageDashboardProps {
  debug: TodayDebugInfo | undefined;
  isFetching: boolean;
}

export function CoverageDashboard({ debug, isFetching }: CoverageDashboardProps) {
  if (isFetching) {
    return (
      <div className="p-3 rounded-lg bg-muted/30 border border-border/50 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-2" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!debug) return null;

  const { by_sport } = debug;
  const nfl = by_sport?.nfl;
  const nba = by_sport?.nba;

  const SportCard = ({ sport, data }: { sport: string; data: typeof nfl }) => {
    if (!data) {
      return (
        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs font-bold uppercase text-muted-foreground">{sport}</span>
          </div>
          <p className="text-xs text-muted-foreground">No data</p>
        </div>
      );
    }

    const { games_in_db, edges_total, edges_visible, with_dk_odds, with_n5, segments } = data;
    
    // Coverage health score
    const hasGames = games_in_db > 0;
    const hasEdges = edges_total > 0;
    const hasVisible = edges_visible > 0;
    const coverage = hasGames ? Math.round((edges_visible / games_in_db) * 100) : 0;
    
    // Segment breakdown
    const h2hCount = (segments?.h2h_all || 0) + (segments?.h2h_10y || 0) + (segments?.h2h_5y || 0) + (segments?.recency_weighted || 0);
    const formCount = segments?.hybrid_form || 0;

    const isHealthy = hasVisible && coverage >= 50;
    const isPartial = hasEdges && !hasVisible;
    const isMissing = hasGames && !hasEdges;

    return (
      <div className={cn(
        "p-2.5 rounded-lg border",
        isHealthy ? "bg-status-live/5 border-status-live/20" :
        isPartial ? "bg-yellow-500/5 border-yellow-500/20" :
        isMissing ? "bg-destructive/5 border-destructive/20" :
        "bg-muted/20 border-border/30"
      )}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase">{sport}</span>
            {isHealthy && <CheckCircle2 className="h-3 w-3 text-status-live" />}
            {isPartial && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
            {isMissing && <AlertTriangle className="h-3 w-3 text-destructive" />}
          </div>
          <span className={cn(
            "text-xs font-semibold tabular-nums",
            isHealthy ? "text-status-live" : 
            isPartial ? "text-yellow-600" : 
            "text-muted-foreground"
          )}>
            {coverage}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="p-1 rounded bg-background/50">
            <div className="text-sm font-bold tabular-nums">{games_in_db}</div>
            <div className="text-2xs text-muted-foreground">Games</div>
          </div>
          <div className="p-1 rounded bg-background/50">
            <div className="text-sm font-bold tabular-nums">{edges_visible}</div>
            <div className="text-2xs text-muted-foreground">Ready</div>
          </div>
          <div className="p-1 rounded bg-background/50">
            <div className="text-sm font-bold tabular-nums">{with_dk_odds}</div>
            <div className="text-2xs text-muted-foreground">w/ Odds</div>
          </div>
        </div>

        {/* Segment breakdown if there are edges */}
        {edges_total > 0 && (
          <div className="mt-1.5 flex items-center gap-2 text-2xs">
            <span className="flex items-center gap-0.5 text-status-live">
              <Database className="h-2.5 w-2.5" />
              {h2hCount} H2H
            </span>
            {formCount > 0 && (
              <span className="flex items-center gap-0.5 text-yellow-600">
                <TrendingUp className="h-2.5 w-2.5" />
                {formCount} Form
              </span>
            )}
          </div>
        )}

        {/* Issue hints */}
        {isMissing && (
          <p className="mt-1.5 text-2xs text-destructive">
            Games ingested but not computed
          </p>
        )}
        {isPartial && (
          <p className="mt-1.5 text-2xs text-yellow-600">
            {edges_total - edges_visible} edges hidden (filters/odds)
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="p-3 rounded-lg bg-card/50 border border-border/50">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">Data Coverage</span>
        <span className="text-2xs text-muted-foreground ml-auto">{debug.date}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SportCard sport="NFL" data={nfl} />
        <SportCard sport="NBA" data={nba} />
      </div>
    </div>
  );
}
