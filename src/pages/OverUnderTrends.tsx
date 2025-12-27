import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

type SportId = 'nba' | 'nfl' | 'mlb' | 'nhl';

const SPORT_CONFIG: Record<SportId, { label: string; color: string }> = {
  nba: { label: 'NBA', color: 'hsl(var(--chart-1))' },
  nfl: { label: 'NFL', color: 'hsl(var(--chart-2))' },
  mlb: { label: 'MLB', color: 'hsl(var(--chart-3))' },
  nhl: { label: 'NHL', color: 'hsl(var(--chart-4))' },
};

interface TeamOUStats {
  team_id: string;
  team_name: string;
  team_city: string | null;
  team_abbrev: string | null;
  total_games: number;
  overs: number;
  unders: number;
  pushes: number;
  over_pct: number;
  avg_margin: number;
}

export default function OverUnderTrends() {
  const [sport, setSport] = useState<SportId>('nba');

  // Fetch games with odds data
  const { data: trendsData, isLoading } = useQuery({
    queryKey: ['ou-trends', sport],
    queryFn: async () => {
      // Get games with final totals and their odds snapshots
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select(`
          id,
          final_total,
          home_team_id,
          away_team_id,
          status
        `)
        .eq('sport_id', sport)
        .eq('status', 'final')
        .not('final_total', 'is', null);

      if (gamesError) throw gamesError;

      // Get odds snapshots for these games
      const gameIds = games?.map(g => g.id) || [];
      const { data: odds, error: oddsError } = await supabase
        .from('odds_snapshots')
        .select('game_id, total_line')
        .in('game_id', gameIds)
        .not('total_line', 'is', null);

      if (oddsError) throw oddsError;

      // Create odds map (use first/earliest line per game)
      const oddsMap = new Map<string, number>();
      odds?.forEach(o => {
        if (!oddsMap.has(o.game_id)) {
          oddsMap.set(o.game_id, Number(o.total_line));
        }
      });

      // Get teams
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, city, abbrev')
        .eq('sport_id', sport);

      const teamMap = new Map(teams?.map(t => [t.id, t]) || []);

      // Calculate O/U stats per team
      const teamStats = new Map<string, {
        team_id: string;
        overs: number;
        unders: number;
        pushes: number;
        margins: number[];
      }>();

      games?.forEach(game => {
        const line = oddsMap.get(game.id);
        if (!line || !game.final_total) return;

        const margin = Number(game.final_total) - line;
        const result = margin > 0 ? 'over' : margin < 0 ? 'under' : 'push';

        // Update for both home and away teams
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!teamStats.has(teamId)) {
            teamStats.set(teamId, {
              team_id: teamId,
              overs: 0,
              unders: 0,
              pushes: 0,
              margins: [],
            });
          }
          const stats = teamStats.get(teamId)!;
          if (result === 'over') stats.overs++;
          else if (result === 'under') stats.unders++;
          else stats.pushes++;
          stats.margins.push(margin);
        });
      });

      // Convert to array with team info
      const results: TeamOUStats[] = [];
      teamStats.forEach((stats, teamId) => {
        const team = teamMap.get(teamId);
        if (!team) return;

        const totalGames = stats.overs + stats.unders + stats.pushes;
        if (totalGames < 5) return; // Minimum games threshold

        const avgMargin = stats.margins.reduce((a, b) => a + b, 0) / stats.margins.length;

        results.push({
          team_id: teamId,
          team_name: team.name,
          team_city: team.city,
          team_abbrev: team.abbrev,
          total_games: totalGames,
          overs: stats.overs,
          unders: stats.unders,
          pushes: stats.pushes,
          over_pct: (stats.overs / totalGames) * 100,
          avg_margin: Math.round(avgMargin * 10) / 10,
        });
      });

      // Sort by over percentage descending
      results.sort((a, b) => b.over_pct - a.over_pct);

      // Calculate league-wide stats
      let totalOvers = 0;
      let totalUnders = 0;
      let totalPushes = 0;
      results.forEach(r => {
        totalOvers += r.overs;
        totalUnders += r.unders;
        totalPushes += r.pushes;
      });
      // Divide by 2 since each game is counted for both teams
      totalOvers = Math.round(totalOvers / 2);
      totalUnders = Math.round(totalUnders / 2);
      totalPushes = Math.round(totalPushes / 2);

      return {
        teams: results,
        leagueStats: {
          totalGames: totalOvers + totalUnders + totalPushes,
          overs: totalOvers,
          unders: totalUnders,
          pushes: totalPushes,
          overPct: totalOvers + totalUnders > 0 
            ? Math.round((totalOvers / (totalOvers + totalUnders)) * 1000) / 10 
            : 50,
        },
      };
    },
  });

  const topOverTeams = trendsData?.teams.slice(0, 5) || [];
  const topUnderTeams = [...(trendsData?.teams || [])].sort((a, b) => a.over_pct - b.over_pct).slice(0, 5);

  const pieData = trendsData?.leagueStats ? [
    { name: 'Overs', value: trendsData.leagueStats.overs, fill: 'hsl(var(--status-over))' },
    { name: 'Unders', value: trendsData.leagueStats.unders, fill: 'hsl(var(--status-under))' },
    { name: 'Pushes', value: trendsData.leagueStats.pushes, fill: 'hsl(var(--muted-foreground))' },
  ] : [];

  return (
    <Layout>
      <Helmet>
        <title>Over/Under Trends | Betting Line Analysis</title>
        <meta
          name="description"
          content="Analyze over/under betting trends for NBA, NFL, MLB, and NHL teams. See which teams consistently go over or under the betting line."
        />
      </Helmet>

      <div className="container mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Over/Under Trends</h1>
          <p className="text-muted-foreground">
            Team performance against the betting total line
          </p>
        </div>

        <Tabs value={sport} onValueChange={(v) => setSport(v as SportId)}>
          <TabsList className="grid w-full grid-cols-4 max-w-md">
            {(['nba', 'nfl', 'mlb', 'nhl'] as SportId[]).map((s) => (
              <TabsTrigger key={s} value={s}>
                {SPORT_CONFIG[s].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : !trendsData?.teams.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No O/U data available for {SPORT_CONFIG[sport].label}. 
              This requires games with betting line data.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* League Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Games Tracked
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {trendsData.leagueStats.totalGames.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <ArrowUpRight className="h-4 w-4 text-status-over" />
                    Overs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-status-over">
                    {trendsData.leagueStats.overs}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {trendsData.leagueStats.overPct}% of games
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <ArrowDownRight className="h-4 w-4 text-status-under" />
                    Unders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-status-under">
                    {trendsData.leagueStats.unders}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {(100 - trendsData.leagueStats.overPct).toFixed(1)}% of games
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    O/U Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={20}
                        outerRadius={35}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Top Teams */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-status-over" />
                    Top Over Teams
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topOverTeams.map((team, i) => (
                    <Link
                      key={team.team_id}
                      to={`/team/${team.team_id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-medium">
                            {team.team_city} {team.team_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {team.overs}O - {team.unders}U ({team.total_games} games)
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-status-over">
                          {team.over_pct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Avg +{team.avg_margin > 0 ? team.avg_margin : team.avg_margin}
                        </div>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-status-under" />
                    Top Under Teams
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topUnderTeams.map((team, i) => (
                    <Link
                      key={team.team_id}
                      to={`/team/${team.team_id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-medium">
                            {team.team_city} {team.team_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {team.unders}U - {team.overs}O ({team.total_games} games)
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-status-under">
                          {(100 - team.over_pct).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Avg {team.avg_margin}
                        </div>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Full Team List */}
            <Card>
              <CardHeader>
                <CardTitle>All Teams O/U Performance</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left text-sm text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Team</th>
                        <th className="px-4 py-3 font-medium text-center">Games</th>
                        <th className="px-4 py-3 font-medium text-center">Overs</th>
                        <th className="px-4 py-3 font-medium text-center">Unders</th>
                        <th className="px-4 py-3 font-medium text-center">Over %</th>
                        <th className="px-4 py-3 font-medium text-center">Avg Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendsData.teams.map((team) => (
                        <tr key={team.team_id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <Link
                              to={`/team/${team.team_id}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {team.team_abbrev || team.team_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground">
                            {team.total_games}
                          </td>
                          <td className="px-4 py-3 text-center text-status-over font-medium">
                            {team.overs}
                          </td>
                          <td className="px-4 py-3 text-center text-status-under font-medium">
                            {team.unders}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-center font-bold",
                            team.over_pct >= 55 ? "text-status-over" : 
                            team.over_pct <= 45 ? "text-status-under" : ""
                          )}>
                            {team.over_pct.toFixed(1)}%
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-center",
                            team.avg_margin > 0 ? "text-status-over" : "text-status-under"
                          )}>
                            {team.avg_margin > 0 ? '+' : ''}{team.avg_margin}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
