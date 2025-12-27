import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { Flame, Snowflake, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

type SportId = 'nba' | 'nfl' | 'mlb' | 'nhl';

const SPORT_CONFIG: Record<SportId, { label: string }> = {
  nba: { label: 'NBA' },
  nfl: { label: 'NFL' },
  mlb: { label: 'MLB' },
  nhl: { label: 'NHL' },
};

interface TeamStreak {
  team_id: string;
  team_name: string;
  team_city: string | null;
  team_abbrev: string | null;
  streak_type: 'win' | 'loss';
  streak_count: number;
  last_game_date: string;
  recent_games: { won: boolean; date: string; opponent: string }[];
}

export default function Streaks() {
  const [sport, setSport] = useState<SportId>('nba');

  const { data: streaks, isLoading } = useQuery({
    queryKey: ['streaks', sport],
    queryFn: async () => {
      // Get teams
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, city, abbrev')
        .eq('sport_id', sport);

      const teamMap = new Map(teams?.map(t => [t.id, t]) || []);

      // Get recent games
      const { data: games } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id, home_score, away_score, start_time_utc')
        .eq('sport_id', sport)
        .eq('status', 'final')
        .order('start_time_utc', { ascending: false })
        .limit(500);

      // Calculate streaks per team
      const teamGames = new Map<string, { won: boolean; date: string; opponentId: string }[]>();

      games?.forEach(g => {
        const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
        
        // Home team
        if (!teamGames.has(g.home_team_id)) teamGames.set(g.home_team_id, []);
        teamGames.get(g.home_team_id)!.push({
          won: homeWon,
          date: g.start_time_utc,
          opponentId: g.away_team_id,
        });

        // Away team
        if (!teamGames.has(g.away_team_id)) teamGames.set(g.away_team_id, []);
        teamGames.get(g.away_team_id)!.push({
          won: !homeWon,
          date: g.start_time_utc,
          opponentId: g.home_team_id,
        });
      });

      const streakList: TeamStreak[] = [];

      teamGames.forEach((gamesList, teamId) => {
        const team = teamMap.get(teamId);
        if (!team || gamesList.length < 3) return;

        // Sort by date descending
        gamesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Calculate current streak
        let streakCount = 1;
        const firstResult = gamesList[0].won;
        
        for (let i = 1; i < gamesList.length; i++) {
          if (gamesList[i].won === firstResult) {
            streakCount++;
          } else {
            break;
          }
        }

        // Only include teams with streak of 3+
        if (streakCount >= 3) {
          streakList.push({
            team_id: teamId,
            team_name: team.name,
            team_city: team.city,
            team_abbrev: team.abbrev,
            streak_type: firstResult ? 'win' : 'loss',
            streak_count: streakCount,
            last_game_date: gamesList[0].date,
            recent_games: gamesList.slice(0, 10).map(g => ({
              won: g.won,
              date: g.date,
              opponent: teamMap.get(g.opponentId)?.abbrev || teamMap.get(g.opponentId)?.name || 'Unknown',
            })),
          });
        }
      });

      // Sort by streak length
      const winStreaks = streakList
        .filter(s => s.streak_type === 'win')
        .sort((a, b) => b.streak_count - a.streak_count);

      const lossStreaks = streakList
        .filter(s => s.streak_type === 'loss')
        .sort((a, b) => b.streak_count - a.streak_count);

      return { winStreaks, lossStreaks };
    },
  });

  return (
    <Layout>
      <Helmet>
        <title>Team Streaks | Winning & Losing Streaks</title>
        <meta
          name="description"
          content="Track current winning and losing streaks for NBA, NFL, MLB, and NHL teams. See which teams are hot and which are struggling."
        />
      </Helmet>

      <div className="container mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Flame className="h-8 w-8 text-orange-500" />
            Team Streaks
          </h1>
          <p className="text-muted-foreground">
            Current winning and losing streaks (3+ games)
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
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Winning Streaks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <TrendingUp className="h-5 w-5 text-status-over" />
                  Hot Streaks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!streaks?.winStreaks.length ? (
                  <p className="text-muted-foreground text-center py-8">
                    No winning streaks of 3+ games
                  </p>
                ) : (
                  streaks.winStreaks.map((team, i) => (
                    <Link
                      key={team.team_id}
                      to={`/team/${team.team_id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-status-over/5 border border-status-over/20 hover:bg-status-over/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-status-over w-8">
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-medium">
                            {team.team_city} {team.team_name}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {team.recent_games.slice(0, 8).map((g, j) => (
                              <div
                                key={j}
                                className={cn(
                                  "w-5 h-5 rounded text-xs flex items-center justify-center font-medium",
                                  g.won ? "bg-status-over text-white" : "bg-status-under text-white"
                                )}
                              >
                                {g.won ? 'W' : 'L'}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-status-over text-white text-lg px-3">
                          {team.streak_count}W
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          streak
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Losing Streaks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Snowflake className="h-5 w-5 text-blue-500" />
                  <TrendingDown className="h-5 w-5 text-status-under" />
                  Cold Streaks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!streaks?.lossStreaks.length ? (
                  <p className="text-muted-foreground text-center py-8">
                    No losing streaks of 3+ games
                  </p>
                ) : (
                  streaks.lossStreaks.map((team, i) => (
                    <Link
                      key={team.team_id}
                      to={`/team/${team.team_id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-status-under/5 border border-status-under/20 hover:bg-status-under/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-status-under w-8">
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-medium">
                            {team.team_city} {team.team_name}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {team.recent_games.slice(0, 8).map((g, j) => (
                              <div
                                key={j}
                                className={cn(
                                  "w-5 h-5 rounded text-xs flex items-center justify-center font-medium",
                                  g.won ? "bg-status-over text-white" : "bg-status-under text-white"
                                )}
                              >
                                {g.won ? 'W' : 'L'}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-status-under text-white text-lg px-3">
                          {team.streak_count}L
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          streak
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
