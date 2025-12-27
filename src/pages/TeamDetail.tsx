import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Calendar, Target, Users, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SportId } from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { format } from "date-fns";

interface TeamInfo {
  id: string;
  name: string;
  abbrev: string | null;
  city: string | null;
  sport_id: SportId;
}

interface SeasonStats {
  id: string;
  season_year: number;
  wins: number;
  losses: number;
  ppg_avg: number;
  opp_ppg_avg: number;
  playoff_result: string | null;
  conference: string | null;
  division: string | null;
}

interface H2HGame {
  id: string;
  start_time_utc: string;
  home_score: number;
  away_score: number;
  home_team_id: string;
  away_team_id: string;
  final_total: number;
  opponent_name: string;
  opponent_id: string;
  isHome: boolean;
  won: boolean;
}

interface H2HSummary {
  opponent_id: string;
  opponent_name: string;
  opponent_city: string | null;
  wins: number;
  losses: number;
  games: H2HGame[];
}

const sportLabels: Record<SportId, string> = {
  nfl: 'NFL',
  nba: 'NBA',
  mlb: 'MLB',
  nhl: 'NHL',
};

export default function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>();

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, abbrev, city, sport_id')
        .eq('id', teamId!)
        .maybeSingle();

      if (error) throw error;
      return data as TeamInfo | null;
    },
    enabled: !!teamId,
  });

  const { data: seasons, isLoading: seasonsLoading } = useQuery({
    queryKey: ['team-seasons', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_seasons')
        .select('id, season_year, wins, losses, ppg_avg, opp_ppg_avg, playoff_result, conference, division')
        .eq('team_id', teamId!)
        .order('season_year', { ascending: true });

      if (error) throw error;
      return (data || []) as SeasonStats[];
    },
    enabled: !!teamId,
  });

  // Fetch head-to-head games
  const { data: h2hGames, isLoading: h2hLoading } = useQuery({
    queryKey: ['team-h2h', teamId],
    queryFn: async () => {
      // Get games where this team played (home or away)
      const { data: games, error } = await supabase
        .from('games')
        .select(`
          id,
          start_time_utc,
          home_score,
          away_score,
          home_team_id,
          away_team_id,
          final_total,
          status
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('status', 'final')
        .order('start_time_utc', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Get all opponent team IDs
      const opponentIds = new Set<string>();
      games?.forEach(g => {
        if (g.home_team_id === teamId) opponentIds.add(g.away_team_id);
        else opponentIds.add(g.home_team_id);
      });

      // Fetch opponent names
      const { data: opponents } = await supabase
        .from('teams')
        .select('id, name, city')
        .in('id', Array.from(opponentIds));

      const opponentMap = new Map(opponents?.map(o => [o.id, o]) || []);

      return (games || []).map(g => {
        const isHome = g.home_team_id === teamId;
        const opponentId = isHome ? g.away_team_id : g.home_team_id;
        const opponent = opponentMap.get(opponentId);
        const teamScore = isHome ? g.home_score : g.away_score;
        const oppScore = isHome ? g.away_score : g.home_score;

        return {
          id: g.id,
          start_time_utc: g.start_time_utc,
          home_score: g.home_score,
          away_score: g.away_score,
          home_team_id: g.home_team_id,
          away_team_id: g.away_team_id,
          final_total: g.final_total,
          opponent_name: opponent?.name || 'Unknown',
          opponent_city: opponent?.city || null,
          opponent_id: opponentId,
          isHome,
          won: teamScore > oppScore,
        };
      }) as (H2HGame & { opponent_city: string | null })[];
    },
    enabled: !!teamId,
  });

  // Group H2H by opponent
  const h2hSummaries = useMemo(() => {
    if (!h2hGames) return [];
    
    const byOpponent = new Map<string, H2HSummary>();
    
    h2hGames.forEach(game => {
      if (!byOpponent.has(game.opponent_id)) {
        byOpponent.set(game.opponent_id, {
          opponent_id: game.opponent_id,
          opponent_name: game.opponent_name,
          opponent_city: (game as any).opponent_city,
          wins: 0,
          losses: 0,
          games: [],
        });
      }
      
      const summary = byOpponent.get(game.opponent_id)!;
      if (game.won) summary.wins++;
      else summary.losses++;
      summary.games.push(game);
    });
    
    // Sort by most games played
    return Array.from(byOpponent.values()).sort((a, b) => 
      (b.wins + b.losses) - (a.wins + a.losses)
    );
  }, [h2hGames]);

  const isLoading = teamLoading || seasonsLoading || h2hLoading;

  // Calculate career stats
  const careerStats = useMemo(() => {
    if (!seasons?.length) return null;

    const totalWins = seasons.reduce((sum, s) => sum + (s.wins || 0), 0);
    const totalLosses = seasons.reduce((sum, s) => sum + (s.losses || 0), 0);
    const avgPPG = seasons.reduce((sum, s) => sum + (s.ppg_avg || 0), 0) / seasons.length;
    const avgOppPPG = seasons.reduce((sum, s) => sum + (s.opp_ppg_avg || 0), 0) / seasons.length;
    const bestSeason = [...seasons].sort((a, b) => b.wins - a.wins)[0];
    const worstSeason = [...seasons].sort((a, b) => a.wins - b.wins)[0];

    return {
      totalSeasons: seasons.length,
      totalWins,
      totalLosses,
      winPct: ((totalWins / (totalWins + totalLosses || 1)) * 100).toFixed(1),
      avgPPG: avgPPG.toFixed(1),
      avgOppPPG: avgOppPPG.toFixed(1),
      pointDiff: (avgPPG - avgOppPPG).toFixed(1),
      bestSeason,
      worstSeason,
    };
  }, [seasons]);

  // Chart data
  const chartData = useMemo(() => {
    if (!seasons?.length) return [];
    return seasons.map(s => ({
      year: s.season_year,
      wins: s.wins,
      losses: s.losses,
      ppg: s.ppg_avg,
      oppPpg: s.opp_ppg_avg,
      winPct: ((s.wins / (s.wins + s.losses || 1)) * 100),
      diff: s.ppg_avg - s.opp_ppg_avg,
    }));
  }, [seasons]);

  if (!teamId) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Team not found</p>
          <Link to="/teams">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Teams
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Back Link */}
        <Link to="/teams" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Teams
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-20 w-80" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-80 rounded-xl" />
          </div>
        ) : !team ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">Team not found</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <span className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold uppercase",
                  team.sport_id === 'nba' && "bg-orange-500/10 text-orange-500",
                  team.sport_id === 'nfl' && "bg-green-500/10 text-green-500",
                  team.sport_id === 'mlb' && "bg-blue-500/10 text-blue-500",
                  team.sport_id === 'nhl' && "bg-cyan-500/10 text-cyan-500"
                )}>
                  {sportLabels[team.sport_id]}
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                {team.city && `${team.city} `}{team.name}
              </h1>
              {team.abbrev && (
                <p className="text-xl text-muted-foreground mt-1">{team.abbrev}</p>
              )}
            </div>

            {careerStats && (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <Card className="bg-card border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Seasons
                      </div>
                      <div className="text-3xl font-bold">{careerStats.totalSeasons}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Trophy className="h-3.5 w-3.5" />
                        Record
                      </div>
                      <div className="text-3xl font-bold">
                        <span className="text-status-over">{careerStats.totalWins}</span>
                        <span className="text-muted-foreground mx-1">-</span>
                        <span className="text-status-under">{careerStats.totalLosses}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Target className="h-3.5 w-3.5" />
                        Win %
                      </div>
                      <div className="text-3xl font-bold">{careerStats.winPct}%</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        {parseFloat(careerStats.pointDiff) >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        Avg Diff
                      </div>
                      <div className={cn(
                        "text-3xl font-bold",
                        parseFloat(careerStats.pointDiff) >= 0 ? "text-status-over" : "text-status-under"
                      )}>
                        {parseFloat(careerStats.pointDiff) >= 0 ? '+' : ''}{careerStats.pointDiff}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                {chartData.length > 1 && (
                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* Win/Loss Chart */}
                    <Card className="bg-card border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Wins & Losses by Season</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                              <XAxis dataKey="year" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                              />
                              <Legend />
                              <Bar dataKey="wins" name="Wins" fill="hsl(var(--status-over))" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="losses" name="Losses" fill="hsl(var(--status-under))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* PPG Trend Chart */}
                    <Card className="bg-card border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Scoring Trends</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                              <XAxis dataKey="year" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                              />
                              <Legend />
                              <Line type="monotone" dataKey="ppg" name="PPG" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                              <Line type="monotone" dataKey="oppPpg" name="Opp PPG" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Season Table */}
                <Card className="bg-card border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Season History</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/60 text-left text-sm text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Season</th>
                            <th className="px-4 py-3 font-medium text-right">W</th>
                            <th className="px-4 py-3 font-medium text-right">L</th>
                            <th className="px-4 py-3 font-medium text-right">Win%</th>
                            <th className="px-4 py-3 font-medium text-right">PPG</th>
                            <th className="px-4 py-3 font-medium text-right">Opp PPG</th>
                            <th className="px-4 py-3 font-medium text-right">Diff</th>
                            <th className="px-4 py-3 font-medium">Playoffs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seasons?.slice().reverse().map((s) => {
                            const winPct = ((s.wins / (s.wins + s.losses || 1)) * 100).toFixed(1);
                            const diff = (s.ppg_avg - s.opp_ppg_avg).toFixed(1);
                            const isPositive = parseFloat(diff) >= 0;
                            const isBest = s.id === careerStats.bestSeason.id;
                            const isWorst = s.id === careerStats.worstSeason.id;

                            return (
                              <tr
                                key={s.id}
                                className={cn(
                                  "border-b border-border/30 transition-colors",
                                  isBest && "bg-status-over/5",
                                  isWorst && seasons.length > 1 && "bg-status-under/5"
                                )}
                              >
                                <td className="px-4 py-3 font-medium">
                                  {s.season_year}
                                  {isBest && (
                                    <span className="ml-2 text-xs text-status-over">(Best)</span>
                                  )}
                                  {isWorst && seasons.length > 1 && (
                                    <span className="ml-2 text-xs text-status-under">(Worst)</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-status-over">
                                  {s.wins}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-status-under">
                                  {s.losses}
                                </td>
                                <td className="px-4 py-3 text-right font-medium">
                                  {winPct}%
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {s.ppg_avg?.toFixed(1) || '-'}
                                </td>
                                <td className="px-4 py-3 text-right text-muted-foreground">
                                  {s.opp_ppg_avg?.toFixed(1) || '-'}
                                </td>
                                <td className={cn(
                                  "px-4 py-3 text-right font-medium",
                                  isPositive ? "text-status-over" : "text-status-under"
                                )}>
                                  {isPositive ? '+' : ''}{diff}
                                </td>
                                <td className="px-4 py-3">
                                  {s.playoff_result ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-500">
                                      <Trophy className="h-3 w-3" />
                                      {s.playoff_result}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {(!seasons || seasons.length === 0) && (
                      <div className="px-4 py-12 text-center text-muted-foreground">
                        No season data available for this team
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Head-to-Head Records */}
                {h2hSummaries.length > 0 && (
                  <Card className="bg-card border-border/60 mt-8">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Head-to-Head Records
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border/60 text-left text-sm text-muted-foreground">
                              <th className="px-4 py-3 font-medium">Opponent</th>
                              <th className="px-4 py-3 font-medium text-center">W</th>
                              <th className="px-4 py-3 font-medium text-center">L</th>
                              <th className="px-4 py-3 font-medium text-center">Win%</th>
                              <th className="px-4 py-3 font-medium text-center hidden sm:table-cell">Games</th>
                              <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Last Game</th>
                            </tr>
                          </thead>
                          <tbody>
                            {h2hSummaries.slice(0, 20).map((h2h) => {
                              const totalGames = h2h.wins + h2h.losses;
                              const winPct = totalGames > 0 ? ((h2h.wins / totalGames) * 100).toFixed(1) : '0.0';
                              const lastGame = h2h.games[0];
                              
                              return (
                                <tr
                                  key={h2h.opponent_id}
                                  className="border-b border-border/30 hover:bg-muted/30 transition-colors group"
                                >
                                  <td className="px-4 py-3">
                                    <Link 
                                      to={`/team/${h2h.opponent_id}`}
                                      className="flex items-center gap-2 hover:text-primary transition-colors font-medium"
                                    >
                                      {h2h.opponent_city && <span className="hidden sm:inline text-muted-foreground">{h2h.opponent_city}</span>}
                                      {h2h.opponent_name}
                                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                    </Link>
                                  </td>
                                  <td className="px-4 py-3 text-center font-medium text-status-over">{h2h.wins}</td>
                                  <td className="px-4 py-3 text-center font-medium text-status-under">{h2h.losses}</td>
                                  <td className={cn(
                                    "px-4 py-3 text-center font-medium",
                                    parseFloat(winPct) >= 50 ? "text-status-over" : "text-status-under"
                                  )}>
                                    {winPct}%
                                  </td>
                                  <td className="px-4 py-3 text-center text-muted-foreground hidden sm:table-cell">
                                    {totalGames}
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm text-muted-foreground hidden md:table-cell">
                                    {lastGame && (
                                      <span className={cn(
                                        "inline-flex items-center gap-1",
                                        lastGame.won ? "text-status-over" : "text-status-under"
                                      )}>
                                        {lastGame.won ? 'W' : 'L'} {lastGame.isHome ? lastGame.home_score : lastGame.away_score}-{lastGame.isHome ? lastGame.away_score : lastGame.home_score}
                                        <span className="text-muted-foreground ml-1">
                                          ({format(new Date(lastGame.start_time_utc), 'MMM d, yyyy')})
                                        </span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      {h2hSummaries.length === 0 && (
                        <div className="px-4 py-12 text-center text-muted-foreground">
                          No head-to-head data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
