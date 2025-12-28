import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/components/ui/page-transition';
import { SwapButton } from '@/components/ui/swap-button';
import { SportIcon } from '@/components/ui/sport-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, TrendingUp, TrendingDown, ArrowRight, Trophy, Users } from 'lucide-react';
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
} from 'recharts';

type SportId = 'nba' | 'nfl' | 'mlb' | 'nhl';

const SPORT_CONFIG: Record<SportId, { label: string; color: string }> = {
  nba: { label: 'NBA', color: 'hsl(var(--chart-1))' },
  nfl: { label: 'NFL', color: 'hsl(var(--chart-2))' },
  mlb: { label: 'MLB', color: 'hsl(var(--chart-3))' },
  nhl: { label: 'NHL', color: 'hsl(var(--chart-4))' },
};

interface Team {
  id: string;
  name: string;
  abbrev: string | null;
  city: string | null;
}

interface MatchupGame {
  id: string;
  start_time_utc: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  final_total: number | null;
}

export default function MatchupFinder() {
  const [sport, setSport] = useState<SportId>('nba');
  const [team1Id, setTeam1Id] = useState<string>('');
  const [team2Id, setTeam2Id] = useState<string>('');
  const [searched, setSearched] = useState(false);

  // Fetch teams for selected sport
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', sport],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, abbrev, city')
        .eq('sport_id', sport)
        .order('name');
      if (error) throw error;
      return (data || []) as Team[];
    },
  });

  // Fetch matchup games
  const { data: games, isLoading: gamesLoading, refetch } = useQuery({
    queryKey: ['matchup-games', team1Id, team2Id],
    queryFn: async () => {
      if (!team1Id || !team2Id) return [];

      const { data, error } = await supabase
        .from('games')
        .select('id, start_time_utc, home_team_id, away_team_id, home_score, away_score, final_total')
        .eq('status', 'final')
        .or(
          `and(home_team_id.eq.${team1Id},away_team_id.eq.${team2Id}),and(home_team_id.eq.${team2Id},away_team_id.eq.${team1Id})`
        )
        .order('start_time_utc', { ascending: false });

      if (error) throw error;
      return (data || []) as MatchupGame[];
    },
    enabled: false,
  });

  const team1 = teams?.find((t) => t.id === team1Id);
  const team2 = teams?.find((t) => t.id === team2Id);

  // Swap teams handler
  const handleSwapTeams = () => {
    const temp = team1Id;
    setTeam1Id(team2Id);
    setTeam2Id(temp);
  };

  // Compute stats
  const stats = useMemo(() => {
    if (!games?.length || !team1Id || !team2Id) return null;

    let team1Wins = 0;
    let team2Wins = 0;
    let team1TotalScore = 0;
    let team2TotalScore = 0;
    let totalPoints = 0;
    const yearlyGames: Record<number, { team1Wins: number; team2Wins: number; avgTotal: number; games: number }> = {};

    games.forEach((g) => {
      const team1IsHome = g.home_team_id === team1Id;
      const team1Score = team1IsHome ? g.home_score : g.away_score;
      const team2Score = team1IsHome ? g.away_score : g.home_score;

      if (team1Score !== null && team2Score !== null) {
        if (team1Score > team2Score) team1Wins++;
        else team2Wins++;

        team1TotalScore += team1Score;
        team2TotalScore += team2Score;
        totalPoints += g.final_total || (team1Score + team2Score);

        const year = new Date(g.start_time_utc).getFullYear();
        if (!yearlyGames[year]) {
          yearlyGames[year] = { team1Wins: 0, team2Wins: 0, avgTotal: 0, games: 0 };
        }
        if (team1Score > team2Score) yearlyGames[year].team1Wins++;
        else yearlyGames[year].team2Wins++;
        yearlyGames[year].avgTotal += g.final_total || (team1Score + team2Score);
        yearlyGames[year].games++;
      }
    });

    const yearlyData = Object.entries(yearlyGames)
      .map(([year, data]) => ({
        year: parseInt(year),
        team1Wins: data.team1Wins,
        team2Wins: data.team2Wins,
        avgTotal: Math.round((data.avgTotal / data.games) * 10) / 10,
      }))
      .sort((a, b) => a.year - b.year);

    return {
      totalGames: games.length,
      team1Wins,
      team2Wins,
      team1AvgScore: Math.round((team1TotalScore / games.length) * 10) / 10,
      team2AvgScore: Math.round((team2TotalScore / games.length) * 10) / 10,
      avgTotal: Math.round((totalPoints / games.length) * 10) / 10,
      yearlyData,
    };
  }, [games, team1Id, team2Id]);

  const handleSearch = () => {
    if (team1Id && team2Id) {
      setSearched(true);
      refetch();
    }
  };

  // Team avatar placeholder component
  const TeamAvatar = ({ team, size = "md" }: { team: Team | undefined; size?: "sm" | "md" | "lg" }) => {
    const sizeClasses = {
      sm: "w-8 h-8 text-xs",
      md: "w-12 h-12 text-sm",
      lg: "w-16 h-16 text-lg",
    };
    
    return (
      <div className={cn(
        "rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center font-bold text-primary border-2 border-primary/20",
        sizeClasses[size]
      )}>
        {team?.abbrev?.slice(0, 2) || team?.name?.slice(0, 2) || "??"}
      </div>
    );
  };

  return (
    <Layout>
      <Helmet>
        <title>Matchup Finder | Historical Head-to-Head Games</title>
        <meta
          name="description"
          content="Find historical matchups between any two teams. View head-to-head records, scoring trends, and game history across NBA, NFL, MLB, and NHL."
        />
      </Helmet>

      <PageTransition>
        <div className="container mx-auto py-6 px-4 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Matchup Finder</h1>
            <p className="text-muted-foreground">
              Discover historical games between any two teams
            </p>
          </div>

          {/* Search Controls */}
          <Card className="overflow-hidden">
            <CardContent className="pt-6">
              {/* Sport Tabs */}
              <div className="mb-6">
                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                  Sport
                </label>
                <div className="flex gap-2">
                  {(['nba', 'nfl', 'mlb', 'nhl'] as SportId[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSport(s);
                        setTeam1Id('');
                        setTeam2Id('');
                        setSearched(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                        sport === s 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <SportIcon sport={s} className="h-4 w-4" />
                      {SPORT_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team Selection with Swap */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Team 1
                  </label>
                  <div className="flex items-center gap-3">
                    <TeamAvatar team={team1} />
                    <Select value={team1Id} onValueChange={setTeam1Id} disabled={teamsLoading}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select first team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams?.filter((t) => t.id !== team2Id).map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.city} {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <SwapButton 
                  onClick={handleSwapTeams} 
                  disabled={!team1Id || !team2Id}
                  className="mb-1"
                />

                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Team 2
                  </label>
                  <div className="flex items-center gap-3">
                    <TeamAvatar team={team2} />
                    <Select value={team2Id} onValueChange={setTeam2Id} disabled={teamsLoading}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select second team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams?.filter((t) => t.id !== team1Id).map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.city} {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button 
                  onClick={handleSearch} 
                  disabled={!team1Id || !team2Id || gamesLoading}
                  size="lg"
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  Find Matchups
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {searched && gamesLoading && (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-64" />
            </div>
          )}

          {searched && !gamesLoading && games && (
            <>
              {games.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-1">No Games Found</h3>
                    <p className="text-muted-foreground">
                      No historical games found between these teams
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Summary Stats */}
                  {stats && team1 && team2 && (
                    <div className="grid gap-4 md:grid-cols-4">
                      {/* Head-to-Head Record */}
                      <Card className="md:col-span-2 bg-gradient-to-br from-card to-muted/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Head-to-Head Record
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="text-center">
                              <TeamAvatar team={team1} size="lg" />
                              <div className="text-3xl font-bold text-primary mt-2">
                                {stats.team1Wins}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {team1.abbrev || team1.name}
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-2xl text-muted-foreground/50">vs</div>
                              <div className="text-xs text-muted-foreground">
                                {stats.totalGames} games
                              </div>
                            </div>
                            <div className="text-center">
                              <TeamAvatar team={team2} size="lg" />
                              <div className="text-3xl font-bold mt-2">
                                {stats.team2Wins}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {team2.abbrev || team2.name}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Avg Combined Total
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{stats.avgTotal}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            points/game
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Avg Scores
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-primary">{stats.team1AvgScore}</span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="text-lg font-bold">{stats.team2AvgScore}</span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {team1.abbrev || team1.name} vs {team2.abbrev || team2.name}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Yearly Trend Chart */}
                  {stats && stats.yearlyData.length > 1 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Historical Trend</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={stats.yearlyData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="year" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--popover))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                            />
                            <Bar
                              dataKey="team1Wins"
                              name={team1?.abbrev || team1?.name || 'Team 1'}
                              fill="hsl(var(--primary))"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="team2Wins"
                              name={team2?.abbrev || team2?.name || 'Team 2'}
                              fill="hsl(var(--muted-foreground))"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Game List */}
                  <Card>
                    <CardHeader>
                      <CardTitle>All Games ({games.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border">
                        {games.slice(0, 50).map((game) => {
                          const team1IsHome = game.home_team_id === team1Id;
                          const team1Score = team1IsHome ? game.home_score : game.away_score;
                          const team2Score = team1IsHome ? game.away_score : game.home_score;
                          const team1Won = (team1Score ?? 0) > (team2Score ?? 0);

                          return (
                            <Link
                              key={game.id}
                              to={`/game/${game.id}`}
                              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="text-sm text-muted-foreground w-24">
                                  {format(new Date(game.start_time_utc), 'MMM d, yyyy')}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn('font-medium', team1Won && 'text-primary')}>
                                    {team1?.abbrev || team1?.name}
                                  </span>
                                  <span className={cn('font-bold tabular-nums', team1Won && 'text-primary')}>
                                    {team1Score}
                                  </span>
                                  <span className="text-muted-foreground">@</span>
                                  <span className={cn('font-bold tabular-nums', !team1Won && 'text-primary')}>
                                    {team2Score}
                                  </span>
                                  <span className={cn('font-medium', !team1Won && 'text-primary')}>
                                    {team2?.abbrev || team2?.name}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                {game.final_total && (
                                  <Badge variant="outline" className="tabular-nums">
                                    Total: {game.final_total}
                                  </Badge>
                                )}
                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                      {games.length > 50 && (
                        <div className="p-4 text-center text-sm text-muted-foreground border-t">
                          Showing 50 of {games.length} games
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}

          {/* Initial State */}
          {!searched && (
            <Card className="bg-gradient-to-br from-card to-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Search className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">Select Two Teams</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Choose a sport and select two teams above to view their complete head-to-head 
                  history, including wins, losses, and scoring trends.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </PageTransition>
    </Layout>
  );
}
