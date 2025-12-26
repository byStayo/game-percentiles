import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { format, addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Layout } from "@/components/layout/Layout";
import { GameCard } from "@/components/game/GameCardNew";
import { GameCardSkeleton } from "@/components/game/GameCardSkeleton";
import { EmptyState } from "@/components/game/EmptyState";
import { ErrorState } from "@/components/game/ErrorState";
import { useTodayGames, TodayGame } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { Calendar, Clock, TrendingUp, Filter, ChevronDown, ChevronUp } from "lucide-react";
import type { SportId } from "@/types";

const ET_TIMEZONE = 'America/New_York';

function getTodayInET(): Date {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  return new Date(etDate.getFullYear(), etDate.getMonth(), etDate.getDate());
}

const sports: { id: SportId; name: string; color: string }[] = [
  { id: 'nfl', name: 'NFL', color: 'bg-sport-nfl' },
  { id: 'nba', name: 'NBA', color: 'bg-sport-nba' },
  { id: 'nhl', name: 'NHL', color: 'bg-sport-nhl' },
  { id: 'mlb', name: 'MLB', color: 'bg-sport-mlb' },
];

type SortOption = 'time' | 'confidence' | 'edge';

interface DayData {
  date: Date;
  dateString: string;
  games: TodayGame[];
  isLoading: boolean;
  hasError: boolean;
}

function useWeekGames() {
  const today = getTodayInET();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  
  // Fetch all sports for all 7 days
  const queries = dates.flatMap((date) => [
    { date, sportId: 'nfl' as SportId, query: useTodayGames(date, 'nfl') },
    { date, sportId: 'nba' as SportId, query: useTodayGames(date, 'nba') },
    { date, sportId: 'nhl' as SportId, query: useTodayGames(date, 'nhl') },
    { date, sportId: 'mlb' as SportId, query: useTodayGames(date, 'mlb') },
  ]);

  // Group by date
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>();
    
    dates.forEach((date) => {
      const dateString = format(date, 'yyyy-MM-dd');
      const dayQueries = queries.filter(q => format(q.date, 'yyyy-MM-dd') === dateString);
      
      const games: TodayGame[] = dayQueries.flatMap(q => q.query.data?.games || []);
      const isLoading = dayQueries.some(q => q.query.isLoading);
      const hasError = dayQueries.some(q => !!q.query.error);
      
      map.set(dateString, { date, dateString, games, isLoading, hasError });
    });
    
    return map;
  }, [queries.map(q => q.query.data).join(','), queries.map(q => q.query.isLoading).join(',')]);

  const isAnyLoading = queries.some(q => q.query.isLoading);
  const allGames = queries.flatMap(q => q.query.data?.games || []);
  
  const refetchAll = () => {
    queries.forEach(q => q.query.refetch());
  };

  return { dates, dayDataMap, isAnyLoading, allGames, refetchAll };
}

export default function WeekAhead() {
  const [sortBy, setSortBy] = useState<SortOption>('time');
  const [selectedSports, setSelectedSports] = useState<Set<SportId>>(new Set(['nfl', 'nba', 'nhl', 'mlb']));
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  
  const { dates, dayDataMap, isAnyLoading, allGames, refetchAll } = useWeekGames();

  const toggleSport = (sportId: SportId) => {
    setSelectedSports(prev => {
      const next = new Set(prev);
      if (next.has(sportId)) {
        if (next.size > 1) next.delete(sportId);
      } else {
        next.add(sportId);
      }
      return next;
    });
  };

  const toggleDay = (dateString: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateString)) {
        next.delete(dateString);
      } else {
        next.add(dateString);
      }
      return next;
    });
  };

  // Filter and sort games for a given day
  const getFilteredGames = (games: TodayGame[]) => {
    let filtered = games.filter(g => selectedSports.has(g.sport_id));
    
    if (sortBy === 'time') {
      filtered.sort((a, b) => new Date(a.start_time_utc).getTime() - new Date(b.start_time_utc).getTime());
    } else if (sortBy === 'confidence') {
      filtered.sort((a, b) => b.n_h2h - a.n_h2h);
    } else if (sortBy === 'edge') {
      filtered.sort((a, b) => {
        const aEdge = a.dk_line_percentile !== null ? Math.abs(50 - a.dk_line_percentile) : 0;
        const bEdge = b.dk_line_percentile !== null ? Math.abs(50 - b.dk_line_percentile) : 0;
        return bEdge - aEdge;
      });
    }
    
    return filtered;
  };

  // Count games by sport across all days
  const sportCounts = useMemo(() => {
    const counts: Record<SportId, number> = { nfl: 0, nba: 0, nhl: 0, mlb: 0 };
    allGames.forEach(g => {
      if (counts[g.sport_id] !== undefined) {
        counts[g.sport_id]++;
      }
    });
    return counts;
  }, [allGames]);

  // Total games after filtering
  const totalFilteredGames = allGames.filter(g => selectedSports.has(g.sport_id)).length;

  return (
    <>
      <Helmet>
        <title>Week Ahead | Upcoming Games</title>
        <meta name="description" content="View all upcoming games for the next 7 days across NFL, NBA, NHL, and MLB." />
      </Helmet>

      <Layout>
        <div className="space-y-8 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-4 py-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Next 7 Days
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Week Ahead
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {totalFilteredGames} games across all sports
            </p>
          </div>

          {/* Sport filters */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {sports.map((sport) => (
              <button
                key={sport.id}
                onClick={() => toggleSport(sport.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  selectedSports.has(sport.id)
                    ? "bg-foreground text-background shadow-md"
                    : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", sport.color)} />
                {sport.name}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-xs font-semibold tabular-nums",
                  selectedSports.has(sport.id)
                    ? "bg-background/20 text-background"
                    : "bg-muted text-muted-foreground"
                )}>
                  {sportCounts[sport.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Sort controls */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by</span>
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
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day-by-day breakdown */}
          <div className="space-y-6">
            {dates.map((date) => {
              const dateString = format(date, 'yyyy-MM-dd');
              const dayData = dayDataMap.get(dateString);
              if (!dayData) return null;

              const filteredGames = getFilteredGames(dayData.games);
              const isCollapsed = collapsedDays.has(dateString);
              const isToday = format(getTodayInET(), 'yyyy-MM-dd') === dateString;

              return (
                <div key={dateString} className="space-y-4">
                  {/* Day header */}
                  <button
                    onClick={() => toggleDay(dateString)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-card border border-border/60 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex flex-col items-center justify-center w-14 h-14 rounded-xl",
                        isToday ? "bg-primary text-primary-foreground" : "bg-secondary"
                      )}>
                        <span className="text-xs font-medium uppercase">
                          {format(date, 'EEE')}
                        </span>
                        <span className="text-xl font-bold">
                          {format(date, 'd')}
                        </span>
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">
                          {isToday ? 'Today' : format(date, 'EEEE')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(date, 'MMMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-bold tabular-nums">
                          {filteredGames.length}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {filteredGames.length === 1 ? 'game' : 'games'}
                        </div>
                      </div>
                      {isCollapsed ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Games for this day */}
                  {!isCollapsed && (
                    <>
                      {dayData.isLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {[...Array(3)].map((_, i) => (
                            <GameCardSkeleton key={i} />
                          ))}
                        </div>
                      ) : dayData.hasError ? (
                        <ErrorState
                          title="Unable to load games"
                          description="There was an error loading games for this day."
                          onRetry={refetchAll}
                        />
                      ) : filteredGames.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {filteredGames.map((game) => (
                            <GameCard key={game.id} game={game} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No games for selected sports
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary stats */}
          {!isAnyLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6">
              {sports.map((sport) => (
                <div
                  key={sport.id}
                  className={cn(
                    "p-4 rounded-2xl border text-center transition-opacity",
                    selectedSports.has(sport.id)
                      ? "bg-card border-border/60"
                      : "bg-card/50 border-border/30 opacity-50"
                  )}
                >
                  <div className="text-2xl font-bold tabular-nums">{sportCounts[sport.id]}</div>
                  <div className="text-sm text-muted-foreground">{sport.name} games</div>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-status-under" />
              <span>Take UNDER (P≥70)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-status-edge" />
              <span>No edge (P 30-70)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-status-over" />
              <span>Take OVER (P≤30)</span>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}
