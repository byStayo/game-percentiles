import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { PageTransition } from "@/components/ui/page-transition";
import { Sparkline } from "@/components/ui/sparkline";
import { 
  TrendingUp, 
  TrendingDown, 
  Trophy, 
  Calendar, 
  Target, 
  BarChart3,
  Flame,
  Zap,
  Clock,
  ArrowUpRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";

interface DashboardMetrics {
  totalGamesToday: number;
  gamesThisWeek: number;
  avgPercentile: number;
  overHitRate: number;
  underHitRate: number;
  topEdgeGame: {
    id: string;
    teams: string;
    percentile: number;
    line: number;
  } | null;
  sportBreakdown: {
    sport: string;
    games: number;
    avgTotal: number;
  }[];
  recentTrends: {
    overStreak: number;
    underStreak: number;
  };
  weeklyData: number[];
}

export default function Dashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const { data: metrics, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard-metrics", today],
    queryFn: async (): Promise<DashboardMetrics> => {
      // Get today's games with edges
      const { data: todayEdges } = await supabase
        .from("daily_edges")
        .select(`
          *,
          games!inner(
            id,
            home_team:teams!games_home_team_id_fkey(name, abbrev),
            away_team:teams!games_away_team_id_fkey(name, abbrev),
            home_score,
            away_score,
            status
          )
        `)
        .eq("date_local", today)
        .eq("is_visible", true);

      // Get week's completed games for hit rates
      const { data: weekGames } = await supabase
        .from("daily_edges")
        .select(`
          dk_total_line,
          date_local,
          games!inner(
            final_total,
            status
          )
        `)
        .gte("date_local", weekAgo)
        .lte("date_local", today)
        .not("dk_total_line", "is", null);

      // Calculate hit rates from completed games
      const completedGames = weekGames?.filter(
        (g: any) => g.games?.status === "final" && g.games?.final_total != null
      ) || [];

      let overHits = 0;
      let underHits = 0;
      completedGames.forEach((g: any) => {
        if (g.games.final_total > g.dk_total_line) overHits++;
        else if (g.games.final_total < g.dk_total_line) underHits++;
      });

      const totalCompleted = completedGames.length || 1;
      const overHitRate = (overHits / totalCompleted) * 100;
      const underHitRate = (underHits / totalCompleted) * 100;

      // Generate weekly data for sparkline (games per day)
      const dailyCounts: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        dailyCounts[date] = 0;
      }
      weekGames?.forEach((g: any) => {
        if (dailyCounts[g.date_local] !== undefined) {
          dailyCounts[g.date_local]++;
        }
      });
      const weeklyData = Object.values(dailyCounts);

      // Sport breakdown
      const sportCounts: Record<string, { games: number; totalSum: number }> = {};
      todayEdges?.forEach((edge: any) => {
        const sport = edge.sport_id;
        if (!sportCounts[sport]) {
          sportCounts[sport] = { games: 0, totalSum: 0 };
        }
        sportCounts[sport].games++;
        if (edge.dk_total_line) {
          sportCounts[sport].totalSum += edge.dk_total_line;
        }
      });

      const sportBreakdown = Object.entries(sportCounts).map(([sport, data]) => ({
        sport: sport.toUpperCase(),
        games: data.games,
        avgTotal: data.games > 0 ? Math.round(data.totalSum / data.games * 10) / 10 : 0,
      }));

      // Find top edge game (lowest or highest percentile)
      const edgesWithPercentile = todayEdges?.filter(
        (e: any) => e.dk_line_percentile != null
      ) || [];
      
      let topEdge = null;
      if (edgesWithPercentile.length > 0) {
        // Find the most extreme percentile (furthest from 50)
        const sorted = [...edgesWithPercentile].sort((a: any, b: any) => {
          const aDistance = Math.abs(50 - (a.dk_line_percentile || 50));
          const bDistance = Math.abs(50 - (b.dk_line_percentile || 50));
          return bDistance - aDistance;
        });
        
        const top = sorted[0];
        topEdge = {
          id: top.game_id,
          teams: `${top.games.away_team?.abbrev || 'Away'} @ ${top.games.home_team?.abbrev || 'Home'}`,
          percentile: top.dk_line_percentile,
          line: top.dk_total_line,
        };
      }

      // Calculate average percentile
      const avgPercentile = edgesWithPercentile.length > 0
        ? edgesWithPercentile.reduce((sum: number, e: any) => sum + (e.dk_line_percentile || 0), 0) / edgesWithPercentile.length
        : 50;

      return {
        totalGamesToday: todayEdges?.length || 0,
        gamesThisWeek: weekGames?.length || 0,
        avgPercentile: Math.round(avgPercentile),
        overHitRate: Math.round(overHitRate),
        underHitRate: Math.round(underHitRate),
        topEdgeGame: topEdge,
        sportBreakdown,
        recentTrends: {
          overStreak: overHits > underHits ? overHits : 0,
          underStreak: underHits > overHits ? underHits : 0,
        },
        weeklyData,
      };
    },
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const lastUpdated = dataUpdatedAt ? format(new Date(dataUpdatedAt), "h:mm a") : null;

  return (
    <Layout>
      <PageTransition>
        <div className="container py-8 space-y-8">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Key metrics and insights across all sports
              </p>
            </div>
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Updated {lastUpdated}
              </div>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Games Today"
              value={metrics?.totalGamesToday}
              icon={Calendar}
              isLoading={isLoading}
              link="/"
              sparklineData={metrics?.weeklyData}
            />
            <MetricCard
              title="Week's Games"
              value={metrics?.gamesThisWeek}
              icon={BarChart3}
              isLoading={isLoading}
              link="/week"
            />
            <MetricCard
              title="Avg Percentile"
              value={metrics?.avgPercentile ? `${metrics.avgPercentile}%` : undefined}
              icon={Target}
              isLoading={isLoading}
              description="Today's average line percentile"
            />
            <MetricCard
              title="Over Hit Rate"
              value={metrics?.overHitRate ? `${metrics.overHitRate}%` : undefined}
              icon={TrendingUp}
              isLoading={isLoading}
              description="This week"
              highlight={metrics?.overHitRate && metrics.overHitRate > 55}
            />
          </div>

          {/* Second Row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Top Edge Game */}
            <Card className="lg:col-span-1 group hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Top Edge Today
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-yellow-500/10">
                  <Zap className="h-4 w-4 text-yellow-500" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : metrics?.topEdgeGame ? (
                  <Link 
                    to={`/game/${metrics.topEdgeGame.id}`}
                    className="block hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{metrics.topEdgeGame.teams}</div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className={`text-sm font-medium ${
                        metrics.topEdgeGame.percentile < 30 
                          ? "text-status-under" 
                          : metrics.topEdgeGame.percentile > 70 
                            ? "text-status-over" 
                            : "text-muted-foreground"
                      }`}>
                        P{metrics.topEdgeGame.percentile}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Line: {metrics.topEdgeGame.line}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="text-muted-foreground">No games with edges today</div>
                )}
              </CardContent>
            </Card>

            {/* Sport Breakdown */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sports Today
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : metrics?.sportBreakdown.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {metrics.sportBreakdown.map((sport) => (
                      <div 
                        key={sport.sport} 
                        className="flex flex-col p-3 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/40"
                      >
                        <span className="text-lg font-bold">{sport.sport}</span>
                        <span className="text-sm text-muted-foreground">
                          {sport.games} game{sport.games !== 1 ? "s" : ""}
                        </span>
                        {sport.avgTotal > 0 && (
                          <span className="text-xs text-muted-foreground/80 mt-0.5">
                            Avg: {sport.avgTotal}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground">No games scheduled</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <QuickLink
              title="Matchup Finder"
              description="Find historical matchups"
              icon={Target}
              href="/matchups"
            />
            <QuickLink
              title="O/U Trends"
              description="Over/under analysis"
              icon={TrendingDown}
              href="/ou-trends"
            />
            <QuickLink
              title="Power Rankings"
              description="Team performance rankings"
              icon={Zap}
              href="/rankings"
            />
            <QuickLink
              title="Rivalries"
              description="Competitive matchups"
              icon={Flame}
              href="/rivalries"
            />
          </div>
        </div>
      </PageTransition>
    </Layout>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  isLoading,
  description,
  link,
  highlight,
  sparklineData,
}: { 
  title: string;
  value?: string | number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  description?: string;
  link?: string;
  highlight?: boolean;
  sparklineData?: number[];
}) {
  const content = (
    <Card className={`metric-card group ${highlight ? "border-primary/50 bg-primary/5" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-1.5 rounded-lg ${highlight ? "bg-primary/10" : "bg-muted/50"}`}>
          <Icon className={`h-4 w-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold">{value ?? "—"}</div>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            {sparklineData && sparklineData.length > 1 && (
              <div className="w-16 h-8 opacity-60 group-hover:opacity-100 transition-opacity">
                <Sparkline data={sparklineData} color="primary" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (link) {
    return (
      <Link to={link} className="block hover:scale-[1.02] transition-transform">
        {content}
      </Link>
    );
  }

  return content;
}

function QuickLink({ 
  title, 
  description, 
  icon: Icon, 
  href 
}: { 
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link to={href}>
      <Card className="group hover:bg-muted/50 hover:shadow-md transition-all cursor-pointer h-full border-border/60">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 transition-colors">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-1">
              {title}
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
