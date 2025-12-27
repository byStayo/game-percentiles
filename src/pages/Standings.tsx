import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, ChevronRight, Calendar, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SportId } from "@/types";

interface TeamStanding {
  id: string;
  team_id: string;
  team_name: string;
  team_abbrev: string | null;
  team_city: string | null;
  sport_id: SportId;
  season_year: number;
  wins: number;
  losses: number;
  ppg_avg: number;
  opp_ppg_avg: number;
  conference: string | null;
  division: string | null;
  playoff_result: string | null;
}

const sportLabels: Record<SportId, string> = {
  nfl: 'NFL',
  nba: 'NBA',
  mlb: 'MLB',
  nhl: 'NHL',
};

const sportColors: Record<SportId, { bg: string; text: string }> = {
  nfl: { bg: 'bg-green-500/10', text: 'text-green-500' },
  nba: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
  mlb: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  nhl: { bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
};

function getPlayoffSeed(rank: number, sportId: SportId): { seed: number | null; isPlayoff: boolean } {
  // Playoff spots per sport (per conference for NBA/NHL, per division winner + wildcards for NFL/MLB)
  const playoffSpots: Record<SportId, number> = {
    nba: 6, // Top 6 in each conference auto-qualify
    nhl: 4, // Top 3 in each division + wildcards (roughly top 4 per division)
    nfl: 4, // Division winners + wildcards  
    mlb: 3, // Division winners + wildcards
  };
  
  const spots = playoffSpots[sportId];
  if (rank <= spots) {
    return { seed: rank, isPlayoff: true };
  }
  return { seed: null, isPlayoff: false };
}

function StandingsTable({ teams, sportId }: { teams: TeamStanding[]; sportId: SportId }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/60 text-left text-sm text-muted-foreground">
            <th className="px-3 py-2 font-medium w-8">#</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium text-center">W</th>
            <th className="px-3 py-2 font-medium text-center">L</th>
            <th className="px-3 py-2 font-medium text-center">Pct</th>
            <th className="px-3 py-2 font-medium text-center hidden sm:table-cell">PPG</th>
            <th className="px-3 py-2 font-medium text-center hidden sm:table-cell">Diff</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, idx) => {
            const totalGames = team.wins + team.losses;
            const winPct = totalGames > 0 ? ((team.wins / totalGames) * 100).toFixed(1) : '0.0';
            const diff = (team.ppg_avg || 0) - (team.opp_ppg_avg || 0);
            const { seed, isPlayoff } = getPlayoffSeed(idx + 1, sportId);
            
            return (
              <tr 
                key={team.id} 
                className={cn(
                  "border-b border-border/30 hover:bg-muted/30 transition-colors group",
                  isPlayoff && "bg-primary/5"
                )}
              >
                <td className="px-3 py-2 text-muted-foreground text-sm">
                  {seed ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                      {seed}
                    </span>
                  ) : (
                    idx + 1
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link 
                    to={`/team/${team.team_id}`}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {team.team_city && <span className="hidden sm:inline">{team.team_city}</span>}
                        {team.team_name}
                        {team.playoff_result && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-500/10 text-amber-500">
                            <Trophy className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                  </Link>
                </td>
                <td className="px-3 py-2 text-center font-medium text-status-over">{team.wins}</td>
                <td className="px-3 py-2 text-center font-medium text-status-under">{team.losses}</td>
                <td className="px-3 py-2 text-center font-medium">{winPct}</td>
                <td className="px-3 py-2 text-center hidden sm:table-cell">{team.ppg_avg?.toFixed(1) || '-'}</td>
                <td className={cn(
                  "px-3 py-2 text-center font-medium hidden sm:table-cell",
                  diff >= 0 ? "text-status-over" : "text-status-under"
                )}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Standings() {
  const [sportFilter, setSportFilter] = useState<SportId>('nba');
  const [yearFilter, setYearFilter] = useState<number | 'latest'>('latest');

  const { data: standings, isLoading } = useQuery({
    queryKey: ['standings', sportFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_seasons')
        .select(`
          id,
          team_id,
          sport_id,
          season_year,
          wins,
          losses,
          ppg_avg,
          opp_ppg_avg,
          conference,
          division,
          playoff_result,
          teams!inner(name, abbrev, city)
        `)
        .eq('sport_id', sportFilter)
        .order('season_year', { ascending: false })
        .order('wins', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        team_id: row.team_id,
        team_name: row.teams.name,
        team_abbrev: row.teams.abbrev,
        team_city: row.teams.city,
        sport_id: row.sport_id as SportId,
        season_year: row.season_year,
        wins: row.wins,
        losses: row.losses,
        ppg_avg: row.ppg_avg,
        opp_ppg_avg: row.opp_ppg_avg,
        conference: row.conference,
        division: row.division,
        playoff_result: row.playoff_result,
      })) as TeamStanding[];
    },
    staleTime: 60000,
  });

  // Get available years
  const availableYears = useMemo(() => {
    if (!standings) return [];
    const years = [...new Set(standings.map(s => s.season_year))];
    return years.sort((a, b) => b - a);
  }, [standings]);

  // Get current year
  const currentYear = useMemo(() => {
    if (yearFilter === 'latest' && availableYears.length > 0) {
      return availableYears[0];
    }
    return yearFilter === 'latest' ? new Date().getFullYear() : yearFilter;
  }, [yearFilter, availableYears]);

  // Filter to current year
  const currentSeasonData = useMemo(() => {
    if (!standings) return [];
    return standings.filter(s => s.season_year === currentYear);
  }, [standings, currentYear]);

  // Group by conference and division
  const groupedStandings = useMemo(() => {
    const byConference: Record<string, TeamStanding[]> = {};
    const byDivision: Record<string, Record<string, TeamStanding[]>> = {};

    currentSeasonData.forEach(team => {
      const conf = team.conference || 'Unknown';
      const div = team.division || 'Unknown';

      if (!byConference[conf]) byConference[conf] = [];
      byConference[conf].push(team);

      if (!byDivision[conf]) byDivision[conf] = {};
      if (!byDivision[conf][div]) byDivision[conf][div] = [];
      byDivision[conf][div].push(team);
    });

    // Sort each group by wins
    Object.values(byConference).forEach(teams => teams.sort((a, b) => b.wins - a.wins));
    Object.values(byDivision).forEach(conf => {
      Object.values(conf).forEach(teams => teams.sort((a, b) => b.wins - a.wins));
    });

    return { byConference, byDivision };
  }, [currentSeasonData]);

  const hasDivisions = Object.keys(groupedStandings.byDivision).some(
    conf => Object.keys(groupedStandings.byDivision[conf]).length > 1
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-3">
            Standings
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Current season rankings by division
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          {/* Sport Filter */}
          <div className="flex items-center gap-2 bg-card rounded-xl p-1.5 border border-border/60">
            <Users className="h-4 w-4 text-muted-foreground ml-2" />
            {(['nba', 'nfl', 'nhl', 'mlb'] as SportId[]).map(sport => (
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

          {/* Year Filter */}
          <div className="flex items-center gap-2 bg-card rounded-xl p-1.5 border border-border/60">
            <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
            <Select
              value={yearFilter === 'latest' ? 'latest' : yearFilter.toString()}
              onValueChange={(v) => setYearFilter(v === 'latest' ? 'latest' : parseInt(v))}
            >
              <SelectTrigger className="w-28 h-8 border-0 bg-transparent">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Current Season Badge */}
        <div className="flex justify-center mb-6">
          <span className={cn(
            "px-4 py-2 rounded-full text-sm font-semibold",
            sportColors[sportFilter].bg,
            sportColors[sportFilter].text
          )}>
            {sportLabels[sportFilter]} {currentYear} Season
          </span>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : hasDivisions ? (
          // Show by Division
          <div className="space-y-8">
            {Object.entries(groupedStandings.byDivision).sort().map(([conference, divisions]) => (
              <div key={conference}>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {conference} {sportFilter === 'nba' || sportFilter === 'nhl' ? 'Conference' : ''}
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {Object.entries(divisions).sort().map(([division, teams]) => (
                    <Card key={division} className="bg-card border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{division}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <StandingsTable teams={teams} sportId={sportFilter} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Show by Conference only
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(groupedStandings.byConference).sort().map(([conference, teams]) => (
              <Card key={conference} className="bg-card border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{conference}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <StandingsTable teams={teams} sportId={sportFilter} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {currentSeasonData.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            No standings data available for {sportLabels[sportFilter]} {currentYear}
          </div>
        )}
      </div>
    </Layout>
  );
}
