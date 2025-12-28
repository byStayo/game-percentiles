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

import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useTodayGames, TodayGame } from "@/hooks/useApi";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import type { SportId } from "@/types";

const ET_TIMEZONE = "America/New_York";

function getTodayInET(): Date {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  return new Date(etDate.getFullYear(), etDate.getMonth(), etDate.getDate());
}

const sports: { id: SportId; name: string }[] = [
  { id: "nfl", name: "NFL" },
  { id: "nba", name: "NBA" },
  { id: "nhl", name: "NHL" },
  { id: "mlb", name: "MLB" },
];

type ViewMode = "all" | "sport";
type SortOption = "edge" | "edges-first" | "time";
type FilterMode = "picks" | "best-bets" | "all";

export default function Index() {
  const [selectedDate, setSelectedDate] = useState(getTodayInET);
  const [selectedSport, setSelectedSport] = useState<SportId>("nba");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sortBy, setSortBy] = useState<SortOption>("edges-first");
  const [filterMode, setFilterMode] = useState<FilterMode>("picks");
  
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

  // Fetch all sports data
  const nflQuery = useTodayGames(selectedDate, "nfl");
  const nbaQuery = useTodayGames(selectedDate, "nba");
  const nhlQuery = useTodayGames(selectedDate, "nhl");
  const mlbQuery = useTodayGames(selectedDate, "mlb");

  const isLoading =
    nflQuery.isLoading ||
    nbaQuery.isLoading ||
    nhlQuery.isLoading ||
    mlbQuery.isLoading;
  const hasError =
    nflQuery.error || nbaQuery.error || nhlQuery.error || mlbQuery.error;

  // Combine all games
  const allGames = useMemo(() => {
    const games: TodayGame[] = [
      ...(nflQuery.data?.games || []),
      ...(nbaQuery.data?.games || []),
      ...(nhlQuery.data?.games || []),
      ...(mlbQuery.data?.games || []),
    ];
    return games;
  }, [nflQuery.data, nbaQuery.data, nhlQuery.data, mlbQuery.data]);

  // Get games for selected sport
  const sportGames = useMemo(() => {
    const queryMap: Record<SportId, typeof nflQuery> = {
      nfl: nflQuery,
      nba: nbaQuery,
      nhl: nhlQuery,
      mlb: mlbQuery,
    };
    return queryMap[selectedSport].data?.games || [];
  }, [selectedSport, nflQuery, nbaQuery, nhlQuery, mlbQuery]);

  // Games to display based on view mode
  const displayGames = viewMode === "all" ? allGames : sportGames;

  // Filter and sort games
  const filteredAndSortedGames = useMemo(() => {
    let games = [...displayGames];

    // Filter: hide games with weak data quality (n < 5)
    if (hideWeakData) {
      games = games.filter((g) => (g.n_used ?? g.n_h2h) >= 5);
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
  }, [displayGames, sortBy, filterMode, hideWeakData]);

  // Sport counts
  const sportCounts = useMemo(
    () => ({
      nfl: nflQuery.data?.games?.length || 0,
      nba: nbaQuery.data?.games?.length || 0,
      nhl: nhlQuery.data?.games?.length || 0,
      mlb: mlbQuery.data?.games?.length || 0,
    }),
    [nflQuery.data, nbaQuery.data, nhlQuery.data, mlbQuery.data]
  );

  const totalGames = allGames.length;
  const picksCount = filteredAndSortedGames.length;
  
  // Count games with detected edges
  const edgesCount = useMemo(() => {
    return allGames.filter((g) => g.best_over_edge || g.best_under_edge).length;
  }, [allGames]);

  return (
    <>
      <Helmet>
        <title>Game Percentiles | Historical H2H Analysis</title>
        <meta
          name="description"
          content="Analyze head-to-head historical totals for NFL, NBA, MLB, and NHL. View P05/P95 percentile bounds and line analysis."
        />
      </Helmet>

      <Layout>
        <div 
          className="space-y-6 animate-fade-in"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Hero section - minimal on mobile */}
          <div className="flex items-center justify-between pt-1 sm:pt-4">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold">Today's Picks</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {picksCount} of {totalGames} games
                </p>
                <EdgeExplainer compact />
              </div>
            </div>
            {edgesCount > 0 && (
              <Link
                to="/best-bets"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-status-edge/10 text-status-edge border border-status-edge/30 hover:bg-status-edge/20 transition-colors touch-manipulation active:scale-95"
              >
                <Zap className="h-3.5 w-3.5" />
                {edgesCount}
              </Link>
            )}
          </div>

          {/* Date picker - centered, more compact on mobile */}
          <div className="flex justify-center -mx-4 sm:mx-0">
            <DatePickerInline
              date={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>

          {/* Controls - simplified for mobile */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-card border border-border/50">
            {/* View mode */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50">
              <button
                onClick={() => setViewMode("all")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all touch-manipulation active:scale-95",
                  viewMode === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                All
              </button>
              <button
                onClick={() => setViewMode("sport")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all touch-manipulation active:scale-95",
                  viewMode === "sport" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                By Sport
              </button>
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-24 h-7 text-xs bg-background border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="edges-first">Best First</SelectItem>
                <SelectItem value="edge">By Edge</SelectItem>
                <SelectItem value="time">By Time</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter mode selector */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50 ml-auto">
              <button
                onClick={() => setFilterMode("best-bets")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-all touch-manipulation active:scale-95",
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
                  "px-2 py-1 text-xs font-medium rounded-md transition-all touch-manipulation active:scale-95",
                  filterMode === "picks" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                Picks
              </button>
              <button
                onClick={() => setFilterMode("all")}
                className={cn(
                  "px-2 py-1 text-xs font-medium rounded-md transition-all touch-manipulation active:scale-95",
                  filterMode === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                All
              </button>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer touch-manipulation">
              <Switch
                id="hide-weak"
                checked={hideWeakData}
                onCheckedChange={setHideWeakData}
                className="scale-75"
              />
              <span className="text-xs">5+</span>
            </label>
          </div>

          {/* Sport tabs (only shown in sport view) */}
          {viewMode === "sport" && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3">
              {sports.map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSport(sport.id)}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap touch-manipulation active:scale-95",
                    selectedSport === sport.id
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-muted/50 text-muted-foreground"
                  )}
                >
                  {sport.name}
                  <span className={cn(
                    "px-1 rounded text-2xs tabular-nums",
                    selectedSport === sport.id ? "bg-background/20" : "bg-muted"
                  )}>
                    {sportCounts[sport.id]}
                  </span>
                </button>
              ))}
            </div>
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
                nhlQuery.refetch();
                mlbQuery.refetch();
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
