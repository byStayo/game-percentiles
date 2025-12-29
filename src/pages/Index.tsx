import { useState, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { format, addDays, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Layout } from "@/components/layout/Layout";
import { DatePickerInline } from "@/components/ui/date-picker-inline";
import { GameCard } from "@/components/game/GameCardNew";
import { GameCardSkeleton } from "@/components/game/GameCardSkeleton";
import { EmptyState } from "@/components/game/EmptyState";
import { ErrorState } from "@/components/game/ErrorState";
import { EdgeExplainer } from "@/components/game/EdgeExplainer";
import { SportBadge } from "@/components/ui/sport-icon";
import { ZeroGamesDebugStrip } from "@/components/game/ZeroGamesDebugStrip";
import { CoverageDashboard } from "@/components/game/CoverageDashboard";

import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useTodayGames, useTodayDebug, TodayGame } from "@/hooks/useApi";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Zap, Database, AlertTriangle } from "lucide-react";
import type { SportId } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ET_TIMEZONE = "America/New_York";

function getTodayInET(): Date {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  return new Date(etDate.getFullYear(), etDate.getMonth(), etDate.getDate());
}

const sports: { id: SportId; name: string }[] = [
  { id: "nfl", name: "NFL" },
  { id: "nba", name: "NBA" },
];

type ViewMode = "all" | "sport";
type SortOption = "edge" | "edges-first" | "time";
type FilterMode = "picks" | "best-bets" | "all";
type ConfidenceFilter = "all" | "h2h-only";

export default function Index() {
  const [selectedDate, setSelectedDate] = useState(getTodayInET);
  const [selectedSport, setSelectedSport] = useState<SportId>("nfl");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sortBy, setSortBy] = useState<SortOption>("edges-first");
  const [filterMode, setFilterMode] = useState<FilterMode>("picks");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");

  const [hideWeakData, setHideWeakData] = useState(true);

  // Swipe gesture handlers for date navigation
  const goToPreviousDay = useCallback(() => {
    setSelectedDate((prev) => subDays(prev, 1));
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDate((prev) => addDays(prev, 1));
  }, []);

  const { onTouchStart, onTouchEnd } = useSwipeGesture({
    onSwipeLeft: goToNextDay,
    onSwipeRight: goToPreviousDay,
    threshold: 60,
  });

  // Fetch NFL + NBA data
  const nflQuery = useTodayGames(selectedDate, "nfl");
  const nbaQuery = useTodayGames(selectedDate, "nba");

  // Debug info (why 0 games)
  const debugQuery = useTodayDebug(selectedDate);

  const isLoading = nflQuery.isLoading || nbaQuery.isLoading;
  const hasError = nflQuery.error || nbaQuery.error;

  // Combine games
  const allGames = useMemo(() => {
    const games: TodayGame[] = [
      ...(nflQuery.data?.games || []),
      ...(nbaQuery.data?.games || []),
    ];
    return games;
  }, [nflQuery.data, nbaQuery.data]);

  // Get games for selected sport
  const sportGames = useMemo(() => {
    const queryMap: Record<"nfl" | "nba", typeof nflQuery> = {
      nfl: nflQuery,
      nba: nbaQuery,
    };
    return queryMap[selectedSport as "nfl" | "nba"]?.data?.games || [];
  }, [selectedSport, nflQuery, nbaQuery]);

  // Games to display based on view mode
  const displayGames = viewMode === "all" ? allGames : sportGames;

  // Filter and sort games
  const filteredAndSortedGames = useMemo(() => {
    let games = [...displayGames];

    // Filter: hide games with weak data quality (n < 5)
    if (hideWeakData) {
      games = games.filter((g) => (g.n_used ?? g.n_h2h) >= 5);
    }

    // Confidence filter: only show H2H-based predictions (hide form-based)
    if (confidenceFilter === "h2h-only") {
      games = games.filter((g) => {
        const segment = g.segment_used;
        // Form-based segments to filter out
        if (segment === "hybrid_form" || segment === "insufficient") {
          return false;
        }
        return true;
      });
    }

    // Filter based on mode
    if (filterMode === "best-bets") {
      // Best Bets: Only qualified picks with edge available on DK alternate lines
      games = games.filter((g) => {
        if ((g.n_used ?? g.n_h2h) < 5) return false;
        if (!g.dk_offered || g.dk_total_line === null) return false;
        // Must have edge AND corresponding alt line on DK
        const hasOverOnDK = g.p95_over_line != null && (g.best_over_edge ?? 0) > 0;
        const hasUnderOnDK = g.p05_under_line != null && (g.best_under_edge ?? 0) > 0;
        return hasOverOnDK || hasUnderOnDK;
      });
    } else if (filterMode === "picks") {
      // Picks: actionable edges or strong percentile signal
      games = games.filter((g) => {
        if ((g.n_used ?? g.n_h2h) < 5) return false;
        if (!g.dk_offered || g.dk_total_line === null) return false;
        const hasEdge = (g.best_over_edge ?? 0) > 0 || (g.best_under_edge ?? 0) > 0;
        const P = g.dk_line_percentile ?? 50;
        return hasEdge || P >= 70 || P <= 30;
      });
    }

    // Sort
    if (sortBy === "edges-first") {
      // Prioritize games with DK-qualified edges at the top
      games.sort((a, b) => {
        const aQualified = ((a.p95_over_line != null && (a.best_over_edge ?? 0) > 0) || 
                           (a.p05_under_line != null && (a.best_under_edge ?? 0) > 0)) ? 2 : 0;
        const bQualified = ((b.p95_over_line != null && (b.best_over_edge ?? 0) > 0) || 
                           (b.p05_under_line != null && (b.best_under_edge ?? 0) > 0)) ? 2 : 0;
        if (bQualified !== aQualified) return bQualified - aQualified;
        
        const aHasEdge = (a.best_over_edge || a.best_under_edge) ? 1 : 0;
        const bHasEdge = (b.best_over_edge || b.best_under_edge) ? 1 : 0;
        if (bHasEdge !== aHasEdge) return bHasEdge - aHasEdge;
        
        const aEdge = a.dk_line_percentile !== null ? Math.abs(50 - a.dk_line_percentile) : 0;
        const bEdge = b.dk_line_percentile !== null ? Math.abs(50 - b.dk_line_percentile) : 0;
        return bEdge - aEdge;
      });
    } else if (sortBy === "edge") {
      games.sort((a, b) => {
        const aEdge =
          a.dk_line_percentile !== null ? Math.abs(50 - a.dk_line_percentile) : 0;
        const bEdge =
          b.dk_line_percentile !== null ? Math.abs(50 - b.dk_line_percentile) : 0;
        return bEdge - aEdge;
      });
    } else if (sortBy === "time") {
      games.sort(
        (a, b) =>
          new Date(a.start_time_utc).getTime() -
          new Date(b.start_time_utc).getTime()
      );
    }

    return games;
  }, [displayGames, sortBy, filterMode, hideWeakData, confidenceFilter]);

  // Sport counts
  const sportCounts = useMemo(
    () => ({
      nfl: nflQuery.data?.games?.length || 0,
      nba: nbaQuery.data?.games?.length || 0,
    }),
    [nflQuery.data, nbaQuery.data]
  );

  const totalGames = allGames.length;
  const picksCount = filteredAndSortedGames.length;
  
  // Count games with detected edges
  const edgesCount = useMemo(() => {
    return allGames.filter((g) => g.best_over_edge || g.best_under_edge).length;
  }, [allGames]);

  // Count H2H vs form-based games
  const dataQualityCounts = useMemo(() => {
    let h2hCount = 0;
    let formCount = 0;
    allGames.forEach((g) => {
      const segment = g.segment_used;
      if (segment === "hybrid_form" || segment === "insufficient") {
        formCount++;
      } else {
        // h2h_* and recency_weighted both count as H2H-derived
        h2hCount++;
      }
    });
    return { h2h: h2hCount, form: formCount };
  }, [allGames]);

  return (
    <>
      <Helmet>
        <title>NFL & NBA Picks | H2H Totals Percentiles</title>
        <meta
          name="description"
          content="Today's NFL and NBA totals picks using head-to-head percentiles, recency weighting, and DraftKings line analysis."
        />
      </Helmet>

      <Layout>
        <div 
          className="space-y-4 animate-fade-in"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Compact header with date picker */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-lg font-bold whitespace-nowrap">Picks</h1>
              <DatePickerInline
                date={selectedDate}
                onDateChange={setSelectedDate}
              />
            </div>
            <div className="flex items-center gap-2">
              {totalGames > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {picksCount}/{totalGames}
                </span>
              )}
              <EdgeExplainer compact />
              {edgesCount > 0 && (
                <Link
                  to="/best-bets"
                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md bg-status-edge/10 text-status-edge border border-status-edge/30 hover:bg-status-edge/20 transition-colors touch-manipulation active:scale-95"
                >
                  <Zap className="h-3 w-3" />
                  {edgesCount}
                </Link>
              )}
            </div>
          </div>

          {/* Coverage Dashboard - more compact */}
          <CoverageDashboard 
            debug={debugQuery.data?.debug} 
            isFetching={debugQuery.isFetching} 
          />

          {/* Unified filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter mode - primary action */}
            <div className="flex items-center p-0.5 rounded-lg bg-muted/50">
              <button
                onClick={() => setFilterMode("best-bets")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all touch-manipulation active:scale-95",
                  filterMode === "best-bets" 
                    ? "bg-status-edge/20 text-status-edge shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Zap className="h-3 w-3" />
                Best
              </button>
              <button
                onClick={() => setFilterMode("picks")}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium rounded-md transition-all touch-manipulation active:scale-95",
                  filterMode === "picks" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                Picks
              </button>
              <button
                onClick={() => setFilterMode("all")}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium rounded-md transition-all touch-manipulation active:scale-95",
                  filterMode === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                All
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Secondary controls */}
            <div className="flex items-center gap-1.5">
              {/* Sort dropdown */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="h-7 w-auto gap-1 px-2 text-xs bg-muted/50 border-0 hover:bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg">
                  <SelectItem value="edges-first">Best First</SelectItem>
                  <SelectItem value="edge">By Edge</SelectItem>
                  <SelectItem value="time">By Time</SelectItem>
                </SelectContent>
              </Select>

              {/* View toggle */}
              <button
                onClick={() => setViewMode(viewMode === "all" ? "sport" : "all")}
                className={cn(
                  "h-7 px-2 text-xs font-medium rounded-md transition-all touch-manipulation active:scale-95",
                  viewMode === "sport" 
                    ? "bg-primary/10 text-primary" 
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                )}
              >
                {viewMode === "all" ? "All" : selectedSport.toUpperCase()}
              </button>

              {/* H2H filter */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setConfidenceFilter(confidenceFilter === "all" ? "h2h-only" : "all")}
                      className={cn(
                        "flex items-center gap-1 h-7 px-2 text-xs font-medium rounded-md transition-all touch-manipulation active:scale-95",
                        confidenceFilter === "h2h-only"
                          ? "bg-status-live/20 text-status-live"
                          : "bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Database className="h-3 w-3" />
                      {confidenceFilter === "all" && dataQualityCounts.form > 0 && (
                        <AlertTriangle className="h-2.5 w-2.5 text-yellow-500" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-popover border border-border">
                    {confidenceFilter === "h2h-only" 
                      ? "Showing H2H only" 
                      : `${dataQualityCounts.h2h} H2H, ${dataQualityCounts.form} form-based`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Min games toggle */}
              <label className="flex items-center gap-1 h-7 px-2 rounded-md bg-muted/50 cursor-pointer touch-manipulation">
                <Switch
                  id="hide-weak"
                  checked={hideWeakData}
                  onCheckedChange={setHideWeakData}
                  className="scale-[0.6]"
                />
                <span className="text-xs text-muted-foreground">5+</span>
              </label>
            </div>
          </div>

          {/* Sport selector (only in sport view) */}
          {viewMode === "sport" && (
            <div className="flex gap-1.5">
              {sports.map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSport(sport.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all touch-manipulation active:scale-95",
                    selectedSport === sport.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="uppercase">{sport.id}</span>
                  <span className="tabular-nums opacity-70">{sportCounts[sport.id]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Debug strip */}
          {!isLoading && !hasError && (
            <ZeroGamesDebugStrip
              date={format(selectedDate, "yyyy-MM-dd")}
              viewMode={viewMode}
              selectedSport={selectedSport}
              filterMode={filterMode}
              confidenceFilter={confidenceFilter}
              hideWeakData={hideWeakData}
              visibleGamesCount={filteredAndSortedGames.length}
              debug={debugQuery.data?.debug}
              isFetching={debugQuery.isFetching}
            />
          )}

          {/* Games list */}
          {isLoading ? (
            <div className="grid gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <GameCardSkeleton key={i} />
              ))}
            </div>
          ) : hasError ? (
            <ErrorState
              title="Unable to load games"
              description="There was an error loading game data. Please try again."
              onRetry={() => {
                nflQuery.refetch();
                nbaQuery.refetch();
              }}
            />
          ) : filteredAndSortedGames.length > 0 ? (
            <div className="grid gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={filterMode === "best-bets" ? "No best bets" : filterMode === "picks" ? "No picks today" : "No games today"}
              description={
                filterMode === "best-bets"
                  ? "No DK-qualified edges found. Try 'Picks' filter for more options."
                  : filterMode === "picks"
                    ? "No actionable edges found. Try 'All' filter."
                    : `No games scheduled for ${format(selectedDate, "MMM d")}.`
              }
            />
          )}
        </div>
      </Layout>
    </>
  );
}
