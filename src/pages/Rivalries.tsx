import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { Flame, Swords, TrendingUp, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

type SportId = 'nba' | 'nfl' | 'mlb' | 'nhl';

const SPORT_CONFIG: Record<SportId, { label: string; color: string }> = {
  nba: { label: 'NBA', color: 'hsl(var(--chart-1))' },
  nfl: { label: 'NFL', color: 'hsl(var(--chart-2))' },
  mlb: { label: 'MLB', color: 'hsl(var(--chart-3))' },
  nhl: { label: 'NHL', color: 'hsl(var(--chart-4))' },
};

interface Rivalry {
  team1_id: string;
  team1_name: string;
  team1_city: string | null;
  team1_abbrev: string | null;
  team2_id: string;
  team2_name: string;
  team2_city: string | null;
  team2_abbrev: string | null;
  total_games: number;
  team1_wins: number;
  team2_wins: number;
  closeness_score: number; // 0-100, higher = more competitive
  avg_margin: number;
  one_score_games: number; // games decided by <= 1 score
}

export default function Rivalries() {
  const [sport, setSport] = useState<SportId>('nba');

  const { data: rivalries, isLoading } = useQuery({
    queryKey: ['rivalries', sport],
    queryFn: async () => {
      // Get matchup stats
      const { data: matchups, error: matchupsError } = await supabase
        .from('matchup_stats')
        .select('team_high_id, team_low_id, n_games, median')
        .eq('sport_id', sport)
        .gte('n_games', 10); // At least 10 games to be considered a rivalry

      if (matchupsError) throw matchupsError;

      // Get teams
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, city, abbrev')
        .eq('sport_id', sport);

      const teamMap = new Map(teams?.map(t => [t.id, t]) || []);

      // Get all matchup games
      const { data: games } = await supabase
        .from('matchup_games')
        .select('team_high_id, team_low_id, total, game_id')
        .eq('sport_id', sport);

      // Get actual game results to compute wins
      const gameIds = [...new Set(games?.map(g => g.game_id) || [])];
      const { data: gameResults } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id, home_score, away_score')
        .in('id', gameIds.slice(0, 1000)); // Limit for performance

      const gameResultMap = new Map(gameResults?.map(g => [g.id, g]) || []);

      // Calculate rivalry scores
      const rivalryList: Rivalry[] = [];

      matchups?.forEach(m => {
        const team1 = teamMap.get(m.team_high_id);
        const team2 = teamMap.get(m.team_low_id);
        if (!team1 || !team2) return;

        // Get games between these teams
        const matchupGames = games?.filter(
          g => (g.team_high_id === m.team_high_id && g.team_low_id === m.team_low_id)
        ) || [];

        let team1Wins = 0;
        let team2Wins = 0;
        let totalMargin = 0;
        let oneScoreGames = 0;

        // Define one score margin by sport
        const oneScoreMargin = sport === 'nba' ? 5 : sport === 'nfl' ? 8 : sport === 'mlb' ? 2 : 2;

        matchupGames.forEach(mg => {
          const result = gameResultMap.get(mg.game_id);
          if (!result) return;

          const homeWon = (result.home_score ?? 0) > (result.away_score ?? 0);
          const margin = Math.abs((result.home_score ?? 0) - (result.away_score ?? 0));

          if (result.home_team_id === m.team_high_id) {
            if (homeWon) team1Wins++;
            else team2Wins++;
          } else {
            if (homeWon) team2Wins++;
            else team1Wins++;
          }

          totalMargin += margin;
          if (margin <= oneScoreMargin) oneScoreGames++;
        });

        const totalGames = team1Wins + team2Wins;
        if (totalGames < 10) return;

        // Calculate closeness score (0-100)
        // Based on: win% balance, average margin, close games %
        const winBalance = 1 - Math.abs(team1Wins - team2Wins) / totalGames;
        const avgMargin = totalMargin / totalGames;
        const closeGamePct = oneScoreGames / totalGames;

        // Weight the factors
        const closenessScore = Math.round(
          (winBalance * 40) + (closeGamePct * 40) + (Math.max(0, 20 - avgMargin) * 1)
        );

        rivalryList.push({
          team1_id: m.team_high_id,
          team1_name: team1.name,
          team1_city: team1.city,
          team1_abbrev: team1.abbrev,
          team2_id: m.team_low_id,
          team2_name: team2.name,
          team2_city: team2.city,
          team2_abbrev: team2.abbrev,
          total_games: totalGames,
          team1_wins: team1Wins,
          team2_wins: team2Wins,
          closeness_score: Math.min(100, Math.max(0, closenessScore)),
          avg_margin: Math.round(avgMargin * 10) / 10,
          one_score_games: oneScoreGames,
        });
      });

      // Sort by closeness score
      rivalryList.sort((a, b) => b.closeness_score - a.closeness_score);

      return rivalryList;
    },
  });

  const getIntensityLabel = (score: number) => {
    if (score >= 70) return { label: 'Intense', color: 'bg-red-500/10 text-red-500' };
    if (score >= 50) return { label: 'Competitive', color: 'bg-orange-500/10 text-orange-500' };
    if (score >= 30) return { label: 'Moderate', color: 'bg-yellow-500/10 text-yellow-500' };
    return { label: 'One-sided', color: 'bg-muted text-muted-foreground' };
  };

  return (
    <Layout>
      <Helmet>
        <title>Rivalries | Competitive Matchups</title>
        <meta
          name="description"
          content="Discover the most competitive rivalries in NBA, NFL, MLB, and NHL. See head-to-head records and rivalry intensity scores."
        />
      </Helmet>

      <div className="container mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Flame className="h-8 w-8 text-orange-500" />
            Rivalry Tracker
          </h1>
          <p className="text-muted-foreground">
            Historically competitive matchups with close records
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
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : !rivalries?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No rivalry data available for {SPORT_CONFIG[sport].label}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top Rivalries */}
            <div className="grid gap-4">
              {rivalries.slice(0, 20).map((rivalry, i) => {
                const intensity = getIntensityLabel(rivalry.closeness_score);
                const isBalanced = Math.abs(rivalry.team1_wins - rivalry.team2_wins) <= 5;

                return (
                  <Card key={`${rivalry.team1_id}-${rivalry.team2_id}`} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:items-center">
                        {/* Rank & Intensity */}
                        <div className="flex items-center gap-4 p-4 md:w-32 bg-muted/30">
                          <span className="text-2xl font-bold text-muted-foreground">
                            #{i + 1}
                          </span>
                          <Badge className={cn("text-xs", intensity.color)}>
                            {intensity.label}
                          </Badge>
                        </div>

                        {/* Matchup */}
                        <div className="flex-1 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1">
                              <Link
                                to={`/team/${rivalry.team1_id}`}
                                className="text-lg font-semibold hover:text-primary transition-colors"
                              >
                                {rivalry.team1_abbrev || rivalry.team1_name}
                              </Link>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-xl font-bold",
                                  rivalry.team1_wins > rivalry.team2_wins ? "text-status-over" : ""
                                )}>
                                  {rivalry.team1_wins}
                                </span>
                                <Swords className="h-5 w-5 text-muted-foreground" />
                                <span className={cn(
                                  "text-xl font-bold",
                                  rivalry.team2_wins > rivalry.team1_wins ? "text-status-over" : ""
                                )}>
                                  {rivalry.team2_wins}
                                </span>
                              </div>
                              <Link
                                to={`/team/${rivalry.team2_id}`}
                                className="text-lg font-semibold hover:text-primary transition-colors"
                              >
                                {rivalry.team2_abbrev || rivalry.team2_name}
                              </Link>
                            </div>

                            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                              <div className="text-center">
                                <div className="font-medium text-foreground">{rivalry.total_games}</div>
                                <div>games</div>
                              </div>
                              <div className="text-center">
                                <div className="font-medium text-foreground">{rivalry.avg_margin}</div>
                                <div>avg margin</div>
                              </div>
                              <div className="text-center">
                                <div className="font-medium text-foreground">{rivalry.one_score_games}</div>
                                <div>close games</div>
                              </div>
                            </div>

                            <Link
                              to={`/matchups?team1=${rivalry.team1_id}&team2=${rivalry.team2_id}`}
                              className="p-2 rounded-full hover:bg-muted transition-colors"
                            >
                              <ArrowRight className="h-5 w-5 text-muted-foreground" />
                            </Link>
                          </div>

                          {/* Mobile stats */}
                          <div className="flex md:hidden items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{rivalry.total_games} games</span>
                            <span>Avg margin: {rivalry.avg_margin}</span>
                            <span>{rivalry.one_score_games} close</span>
                          </div>

                          {/* Closeness bar */}
                          <div className="mt-3">
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  rivalry.closeness_score >= 70 ? "bg-red-500" :
                                  rivalry.closeness_score >= 50 ? "bg-orange-500" :
                                  rivalry.closeness_score >= 30 ? "bg-yellow-500" : "bg-muted-foreground"
                                )}
                                style={{ width: `${rivalry.closeness_score}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                              <span>Rivalry Score: {rivalry.closeness_score}</span>
                              {isBalanced && (
                                <span className="text-primary">Evenly matched</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
