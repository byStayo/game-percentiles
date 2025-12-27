import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

interface LeagueStats {
  sport_id: string;
  totalGames: number;
  avgTotal: number;
  minTotal: number;
  maxTotal: number;
  seasonTrends: { season: number; avgTotal: number; gameCount: number }[];
  distribution: { range: string; count: number }[];
}

type SportId = 'nba' | 'nfl' | 'mlb' | 'nhl';

const SPORT_CONFIG: Record<SportId, { label: string; color: string; ranges: number[] }> = {
  nba: { label: 'NBA', color: 'hsl(var(--chart-1))', ranges: [180, 200, 210, 220, 230, 240, 260, 280] },
  nfl: { label: 'NFL', color: 'hsl(var(--chart-2))', ranges: [30, 35, 40, 45, 50, 55, 60, 70] },
  mlb: { label: 'MLB', color: 'hsl(var(--chart-3))', ranges: [4, 6, 8, 10, 12, 14, 16, 20] },
  nhl: { label: 'NHL', color: 'hsl(var(--chart-4))', ranges: [3, 4, 5, 6, 7, 8, 9, 12] },
};

export default function LeagueStats() {
  const [stats, setStats] = useState<Record<SportId, LeagueStats | null>>({
    nba: null,
    nfl: null,
    mlb: null,
    nhl: null,
  });
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<SportId>('nba');

  useEffect(() => {
    fetchAllStats();
  }, []);

  async function fetchAllStats() {
    setLoading(true);
    const sports: SportId[] = ['nba', 'nfl', 'mlb', 'nhl'];
    const results: Record<SportId, LeagueStats | null> = {
      nba: null,
      nfl: null,
      mlb: null,
      nhl: null,
    };

    for (const sport of sports) {
      try {
        // Fetch all games with totals for this sport
        const { data: games, error } = await supabase
          .from('games')
          .select('final_total, start_time_utc')
          .eq('sport_id', sport)
          .not('final_total', 'is', null)
          .order('start_time_utc', { ascending: true });

        if (error) throw error;
        if (!games || games.length === 0) continue;

        const totals = games.map((g) => Number(g.final_total));
        const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;

        // Group by season year
        const seasonData: Record<number, { sum: number; count: number }> = {};
        games.forEach((g) => {
          const year = new Date(g.start_time_utc).getFullYear();
          if (!seasonData[year]) seasonData[year] = { sum: 0, count: 0 };
          seasonData[year].sum += Number(g.final_total);
          seasonData[year].count += 1;
        });

        const seasonTrends = Object.entries(seasonData)
          .map(([year, data]) => ({
            season: parseInt(year),
            avgTotal: Math.round((data.sum / data.count) * 10) / 10,
            gameCount: data.count,
          }))
          .sort((a, b) => a.season - b.season);

        // Build distribution histogram
        const ranges = SPORT_CONFIG[sport].ranges;
        const distribution = ranges.map((r, i) => {
          const min = i === 0 ? 0 : ranges[i - 1];
          const max = r;
          const count = totals.filter((t) => t >= min && t < max).length;
          return { range: `${min}-${max}`, count };
        });
        // Add overflow bucket
        const lastRange = ranges[ranges.length - 1];
        const overflowCount = totals.filter((t) => t >= lastRange).length;
        distribution.push({ range: `${lastRange}+`, count: overflowCount });

        results[sport] = {
          sport_id: sport,
          totalGames: games.length,
          avgTotal: Math.round(avgTotal * 10) / 10,
          minTotal: Math.min(...totals),
          maxTotal: Math.max(...totals),
          seasonTrends,
          distribution,
        };
      } catch (err) {
        console.error(`Error fetching ${sport} stats:`, err);
      }
    }

    setStats(results);
    setLoading(false);
  }

  const currentStats = stats[activeSport];

  return (
    <Layout>
      <Helmet>
        <title>League Stats | Scoring Trends Across Sports</title>
        <meta
          name="description"
          content="Analyze scoring trends and totals distribution across NBA, NFL, MLB, and NHL. Historical data and statistics for all major sports leagues."
        />
      </Helmet>

      <div className="container mx-auto py-6 px-4 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">League-Wide Stats</h1>
            <p className="text-muted-foreground">
              Scoring trends and totals distribution across all sports
            </p>
          </div>
        </div>

        <Tabs value={activeSport} onValueChange={(v) => setActiveSport(v as SportId)}>
          <TabsList className="grid w-full grid-cols-4 max-w-md">
            {(['nba', 'nfl', 'mlb', 'nhl'] as SportId[]).map((sport) => (
              <TabsTrigger key={sport} value={sport}>
                {SPORT_CONFIG[sport].label}
              </TabsTrigger>
            ))}
          </TabsList>

          {(['nba', 'nfl', 'mlb', 'nhl'] as SportId[]).map((sport) => (
            <TabsContent key={sport} value={sport} className="space-y-6">
              {loading ? (
                <div className="grid gap-6 md:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : !stats[sport] ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No data available for {SPORT_CONFIG[sport].label}
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Total Games
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {stats[sport]!.totalGames.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Avg Total
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats[sport]!.avgTotal}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Min Total
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats[sport]!.minTotal}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Max Total
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats[sport]!.maxTotal}</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Scoring Trends Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Scoring Trends by Season
                        <Badge variant="outline" className="ml-2">
                          {stats[sport]!.seasonTrends.length} seasons
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={stats[sport]!.seasonTrends}>
                          <defs>
                            <linearGradient id={`gradient-${sport}`} x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor={SPORT_CONFIG[sport].color}
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor={SPORT_CONFIG[sport].color}
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="season" className="text-xs" />
                          <YAxis className="text-xs" domain={['auto', 'auto']} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="avgTotal"
                            stroke={SPORT_CONFIG[sport].color}
                            strokeWidth={2}
                            fill={`url(#gradient-${sport})`}
                            name="Avg Total"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Games Per Season Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Games Per Season</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={stats[sport]!.seasonTrends}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="season" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar
                            dataKey="gameCount"
                            fill={SPORT_CONFIG[sport].color}
                            radius={[4, 4, 0, 0]}
                            name="Games"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Distribution Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Totals Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats[sport]!.distribution}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="range" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar
                            dataKey="count"
                            fill={SPORT_CONFIG[sport].color}
                            radius={[4, 4, 0, 0]}
                            name="Games"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Cross-Sport Comparison */}
        {!loading && (
          <Card>
            <CardHeader>
              <CardTitle>Cross-Sport Average Totals Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['nba', 'nfl', 'mlb', 'nhl'] as SportId[]).map((sport) => (
                  <div
                    key={sport}
                    className="p-4 rounded-lg border bg-card text-center"
                    style={{ borderColor: SPORT_CONFIG[sport].color }}
                  >
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      {SPORT_CONFIG[sport].label}
                    </div>
                    <div className="text-3xl font-bold" style={{ color: SPORT_CONFIG[sport].color }}>
                      {stats[sport]?.avgTotal ?? '—'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      avg points/runs
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
