import { useState, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { format, addDays, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Layout } from "@/components/layout/Layout";
import { DatePickerInline } from "@/components/ui/date-picker-inline";
import { GameCard } from "@/components/game/GameCardNew";
import { GameCardSkeleton } from "@/components/game/GameCardSkeleton";
import { EmptyState } from "@/components/game/EmptyState";
import { ErrorState } from "@/components/game/ErrorState";
import { WhatIsPPopover } from "@/components/game/WhatIsPPopover";
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

export default function Index() {
  const [selectedDate, setSelectedDate] = useState(getTodayInET);
  const [selectedSport, setSelectedSport] = useState<SportId>("nba");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sortBy, setSortBy] = useState<SortOption>("edges-first");
  const [onlyPicks, setOnlyPicks] = useState(true);
  const [onlyEdges, setOnlyEdges] = useState(false);
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

    // Filter: hide games with weak data quality (low/insufficient = n < 5)
    if (hideWeakData) {
      games = games.filter((g) => g.n_h2h >= 5);
    }

    // Filter: only show picks (games with actionable edges)
    if (onlyPicks) {
      games = games.filter((g) => {
        if (g.n_h2h < 5) return false;
        if (!g.dk_offered || g.dk_total_line === null) return false;
        const P = g.dk_line_percentile ?? 50;
        return P >= 70 || P <= 30;
      });
    }

    // Filter: only show games with detected over/under edges
    if (onlyEdges) {
      games = games.filter((g) => g.best_over_edge || g.best_under_edge);
    }

    // Sort
    if (sortBy === "edges-first") {
      // Prioritize games with over/under edges at the top
      games.sort((a, b) => {
        const aHasEdge = (a.best_over_edge || a.best_under_edge) ? 1 : 0;
        const bHasEdge = (b.best_over_edge || b.best_under_edge) ? 1 : 0;
        if (bHasEdge !== aHasEdge) return bHasEdge - aHasEdge;
        // Secondary sort by percentile edge strength
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
  }, [displayGames, sortBy, onlyPicks, onlyEdges, hideWeakData]);

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
          {/* Hero section - minimal */}
          <div className="text-center space-y-1 pt-2 sm:pt-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Game Percentiles
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {totalGames} games today • {picksCount} picks
            </p>
          </div>

          {/* Date picker - centered, more compact on mobile */}
          <div className="flex justify-center -mx-4 sm:mx-0">
            <DatePickerInline
              date={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>

          {/* Controls row - mobile optimized */}
          <div className="flex flex-col gap-3 p-3 sm:p-4 rounded-2xl bg-card border border-border/60">
            {/* Top row: View mode toggle + Sort */}
            <div className="flex items-center justify-between gap-3">
              {/* View mode pills - scrollable on mobile */}
              <div className="flex items-center gap-1 p-1 rounded-full bg-secondary/50 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setViewMode("all")}
                  className={cn(
                    "px-3 sm:px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap touch-manipulation",
                    "active:scale-95",
                    viewMode === "all"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setViewMode("sport")}
                  className={cn(
                    "px-3 sm:px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap touch-manipulation",
                    "active:scale-95",
                    viewMode === "sport"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  By Sport
                </button>
              </div>

              {/* Sort dropdown */}
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortOption)}
              >
                <SelectTrigger className="w-[120px] sm:w-[140px] h-10 bg-background touch-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edges-first">Edges First</SelectItem>
                  <SelectItem value="edge">Percentile</SelectItem>
                  <SelectItem value="time">Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bottom row: Toggles - larger touch targets */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <label className="flex items-center gap-3 cursor-pointer touch-manipulation">
                <Switch
                  id="only-picks"
                  checked={onlyPicks}
                  onCheckedChange={setOnlyPicks}
                  className="scale-110"
                />
                <span className="text-sm font-medium">Picks only</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer touch-manipulation">
                <Switch
                  id="hide-weak-data"
                  checked={hideWeakData}
                  onCheckedChange={setHideWeakData}
                  className="scale-110"
                />
                <span className="text-sm font-medium">Good data only</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer touch-manipulation">
                <Switch
                  id="only-edges"
                  checked={onlyEdges}
                  onCheckedChange={setOnlyEdges}
                  className="scale-110"
                />
                <span className="text-sm font-medium">Edges only</span>
              </label>

              <div className="ml-auto">
                <WhatIsPPopover />
              </div>
            </div>
          </div>

          {/* Sport tabs (only shown in sport view mode) - full width scroll on mobile */}
          {viewMode === "sport" && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
              {sports.map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSport(sport.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap touch-manipulation",
                    "active:scale-95",
                    selectedSport === sport.id
                      ? "bg-foreground text-background shadow-md"
                      : "bg-card border border-border/60 text-muted-foreground"
                  )}
                >
                  {sport.name}
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums",
                      selectedSport === sport.id
                        ? "bg-background/20 text-background"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {sportCounts[sport.id]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Games grid - single column on mobile for easier scanning */}
          {isLoading ? (
            <div className="grid gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="grid gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={onlyPicks ? "No picks available" : "No games available"}
              description={
                onlyPicks
                  ? `No picks for ${format(selectedDate, "MMM d")}. Try disabling "Picks only".`
                  : `No games for ${format(selectedDate, "MMM d")}.`
              }
            />
          )}
        </div>
      </Layout>
    </>
  );
}
