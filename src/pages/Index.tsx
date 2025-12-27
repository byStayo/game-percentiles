import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Layout } from "@/components/layout/Layout";
import { DatePickerInline } from "@/components/ui/date-picker-inline";
import { GameCard } from "@/components/game/GameCardNew";
import { GameCardSkeleton } from "@/components/game/GameCardSkeleton";
import { EmptyState } from "@/components/game/EmptyState";
import { ErrorState } from "@/components/game/ErrorState";
import { WhatIsPPopover } from "@/components/game/WhatIsPPopover";
import { useTodayGames, TodayGame } from "@/hooks/useApi";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
type SortOption = "edge" | "time";

export default function Index() {
  const [selectedDate, setSelectedDate] = useState(getTodayInET);
  const [selectedSport, setSelectedSport] = useState<SportId>("nba");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sortBy, setSortBy] = useState<SortOption>("edge");
  const [onlyPicks, setOnlyPicks] = useState(true);
  const [hideLowSample, setHideLowSample] = useState(true);

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

    // Filter: hide low sample games
    if (hideLowSample) {
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

    // Sort
    if (sortBy === "edge") {
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
  }, [displayGames, sortBy, onlyPicks, hideLowSample]);

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
        <div className="space-y-8 animate-fade-in">
          {/* Hero section - minimal */}
          <div className="text-center space-y-2 pt-4">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Game Percentiles
            </h1>
            <p className="text-muted-foreground">
              {totalGames} games today • {picksCount} with picks
            </p>
          </div>

          {/* Date picker - centered */}
          <div className="flex justify-center">
            <DatePickerInline
              date={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>

          {/* Controls row */}
          <div className="flex flex-col gap-4 p-4 rounded-2xl bg-card border border-border/60">
            {/* Top: View mode + Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* View mode pills */}
              <div className="flex items-center gap-1 p-1 rounded-full bg-secondary/50 w-fit">
                <button
                  onClick={() => setViewMode("all")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
                    viewMode === "all"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Sports
                </button>
                <button
                  onClick={() => setViewMode("sport")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
                    viewMode === "sport"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  By Sport
                </button>
              </div>

              {/* Sort dropdown */}
              <div className="flex items-center gap-3">
                <Label className="text-sm text-muted-foreground">Sort by</Label>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as SortOption)}
                >
                  <SelectTrigger className="w-[140px] h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="edge">Edge strength</SelectItem>
                    <SelectItem value="time">Start time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bottom: Toggles + What is P */}
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="only-picks"
                  checked={onlyPicks}
                  onCheckedChange={setOnlyPicks}
                />
                <Label htmlFor="only-picks" className="text-sm cursor-pointer">
                  Only show picks
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="hide-low"
                  checked={hideLowSample}
                  onCheckedChange={setHideLowSample}
                />
                <Label htmlFor="hide-low" className="text-sm cursor-pointer">
                  Hide low-sample (n&lt;5)
                </Label>
              </div>

              <div className="ml-auto">
                <WhatIsPPopover />
              </div>
            </div>
          </div>

          {/* Sport tabs (only shown in sport view mode) */}
          {viewMode === "sport" && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {sports.map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSport(sport.id)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap",
                    selectedSport === sport.id
                      ? "bg-foreground text-background shadow-md"
                      : "bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  {sport.name}
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-md text-2xs font-semibold tabular-nums",
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

          {/* Games grid */}
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={onlyPicks ? "No picks available" : "No games available"}
              description={
                onlyPicks
                  ? `No actionable picks for ${format(selectedDate, "MMMM d, yyyy")}. Try disabling "Only show picks" to see all games.`
                  : `No games found for ${format(selectedDate, "MMMM d, yyyy")}.`
              }
            />
          )}
        </div>
      </Layout>
    </>
  );
}
