import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, eachDayOfInterval, startOfDay, parseISO } from "date-fns";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, BarChart3, Calendar, Filter, LineChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { SportId } from "@/types";

interface CompletedGame {
  game_id: string;
  sport_id: SportId;
  final_total: number;
  dk_total_line: number;
  dk_line_percentile: number;
  p05: number;
  p95: number;
  n_h2h: number;
  date_local: string;
}

interface PredictionResult {
  type: 'hit' | 'miss' | 'push' | 'no_edge';
  direction: 'over' | 'under' | null;
}

function getPredictionResult(game: CompletedGame): PredictionResult {
  const { final_total, dk_total_line, dk_line_percentile } = game;

  const wentOver = final_total > dk_total_line;
  const wentUnder = final_total < dk_total_line;
  const isPush = final_total === dk_total_line;

  if (isPush) {
    return { type: 'push', direction: null };
  }

  const predictedOver = dk_line_percentile < 30;
  const predictedUnder = dk_line_percentile > 70;

  if (predictedOver) {
    return { type: wentOver ? 'hit' : 'miss', direction: 'over' };
  } else if (predictedUnder) {
    return { type: wentUnder ? 'hit' : 'miss', direction: 'under' };
  }

  return { type: 'no_edge', direction: null };
}

const sportLabels: Record<SportId, string> = {
  nfl: 'NFL',
  nba: 'NBA',
  mlb: 'MLB',
  nhl: 'NHL',
};

const confidenceBuckets = [
  { label: 'n ≥ 10', min: 10, max: Infinity },
  { label: 'n = 5-9', min: 5, max: 9 },
  { label: 'n = 2-4', min: 2, max: 4 },
  { label: 'n = 1', min: 1, max: 1 },
];

export default function Stats() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [sportFilter, setSportFilter] = useState<SportId | 'all'>('all');

  const { data: games, isLoading } = useQuery({
    queryKey: ['stats-games', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('daily_edges')
        .select(`
          game_id,
          sport_id,
          dk_total_line,
          dk_line_percentile,
          p05,
          p95,
          n_h2h,
          date_local,
          games!inner(final_total, status)
        `)
        .eq('games.status', 'final')
        .not('games.final_total', 'is', null)
        .not('dk_total_line', 'is', null)
        .not('dk_line_percentile', 'is', null);

      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
        query = query.gte('date_local', startDate);
      }

      const { data, error } = await query.order('date_local', { ascending: false });
      if (error) throw error;

      return (data || []).map((row: any) => ({
        game_id: row.game_id,
        sport_id: row.sport_id as SportId,
        final_total: row.games.final_total,
        dk_total_line: row.dk_total_line,
        dk_line_percentile: row.dk_line_percentile,
        p05: row.p05,
        p95: row.p95,
        n_h2h: row.n_h2h,
        date_local: row.date_local,
      })) as CompletedGame[];
    },
    staleTime: 60000,
  });

  const stats = useMemo(() => {
    if (!games) return null;

    const filteredGames = sportFilter === 'all' 
      ? games 
      : games.filter(g => g.sport_id === sportFilter);

    const results = filteredGames.map(g => ({
      ...g,
      result: getPredictionResult(g),
    }));

    // Only count games with actual edge predictions
    const edgeGames = results.filter(r => r.result.type !== 'no_edge' && r.result.type !== 'push');
    const hits = edgeGames.filter(r => r.result.type === 'hit');
    const misses = edgeGames.filter(r => r.result.type === 'miss');

    // By sport
    const bySport = (['nfl', 'nba', 'mlb', 'nhl'] as SportId[]).map(sport => {
      const sportGames = results.filter(r => r.sport_id === sport);
      const sportEdge = sportGames.filter(r => r.result.type !== 'no_edge' && r.result.type !== 'push');
      const sportHits = sportEdge.filter(r => r.result.type === 'hit');
      return {
        sport,
        total: sportGames.length,
        edgeGames: sportEdge.length,
        hits: sportHits.length,
        misses: sportEdge.length - sportHits.length,
        hitRate: sportEdge.length > 0 ? (sportHits.length / sportEdge.length) * 100 : 0,
      };
    }).filter(s => s.total > 0);

    // By confidence bucket
    const byConfidence = confidenceBuckets.map(bucket => {
      const bucketGames = results.filter(r => r.n_h2h >= bucket.min && r.n_h2h <= bucket.max);
      const bucketEdge = bucketGames.filter(r => r.result.type !== 'no_edge' && r.result.type !== 'push');
      const bucketHits = bucketEdge.filter(r => r.result.type === 'hit');
      return {
        label: bucket.label,
        total: bucketGames.length,
        edgeGames: bucketEdge.length,
        hits: bucketHits.length,
        misses: bucketEdge.length - bucketHits.length,
        hitRate: bucketEdge.length > 0 ? (bucketHits.length / bucketEdge.length) * 100 : 0,
      };
    }).filter(b => b.total > 0);

    // By direction
    const overPicks = edgeGames.filter(r => r.result.direction === 'over');
    const underPicks = edgeGames.filter(r => r.result.direction === 'under');
    const overHits = overPicks.filter(r => r.result.type === 'hit');
    const underHits = underPicks.filter(r => r.result.type === 'hit');

    // Time series data for chart
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 90;
    const startDate = subDays(new Date(), days);
    const dateInterval = eachDayOfInterval({ start: startDate, end: new Date() });
    
    const timeSeriesData = dateInterval.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayGames = edgeGames.filter(g => g.date_local === dateStr);
      const dayHits = dayGames.filter(g => g.result.type === 'hit').length;
      const dayTotal = dayGames.length;
      
      return {
        date: dateStr,
        displayDate: format(date, 'MMM d'),
        hitRate: dayTotal > 0 ? (dayHits / dayTotal) * 100 : null,
        picks: dayTotal,
        hits: dayHits,
      };
    }).filter(d => d.picks > 0);

    // Calculate cumulative/rolling hit rate
    let cumulativeHits = 0;
    let cumulativeTotal = 0;
    const cumulativeData = timeSeriesData.map(d => {
      cumulativeHits += d.hits;
      cumulativeTotal += d.picks;
      return {
        ...d,
        cumulativeRate: cumulativeTotal > 0 ? (cumulativeHits / cumulativeTotal) * 100 : null,
      };
    });

    return {
      totalGames: filteredGames.length,
      edgeGames: edgeGames.length,
      hits: hits.length,
      misses: misses.length,
      hitRate: edgeGames.length > 0 ? (hits.length / edgeGames.length) * 100 : 0,
      bySport,
      byConfidence,
      overPicks: overPicks.length,
      overHits: overHits.length,
      overRate: overPicks.length > 0 ? (overHits.length / overPicks.length) * 100 : 0,
      underPicks: underPicks.length,
      underHits: underHits.length,
      underRate: underPicks.length > 0 ? (underHits.length / underPicks.length) * 100 : 0,
      timeSeriesData: cumulativeData,
    };
  }, [games, sportFilter, dateRange]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-3">
            Prediction Stats
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Track prediction accuracy over time
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <div className="flex items-center gap-2 bg-card rounded-xl p-1.5 border border-border/60">
            <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
            {(['7d', '30d', '90d', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  dateRange === range
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {range === 'all' ? 'All Time' : range.toUpperCase()}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2 bg-card rounded-xl p-1.5 border border-border/60">
            <Filter className="h-4 w-4 text-muted-foreground ml-2" />
            <button
              onClick={() => setSportFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                sportFilter === 'all'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              All Sports
            </button>
            {(['nfl', 'nba', 'mlb', 'nhl'] as SportId[]).map(sport => (
              <button
                key={sport}
                onClick={() => setSportFilter(sport)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium uppercase transition-all",
                  sportFilter === sport
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {sport}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <Card className="bg-card border-border/60 shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Overall Hit Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-foreground">
                    {stats.hitRate.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {stats.hits} hits / {stats.edgeGames} edge picks
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/60 shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-status-over" />
                    Over Predictions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-status-over">
                    {stats.overRate.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {stats.overHits} hits / {stats.overPicks} picks
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/60 shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-status-under" />
                    Under Predictions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-status-under">
                    {stats.underRate.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {stats.underHits} hits / {stats.underPicks} picks
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Accuracy Trend Chart */}
            {stats.timeSeriesData.length > 1 && (
              <Card className="bg-card border-border/60 shadow-card mb-10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    Accuracy Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={stats.timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis 
                          dataKey="displayDate" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                          formatter={(value: number, name: string) => [
                            `${value?.toFixed(1)}%`,
                            name === 'hitRate' ? 'Daily Rate' : 'Cumulative Rate'
                          ]}
                        />
                        <ReferenceLine 
                          y={50} 
                          stroke="hsl(var(--muted-foreground))" 
                          strokeDasharray="5 5" 
                          opacity={0.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="hitRate"
                          stroke="hsl(var(--status-edge))"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--status-edge))', strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, fill: 'hsl(var(--status-edge))' }}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulativeRate"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          dot={false}
                          strokeDasharray="0"
                        />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-status-edge" />
                      <span className="text-muted-foreground">Daily Rate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-muted-foreground">Cumulative Rate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-px bg-muted-foreground" style={{ borderTop: '2px dashed' }} />
                      <span className="text-muted-foreground">50% Baseline</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* By Sport */}
            {stats.bySport.length > 0 && (
              <Card className="bg-card border-border/60 shadow-card mb-10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    By Sport
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.bySport.map(sport => (
                      <div key={sport.sport} className="flex items-center gap-4">
                        <div className="w-16 text-sm font-semibold uppercase text-muted-foreground">
                          {sportLabels[sport.sport]}
                        </div>
                        <div className="flex-1">
                          <div className="h-3 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                sport.hitRate >= 55 ? "bg-status-under" :
                                sport.hitRate >= 45 ? "bg-status-edge" : "bg-status-over"
                              )}
                              style={{ width: `${Math.min(sport.hitRate, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-24 text-right">
                          <span className="text-sm font-bold">{sport.hitRate.toFixed(1)}%</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({sport.hits}/{sport.edgeGames})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* By Confidence */}
            {stats.byConfidence.length > 0 && (
              <Card className="bg-card border-border/60 shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    By H2H Sample Size
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.byConfidence.map(bucket => (
                      <div key={bucket.label} className="flex items-center gap-4">
                        <div className="w-20 text-sm font-medium text-muted-foreground">
                          {bucket.label}
                        </div>
                        <div className="flex-1">
                          <div className="h-3 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                bucket.hitRate >= 55 ? "bg-status-under" :
                                bucket.hitRate >= 45 ? "bg-status-edge" : "bg-status-over"
                              )}
                              style={{ width: `${Math.min(bucket.hitRate, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-24 text-right">
                          <span className="text-sm font-bold">{bucket.hitRate.toFixed(1)}%</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({bucket.hits}/{bucket.edgeGames})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state */}
            {stats.edgeGames === 0 && (
              <Card className="bg-card border-border/60 shadow-card">
                <CardContent className="py-12 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No edge predictions yet</h3>
                  <p className="text-muted-foreground">
                    Completed games with extreme percentile lines will appear here
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </Layout>
  );
}