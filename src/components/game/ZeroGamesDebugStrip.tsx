import { cn } from "@/lib/utils";
import type { SportId } from "@/types";
import type { TodayDebugInfo, TodayDebugEdge } from "@/hooks/useApi";
import { AlertTriangle, Database, Info } from "lucide-react";

type ViewMode = "all" | "sport";
type FilterMode = "picks" | "best-bets" | "all";
type ConfidenceFilter = "all" | "h2h-only";

function scopedEdges(
  edges: TodayDebugEdge[],
  viewMode: ViewMode,
  selectedSport: SportId
): TodayDebugEdge[] {
  if (viewMode === "sport") return edges.filter((e) => e.sport_id === selectedSport);
  return edges.filter((e) => e.sport_id === "nfl" || e.sport_id === "nba");
}

function applyUiFilters(
  edges: TodayDebugEdge[],
  opts: {
    filterMode: FilterMode;
    confidenceFilter: ConfidenceFilter;
    hideWeakData: boolean;
  }
) {
  let g = [...edges];

  if (opts.hideWeakData) {
    g = g.filter((e) => (e.n_used ?? e.n_h2h) >= 5);
  }

  if (opts.confidenceFilter === "h2h-only") {
    g = g.filter((e) => e.segment_used !== "hybrid_form" && e.segment_used !== "insufficient");
  }

  if (opts.filterMode === "best-bets") {
    g = g.filter((e) => {
      if ((e.n_used ?? e.n_h2h) < 5) return false;
      if (!e.dk_offered || e.dk_total_line === null) return false;
      const hasOverOnDK = e.p95_over_line != null && (e.best_over_edge ?? 0) > 0;
      const hasUnderOnDK = e.p05_under_line != null && (e.best_under_edge ?? 0) > 0;
      return hasOverOnDK || hasUnderOnDK;
    });
  } else if (opts.filterMode === "picks") {
    g = g.filter((e) => {
      if ((e.n_used ?? e.n_h2h) < 5) return false;
      if (!e.dk_offered || e.dk_total_line === null) return false;
      const hasEdge = (e.best_over_edge ?? 0) > 0 || (e.best_under_edge ?? 0) > 0;
      const P = e.dk_line_percentile ?? 50;
      return hasEdge || P >= 70 || P <= 30;
    });
  }

  return g;
}

export function ZeroGamesDebugStrip(props: {
  date: string;
  viewMode: ViewMode;
  selectedSport: SportId;
  filterMode: FilterMode;
  confidenceFilter: ConfidenceFilter;
  hideWeakData: boolean;
  visibleGamesCount: number;
  debug?: TodayDebugInfo;
  isFetching?: boolean;
}) {
  const { debug } = props;

  // Only show when user is seeing 0 games
  if (props.visibleGamesCount > 0) return null;

  const edgesAll = debug?.edges || [];
  const edgesForScope = scopedEdges(edgesAll, props.viewMode, props.selectedSport);
  const edgesVisible = edgesForScope.filter((e) => e.is_visible);
  const edgesAfterFilters = applyUiFilters(edgesVisible, {
    filterMode: props.filterMode,
    confidenceFilter: props.confidenceFilter,
    hideWeakData: props.hideWeakData,
  });

  const totals = debug?.totals;

  // If debug isn't available yet, still render a placeholder strip.
  if (!debug || !totals) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/50 bg-card px-3 py-2 text-xs",
          "flex items-start gap-2"
        )}
      >
        <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="font-medium">Why 0 games?</div>
          <div className="text-muted-foreground">
            {props.isFetching ? "Loading debug info…" : "Debug info unavailable."}
          </div>
        </div>
      </div>
    );
  }

  const sportLabel = props.viewMode === "sport" ? props.selectedSport.toUpperCase() : "NFL+NBA";

  const ingestedGames = (props.viewMode === "sport"
    ? debug.by_sport?.[props.selectedSport]?.games_in_db
    : (debug.by_sport?.nfl?.games_in_db || 0) + (debug.by_sport?.nba?.games_in_db || 0)) ?? 0;

  const computedEdges = edgesForScope.length;
  const visibleEdges = edgesVisible.length;

  let headline = `0 games because:`;
  let detail = "";

  if (ingestedGames === 0) {
    detail = `${sportLabel} has 0 ingested games for ${props.date} (ET).`;
  } else if (computedEdges === 0) {
    detail = `${sportLabel} has ${ingestedGames} ingested games but 0 computed percentiles/edges for ${props.date}.`;
  } else if (visibleEdges === 0) {
    detail = `${sportLabel} has ${computedEdges} computed edges but 0 are marked visible.`;
  } else if (edgesAfterFilters.length === 0) {
    const withOdds = edgesVisible.filter((e) => e.dk_offered && e.dk_total_line !== null).length;
    const withN5 = edgesVisible.filter((e) => (e.n_used ?? e.n_h2h) >= 5).length;
    detail = `Filters hide all visible games: ${props.filterMode} + ${props.hideWeakData ? "5+" : "any N"} + ${props.confidenceFilter}. (visible=${visibleEdges}, withOdds=${withOdds}, n>=5=${withN5})`;
  } else {
    // Shouldn't happen (we're here only when UI shows 0), but keeps it safe.
    detail = `Debug says ${edgesAfterFilters.length} should pass filters; refresh the page.`;
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card px-3 py-2 text-xs",
        "flex items-start gap-2"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 items-center justify-center rounded-md",
          "bg-muted/60 text-muted-foreground"
        )}
      >
        {ingestedGames === 0 || computedEdges === 0 ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Database className="h-4 w-4" />
        )}
      </div>

      <div className="flex-1">
        <div className="font-medium">{headline}</div>
        <div className="text-muted-foreground">{detail}</div>
        <div className="mt-1 text-muted-foreground tabular-nums">
          scope={sportLabel} · dbGames={ingestedGames} · edges(all)={computedEdges} · edges(visible)={visibleEdges}
        </div>
      </div>
    </div>
  );
}
