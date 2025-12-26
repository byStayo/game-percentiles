import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { format, addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Layout } from "@/components/layout/Layout";
import { GameCard } from "@/components/game/GameCardNew";
import { GameCardSkeleton } from "@/components/game/GameCardSkeleton";
import { ErrorState } from "@/components/game/ErrorState";
import { useTodayGames, TodayGame } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { Calendar, Clock, TrendingUp, Filter, ChevronDown, ChevronUp, Zap, Star } from "lucide-react";
import type { SportId } from "@/types";
import { Link } from "react-router-dom";

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

// Helper to calculate EV
function calculateEV(percentile: number): number {
  const JUICE = -110;
  const impliedProb = Math.abs(JUICE) / (Math.abs(JUICE) + 100);
  let winProb: number;
  
  if (percentile <= 30) {
    winProb = (30 - percentile) / 30 * 0.3 + 0.5;
  } else if (percentile >= 70) {
    winProb = (percentile - 70) / 30 * 0.3 + 0.5;
  } else {
    winProb = 0.5;
  }
  
  const ev = (winProb * (100 / Math.abs(JUICE))) - ((1 - winProb) * 1);
  return ev * 100;
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

// Best Picks Card Component
function BestPickCard({ game }: { game: TodayGame }) {
  const percentile = game.dk_line_percentile;
  if (percentile === null) return null;
  
  const isOver = percentile <= 30;
  const isStrong = percentile <= 15 || percentile >= 85;
  const ev = calculateEV(percentile);
  const gameDate = new Date(game.start_time_utc);
  const isToday = format(getTodayInET(), 'yyyy-MM-dd') === game.date_local;
  
  const sportColors: Record<SportId, string> = {
    nfl: 'border-sport-nfl/30 bg-sport-nfl/5',
    nba: 'border-sport-nba/30 bg-sport-nba/5',
    nhl: 'border-sport-nhl/30 bg-sport-nhl/5',
    mlb: 'border-sport-mlb/30 bg-sport-mlb/5',
  };

  return (
    <Link
      to={`/game/${game.game_id}`}
      className={cn(
        "block p-4 rounded-2xl border-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg",
        sportColors[game.sport_id]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Sport & Date */}
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              "px-2 py-0.5 rounded-md text-xs font-bold uppercase",
              game.sport_id === 'nfl' && "bg-sport-nfl/20 text-sport-nfl",
              game.sport_id === 'nba' && "bg-sport-nba/20 text-sport-nba",
              game.sport_id === 'nhl' && "bg-sport-nhl/20 text-sport-nhl",
              game.sport_id === 'mlb' && "bg-sport-mlb/20 text-sport-mlb",
            )}>
              {game.sport_id}
            </span>
            <span className="text-xs text-muted-foreground">
              {isToday ? format(gameDate, 'h:mm a') : format(gameDate, 'EEE, MMM d')}
            </span>
          </div>
          
          {/* Teams */}
          <div className="space-y-0.5">
            <div className="font-medium text-sm truncate">
              {game.away_team?.name || 'Away'}
            </div>
            <div className="font-medium text-sm truncate">
              @ {game.home_team?.name || 'Home'}
            </div>
          </div>
          
          {/* Line info */}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Line: {game.dk_total_line}</span>
            <span>•</span>
            <span>P{game.p05} - P{game.p95}</span>
          </div>
        </div>
        
        {/* Pick badge */}
        <div className="flex flex-col items-end gap-1">
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm",
            isOver
              ? "bg-status-over text-white"
              : "bg-status-under text-white"
          )}>
            {isStrong && <Star className="h-3.5 w-3.5 fill-current" />}
            {isOver ? 'OVER' : 'UNDER'}
          </div>
          <div className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded",
            ev > 0 ? "text-emerald-600 bg-emerald-500/10" : "text-red-600 bg-red-500/10"
          )}>
            EV: {ev > 0 ? '+' : ''}{ev.toFixed(1)}%
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function WeekAhead() {
  const [sortBy, setSortBy] = useState<SortOption>('time');
  const [selectedSports, setSelectedSports] = useState<Set<SportId>>(new Set(['nfl', 'nba', 'nhl', 'mlb']));
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [showBestPicks, setShowBestPicks] = useState(true);
  
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

  // Get best picks (strong signals only: percentile ≤15 or ≥85)
  const bestPicks = useMemo(() => {
    return allGames
      .filter(g => {
        if (!selectedSports.has(g.sport_id)) return false;
        if (g.dk_line_percentile === null) return false;
        return g.dk_line_percentile <= 15 || g.dk_line_percentile >= 85;
      })
      .sort((a, b) => {
        // Sort by edge strength (distance from 50)
        const aEdge = Math.abs(50 - (a.dk_line_percentile || 50));
        const bEdge = Math.abs(50 - (b.dk_line_percentile || 50));
        return bEdge - aEdge;
      });
  }, [allGames, selectedSports]);

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

          {/* Best Picks Section */}
          {!isAnyLoading && bestPicks.length > 0 && (
            <div className="space-y-4">
              <button
                onClick={() => setShowBestPicks(!showBestPicks)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-2 border-amber-500/20 hover:border-amber-500/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">Best Picks</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 text-xs font-bold">
                        STRONG
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {bestPicks.length} high-confidence {bestPicks.length === 1 ? 'pick' : 'picks'} this week
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {showBestPicks ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {showBestPicks && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {bestPicks.map((game) => (
                    <BestPickCard key={game.id} game={game} />
                  ))}
                </div>
              )}
            </div>
          )}

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