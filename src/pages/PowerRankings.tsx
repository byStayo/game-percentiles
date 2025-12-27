import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { Trophy, TrendingUp, TrendingDown, Minus, Crown, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

type SportId = 'nba' | 'nfl' | 'mlb' | 'nhl';

const SPORT_CONFIG: Record<SportId, { label: string; color: string }> = {
  nba: { label: 'NBA', color: 'hsl(var(--chart-1))' },
  nfl: { label: 'NFL', color: 'hsl(var(--chart-2))' },
  mlb: { label: 'MLB', color: 'hsl(var(--chart-3))' },
  nhl: { label: 'NHL', color: 'hsl(var(--chart-4))' },
};

interface TeamRanking {
  team_id: string;
  team_name: string;
  team_city: string | null;
  team_abbrev: string | null;
  rank: number;
  power_score: number;
  wins: number;
  losses: number;
  win_pct: number;
  ppg: number;
  opp_ppg: number;
  point_diff: number;
  recent_form: 'hot' | 'cold' | 'neutral';
  playoff_result: string | null;
  season_year: number;
}

export default function PowerRankings() {
  const [sport, setSport] = useState<SportId>('nba');

  const { data: rankings, isLoading } = useQuery({
    queryKey: ['power-rankings', sport],
    queryFn: async () => {
      // Get current season year
      const currentYear = new Date().getFullYear();
      const seasonYear = new Date().getMonth() < 6 ? currentYear : currentYear; // Adjust based on sport

      // Get team seasons for current/recent season
      const { data: seasons, error: seasonsError } = await supabase
        .from('team_seasons')
        .select('team_id, season_year, wins, losses, ppg_avg, opp_ppg_avg, playoff_result')
        .eq('sport_id', sport)
        .gte('season_year', currentYear - 1)
        .order('season_year', { ascending: false });

      if (seasonsError) throw seasonsError;

      // Get teams
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, city, abbrev')
        .eq('sport_id', sport);

      const teamMap = new Map(teams?.map(t => [t.id, t]) || []);

      // Get most recent season per team
      const latestSeasons = new Map<string, typeof seasons[0]>();
      seasons?.forEach(s => {
        if (!latestSeasons.has(s.team_id) || s.season_year > latestSeasons.get(s.team_id)!.season_year) {
          latestSeasons.set(s.team_id, s);
        }
      });

      // Get recent games to calculate form
      const { data: recentGames } = await supabase
        .from('games')
        .select('home_team_id, away_team_id, home_score, away_score, start_time_utc')
        .eq('sport_id', sport)
        .eq('status', 'final')
        .order('start_time_utc', { ascending: false })
        .limit(500);

      // Calculate recent form per team (last 10 games)
      const teamRecentGames = new Map<string, { wins: number; losses: number }>();
      recentGames?.forEach(g => {
        const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
        
        [g.home_team_id, g.away_team_id].forEach(teamId => {
          if (!teamRecentGames.has(teamId)) {
            teamRecentGames.set(teamId, { wins: 0, losses: 0 });
          }
          const record = teamRecentGames.get(teamId)!;
          if (record.wins + record.losses >= 10) return; // Only count last 10
          
          const isHome = teamId === g.home_team_id;
          if ((isHome && homeWon) || (!isHome && !homeWon)) {
            record.wins++;
          } else {
            record.losses++;
          }
        });
      });

      // Calculate power rankings
      const rankingsList: TeamRanking[] = [];

      latestSeasons.forEach((season, teamId) => {
        const team = teamMap.get(teamId);
        if (!team) return;

        const wins = season.wins || 0;
        const losses = season.losses || 0;
        const totalGames = wins + losses;
        if (totalGames < 5) return; // Minimum games

        const winPct = totalGames > 0 ? wins / totalGames : 0;
        const ppg = season.ppg_avg || 0;
        const oppPpg = season.opp_ppg_avg || 0;
        const pointDiff = ppg - oppPpg;

        // Get recent form
        const recent = teamRecentGames.get(teamId);
        let recentForm: 'hot' | 'cold' | 'neutral' = 'neutral';
        if (recent) {
          const recentWinPct = recent.wins / (recent.wins + recent.losses || 1);
          if (recentWinPct >= 0.7) recentForm = 'hot';
          else if (recentWinPct <= 0.3) recentForm = 'cold';
        }

        // Calculate power score (0-100)
        // Weighted: Win% (40%), Point Diff (30%), Recent Form (20%), Playoff success (10%)
        const winPctScore = winPct * 40;
        
        // Normalize point diff based on sport
        const maxDiff = sport === 'nba' ? 15 : sport === 'nfl' ? 15 : sport === 'mlb' ? 2 : 2;
        const diffNormalized = Math.min(Math.max(pointDiff / maxDiff, -1), 1);
        const diffScore = (diffNormalized + 1) / 2 * 30; // 0-30

        const formScore = recentForm === 'hot' ? 20 : recentForm === 'cold' ? 5 : 12.5;

        const playoffScore = season.playoff_result ? 
          (season.playoff_result.toLowerCase().includes('champion') ? 10 :
           season.playoff_result.toLowerCase().includes('finals') || season.playoff_result.toLowerCase().includes('super bowl') || season.playoff_result.toLowerCase().includes('world series') ? 8 :
           season.playoff_result.toLowerCase().includes('conf') ? 5 : 2) : 0;

        const powerScore = Math.round(winPctScore + diffScore + formScore + playoffScore);

        rankingsList.push({
          team_id: teamId,
          team_name: team.name,
          team_city: team.city,
          team_abbrev: team.abbrev,
          rank: 0, // Will be set after sorting
          power_score: Math.min(100, powerScore),
          wins,
          losses,
          win_pct: winPct,
          ppg: Math.round(ppg * 10) / 10,
          opp_ppg: Math.round(oppPpg * 10) / 10,
          point_diff: Math.round(pointDiff * 10) / 10,
          recent_form: recentForm,
          playoff_result: season.playoff_result,
          season_year: season.season_year,
        });
      });

      // Sort by power score and assign ranks
      rankingsList.sort((a, b) => b.power_score - a.power_score);
      rankingsList.forEach((t, i) => { t.rank = i + 1; });

      return rankingsList;
    },
  });

  const getTierLabel = (rank: number, total: number) => {
    const pct = rank / total;
    if (pct <= 0.1) return { label: 'Elite', color: 'bg-amber-500/10 text-amber-500', icon: Crown };
    if (pct <= 0.33) return { label: 'Contender', color: 'bg-primary/10 text-primary', icon: Trophy };
    if (pct <= 0.66) return { label: 'Playoff', color: 'bg-blue-500/10 text-blue-500', icon: Shield };
    return { label: 'Rebuilding', color: 'bg-muted text-muted-foreground', icon: Zap };
  };

  return (
    <Layout>
      <Helmet>
        <title>Power Rankings | Team Performance Analysis</title>
        <meta
          name="description"
          content="Team power rankings based on performance, scoring differentials, and recent form across NBA, NFL, MLB, and NHL."
        />
      </Helmet>

      <div className="container mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-amber-500" />
            Power Rankings
          </h1>
          <p className="text-muted-foreground">
            Team rankings based on performance and scoring differentials
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
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : !rankings?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No ranking data available for {SPORT_CONFIG[sport].label}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {rankings.map((team) => {
                  const tier = getTierLabel(team.rank, rankings.length);
                  const TierIcon = tier.icon;

                  return (
                    <div
                      key={team.team_id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                    >
                      {/* Rank */}
                      <div className="w-12 text-center">
                        <span className={cn(
                          "text-2xl font-bold",
                          team.rank === 1 && "text-amber-500",
                          team.rank === 2 && "text-slate-400",
                          team.rank === 3 && "text-amber-700"
                        )}>
                          {team.rank}
                        </span>
                      </div>

                      {/* Team Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/team/${team.team_id}`}
                            className="font-semibold text-lg hover:text-primary transition-colors truncate"
                          >
                            {team.team_city} {team.team_name}
                          </Link>
                          {team.recent_form === 'hot' && (
                            <Badge className="bg-status-over/10 text-status-over text-xs">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Hot
                            </Badge>
                          )}
                          {team.recent_form === 'cold' && (
                            <Badge className="bg-status-under/10 text-status-under text-xs">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              Cold
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="font-medium">
                            {team.wins}-{team.losses}
                          </span>
                          <span>
                            PPG: {team.ppg}
                          </span>
                          <span className={cn(
                            team.point_diff >= 0 ? "text-status-over" : "text-status-under"
                          )}>
                            {team.point_diff >= 0 ? '+' : ''}{team.point_diff} diff
                          </span>
                          {team.playoff_result && (
                            <Badge variant="outline" className="text-xs">
                              {team.playoff_result}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Tier Badge */}
                      <div className="hidden sm:block">
                        <Badge className={cn("gap-1", tier.color)}>
                          <TierIcon className="h-3 w-3" />
                          {tier.label}
                        </Badge>
                      </div>

                      {/* Power Score */}
                      <div className="w-20 text-right">
                        <div className="text-xl font-bold">{team.power_score}</div>
                        <div className="text-xs text-muted-foreground">PWR</div>
                      </div>

                      {/* Power Bar */}
                      <div className="hidden md:block w-32">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              team.rank <= 3 ? "bg-amber-500" :
                              team.rank <= 10 ? "bg-primary" :
                              "bg-muted-foreground"
                            )}
                            style={{ width: `${team.power_score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">How Power Score is Calculated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span>Win % (40%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <span>Point Differential (30%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <span>Recent Form (20%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Playoff Success (10%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
