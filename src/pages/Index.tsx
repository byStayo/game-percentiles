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
import { useTodayGames, TodayGame } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, TrendingUp, Filter, ChevronDown } from "lucide-react";
import type { SportId } from "@/types";

const ET_TIMEZONE = 'America/New_York';

function getTodayInET(): Date {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  return new Date(etDate.getFullYear(), etDate.getMonth(), etDate.getDate());
}

const sports: { id: SportId; name: string }[] = [
  { id: 'nfl', name: 'NFL' },
  { id: 'nba', name: 'NBA' },
  { id: 'nhl', name: 'NHL' },
  { id: 'mlb', name: 'MLB' },
];

type ViewMode = 'all' | 'sport';
type SortOption = 'time' | 'confidence' | 'edge';

export default function Index() {
  const [selectedDate, setSelectedDate] = useState(getTodayInET);
  const [selectedSport, setSelectedSport] = useState<SportId>('nba');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [sortBy, setSortBy] = useState<SortOption>('time');
  
  // Fetch all sports data
  const nflQuery = useTodayGames(selectedDate, 'nfl');
  const nbaQuery = useTodayGames(selectedDate, 'nba');
  const nhlQuery = useTodayGames(selectedDate, 'nhl');
  const mlbQuery = useTodayGames(selectedDate, 'mlb');
  
  const isLoading = nflQuery.isLoading || nbaQuery.isLoading || nhlQuery.isLoading || mlbQuery.isLoading;
  const hasError = nflQuery.error || nbaQuery.error || nhlQuery.error || mlbQuery.error;

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
  const displayGames = viewMode === 'all' ? allGames : sportGames;

  // Sort games
  const sortedGames = useMemo(() => {
    const games = [...displayGames];
    
    if (sortBy === 'time') {
      games.sort((a, b) => new Date(a.start_time_utc).getTime() - new Date(b.start_time_utc).getTime());
    } else if (sortBy === 'confidence') {
      games.sort((a, b) => b.n_h2h - a.n_h2h);
    } else if (sortBy === 'edge') {
      games.sort((a, b) => {
        const aEdge = a.dk_line_percentile !== null ? Math.abs(50 - a.dk_line_percentile) : 0;
        const bEdge = b.dk_line_percentile !== null ? Math.abs(50 - b.dk_line_percentile) : 0;
        return bEdge - aEdge;
      });
    }
    
    return games;
  }, [displayGames, sortBy]);

  // Sport counts
  const sportCounts = useMemo(() => ({
    nfl: nflQuery.data?.games?.length || 0,
    nba: nbaQuery.data?.games?.length || 0,
    nhl: nhlQuery.data?.games?.length || 0,
    mlb: mlbQuery.data?.games?.length || 0,
  }), [nflQuery.data, nbaQuery.data, nhlQuery.data, mlbQuery.data]);

  return (
    <>
      <Helmet>
        <title>Percentile Totals | Historical H2H Analysis</title>
        <meta name="description" content="Analyze head-to-head historical totals for NFL, NBA, MLB, and NHL. View P05/P95 percentile bounds and line analysis." />
      </Helmet>

      <Layout>
        <div className="space-y-10 animate-fade-in">
          {/* Hero section */}
          <div className="text-center space-y-4 py-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Percentile Totals
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Historical head-to-head analysis with statistical bounds
            </p>
          </div>

          {/* Date picker - centered */}
          <div className="flex justify-center">
            <DatePickerInline
              date={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>

          {/* View mode toggle & controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* View mode pills */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-secondary/50 w-fit">
              <button
                onClick={() => setViewMode('all')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
                  viewMode === 'all'
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Games
              </button>
              <button
                onClick={() => setViewMode('sport')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
                  viewMode === 'sport'
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                By Sport
              </button>
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">Sort by</span>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50">
                {[
                  { value: 'time', label: 'Time', icon: Clock },
                  { value: 'confidence', label: 'Data', icon: TrendingUp },
                  { value: 'edge', label: 'Edge', icon: Filter },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value as SortOption)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                      sortBy === option.value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <option.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sport tabs (only shown in sport view mode) */}
          {viewMode === 'sport' && (
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
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-2xs font-semibold tabular-nums",
                    selectedSport === sport.id
                      ? "bg-background/20 text-background"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {sportCounts[sport.id]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Stats summary for all games view */}
          {viewMode === 'all' && !isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sports.map((sport) => (
                <div
                  key={sport.id}
                  className="p-4 rounded-2xl bg-card border border-border/60 text-center"
                >
                  <div className="text-2xl font-bold tabular-nums">{sportCounts[sport.id]}</div>
                  <div className="text-sm text-muted-foreground">{sport.name} games</div>
                </div>
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
          ) : sortedGames.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No games available"
              description={`No games found for ${format(selectedDate, 'MMMM d, yyyy')}.`}
            />
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-status-under" />
              <span>Under signal (P≤20)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-status-edge" />
              <span>Neutral range</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-status-over" />
              <span>Over signal (P≥80)</span>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}