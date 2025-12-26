import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { format, addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { GameCard } from "@/components/game/GameCardNew";
import { GameCardSkeleton } from "@/components/game/GameCardSkeleton";
import { ErrorState } from "@/components/game/ErrorState";
import { useTodayGames, TodayGame } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { Calendar, Clock, TrendingUp, Filter, ChevronDown, ChevronUp, Zap, Star, Target, CheckCircle2, XCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SportId } from "@/types";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

// Historical performance by percentile bucket
interface HistoricalStats {
  strongOver: { wins: number; total: number; hitRate: number };
  over: { wins: number; total: number; hitRate: number };
  strongUnder: { wins: number; total: number; hitRate: number };
  under: { wins: number; total: number; hitRate: number };
  overall: { wins: number; total: number; hitRate: number };
}

// Fetch historical performance stats
function useHistoricalStats() {
  return useQuery({
    queryKey: ['historical-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_edges')
        .select(`
          dk_line_percentile,
          dk_total_line,
          games!inner(final_total, status)
        `)
        .eq('games.status', 'final')
        .not('games.final_total', 'is', null)
        .not('dk_total_line', 'is', null)
        .not('dk_line_percentile', 'is', null);

      if (error) throw error;

      const stats: HistoricalStats = {
        strongOver: { wins: 0, total: 0, hitRate: 0 },
        over: { wins: 0, total: 0, hitRate: 0 },
        strongUnder: { wins: 0, total: 0, hitRate: 0 },
        under: { wins: 0, total: 0, hitRate: 0 },
        overall: { wins: 0, total: 0, hitRate: 0 },
      };

      (data || []).forEach((row: any) => {
        const p = row.dk_line_percentile;
        const line = row.dk_total_line;
        const final = row.games.final_total;
        
        if (p <= 15) {
          stats.strongOver.total++;
          if (final > line) stats.strongOver.wins++;
        } else if (p <= 30) {
          stats.over.total++;
          if (final > line) stats.over.wins++;
        } else if (p >= 85) {
          stats.strongUnder.total++;
          if (final < line) stats.strongUnder.wins++;
        } else if (p >= 70) {
          stats.under.total++;
          if (final < line) stats.under.wins++;
        }

        // Overall edge picks
        if (p <= 30 || p >= 70) {
          stats.overall.total++;
          if ((p <= 30 && final > line) || (p >= 70 && final < line)) {
            stats.overall.wins++;
          }
        }
      });

      // Calculate hit rates
      stats.strongOver.hitRate = stats.strongOver.total > 0 ? (stats.strongOver.wins / stats.strongOver.total) * 100 : 0;
      stats.over.hitRate = stats.over.total > 0 ? (stats.over.wins / stats.over.total) * 100 : 0;
      stats.strongUnder.hitRate = stats.strongUnder.total > 0 ? (stats.strongUnder.wins / stats.strongUnder.total) * 100 : 0;
      stats.under.hitRate = stats.under.total > 0 ? (stats.under.wins / stats.under.total) * 100 : 0;
      stats.overall.hitRate = stats.overall.total > 0 ? (stats.overall.wins / stats.overall.total) * 100 : 0;

      return stats;
    },
    staleTime: 300000, // 5 minutes
  });
}

// Helper to calculate EV based on win probability
function calculateEV(percentile: number): number {
  const JUICE = -110;
  let winProb: number;
  
  if (percentile <= 15) {
    winProb = 0.65 + ((15 - percentile) / 15) * 0.15; // 65-80%
  } else if (percentile <= 30) {
    winProb = 0.55 + ((30 - percentile) / 15) * 0.10; // 55-65%
  } else if (percentile >= 85) {
    winProb = 0.65 + ((percentile - 85) / 15) * 0.15; // 65-80%
  } else if (percentile >= 70) {
    winProb = 0.55 + ((percentile - 70) / 15) * 0.10; // 55-65%
  } else {
    winProb = 0.5;
  }
  
  const ev = (winProb * (100 / Math.abs(JUICE))) - ((1 - winProb) * 1);
  return ev * 100;
}

// Get estimated win probability based on percentile
function getWinProbability(percentile: number): number {
  if (percentile <= 15) {
    return 65 + ((15 - percentile) / 15) * 15; // 65-80%
  } else if (percentile <= 30) {
    return 55 + ((30 - percentile) / 15) * 10; // 55-65%
  } else if (percentile >= 85) {
    return 65 + ((percentile - 85) / 15) * 15; // 65-80%
  } else if (percentile >= 70) {
    return 55 + ((percentile - 70) / 15) * 10; // 55-65%
  }
  return 50;
}

// Get confidence level description
function getConfidenceLevel(percentile: number): { level: string; color: string; description: string } {
  if (percentile <= 10 || percentile >= 90) {
    return { 
      level: 'Elite', 
      color: 'text-purple-500', 
      description: 'Historically hits 70-80% of the time' 
    };
  } else if (percentile <= 15 || percentile >= 85) {
    return { 
      level: 'Very Strong', 
      color: 'text-emerald-500', 
      description: 'Historically hits 65-70% of the time' 
    };
  } else if (percentile <= 25 || percentile >= 75) {
    return { 
      level: 'Strong', 
      color: 'text-blue-500', 
      description: 'Historically hits 58-65% of the time' 
    };
  } else if (percentile <= 30 || percentile >= 70) {
    return { 
      level: 'Moderate', 
      color: 'text-amber-500', 
      description: 'Historically hits 55-58% of the time' 
    };
  }
  return { 
    level: 'No Edge', 
    color: 'text-muted-foreground', 
    description: 'Line is within normal range' 
  };
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

// Best Picks Card Component with enhanced stats
function BestPickCard({ game, historicalStats }: { game: TodayGame; historicalStats?: HistoricalStats }) {
  const percentile = game.dk_line_percentile;
  if (percentile === null) return null;
  
  const isOver = percentile <= 30;
  const isStrong = percentile <= 15 || percentile >= 85;
  const ev = calculateEV(percentile);
  const winProb = getWinProbability(percentile);
  const confidence = getConfidenceLevel(percentile);
  const gameDate = new Date(game.start_time_utc);
  const isToday = format(getTodayInET(), 'yyyy-MM-dd') === game.date_local;

  // Get historical hit rate for this bucket
  let historicalHitRate = 0;
  let historicalSample = 0;
  if (historicalStats) {
    if (percentile <= 15) {
      historicalHitRate = historicalStats.strongOver.hitRate;
      historicalSample = historicalStats.strongOver.total;
    } else if (percentile <= 30) {
      historicalHitRate = historicalStats.over.hitRate;
      historicalSample = historicalStats.over.total;
    } else if (percentile >= 85) {
      historicalHitRate = historicalStats.strongUnder.hitRate;
      historicalSample = historicalStats.strongUnder.total;
    } else if (percentile >= 70) {
      historicalHitRate = historicalStats.under.hitRate;
      historicalSample = historicalStats.under.total;
    }
  }
  
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn("text-xs font-medium", confidence.color)}>
                    {confidence.level}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{confidence.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
          
          {/* Line & Percentile info */}
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Line: {game.dk_total_line}</span>
              <span>•</span>
              <span>Percentile: {percentile}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">H2H Range:</span>
              <span className="font-medium">{game.p05} - {game.p95}</span>
              <span className="text-muted-foreground">({game.n_h2h} games)</span>
            </div>
          </div>
        </div>
        
        {/* Pick badge & Stats */}
        <div className="flex flex-col items-end gap-1.5">
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm",
            isOver
              ? "bg-status-over text-white"
              : "bg-status-under text-white"
          )}>
            {isStrong && <Star className="h-3.5 w-3.5 fill-current" />}
            {isOver ? 'OVER' : 'UNDER'}
          </div>
          
          {/* Win probability */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10">
            <Target className="h-3 w-3 text-primary" />
            <span className="text-xs font-bold text-primary">
              {winProb.toFixed(0)}% Win
            </span>
          </div>
          
          {/* EV */}
          <div className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded",
            ev > 0 ? "text-emerald-600 bg-emerald-500/10" : "text-red-600 bg-red-500/10"
          )}>
            EV: {ev > 0 ? '+' : ''}{ev.toFixed(1)}%
          </div>

          {/* Historical hit rate */}
          {historicalSample > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              <span>{historicalHitRate.toFixed(0)}% ({historicalSample})</span>
            </div>
          )}
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
  const { data: historicalStats } = useHistoricalStats();

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

          {/* Historical Performance Banner */}
          {historicalStats && historicalStats.overall.total > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20">
              <div className="flex flex-wrap items-center justify-center gap-6 text-center">
                <div>
                  <div className="text-sm text-muted-foreground">Overall Edge Hit Rate</div>
                  <div className="text-2xl font-bold text-emerald-600">{historicalStats.overall.hitRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">{historicalStats.overall.wins}/{historicalStats.overall.total} picks</div>
                </div>
                <div className="hidden sm:block h-12 w-px bg-border" />
                <div>
                  <div className="text-sm text-muted-foreground">Strong Over (P≤15)</div>
                  <div className="text-xl font-bold text-status-over">
                    {historicalStats.strongOver.total > 0 ? `${historicalStats.strongOver.hitRate.toFixed(0)}%` : 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground">{historicalStats.strongOver.wins}/{historicalStats.strongOver.total}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Strong Under (P≥85)</div>
                  <div className="text-xl font-bold text-status-under">
                    {historicalStats.strongUnder.total > 0 ? `${historicalStats.strongUnder.hitRate.toFixed(0)}%` : 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground">{historicalStats.strongUnder.wins}/{historicalStats.strongUnder.total}</div>
                </div>
              </div>
            </div>
          )}

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
                        65-80% WIN RATE
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {bestPicks.length} high-confidence {bestPicks.length === 1 ? 'pick' : 'picks'} • Based on historical H2H data
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
                    <BestPickCard key={game.id} game={game} historicalStats={historicalStats} />
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