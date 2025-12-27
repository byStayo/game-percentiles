import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, Trophy, TrendingUp, TrendingDown, Search, X } from "lucide-react";
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
  Legend,
} from "recharts";

interface Team {
  id: string;
  name: string;
  abbrev: string | null;
  city: string | null;
  sport_id: SportId;
}

interface SeasonStats {
  id: string;
  team_id: string;
  season_year: number;
  wins: number;
  losses: number;
  ppg_avg: number;
  opp_ppg_avg: number;
  playoff_result: string | null;
}

const sportLabels: Record<SportId, string> = {
  nfl: 'NFL',
  nba: 'NBA',
  mlb: 'MLB',
  nhl: 'NHL',
};

const sportColors: Record<SportId, string> = {
  nfl: 'bg-green-500/10 text-green-500 border-green-500/20',
  nba: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  mlb: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  nhl: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
};

function TeamSelector({ 
  selectedTeam, 
  onSelect, 
  teams, 
  searchQuery, 
  onSearchChange,
  otherTeamId,
  label,
  color
}: { 
  selectedTeam: Team | null;
  onSelect: (team: Team | null) => void;
  teams: Team[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  otherTeamId: string | null;
  label: string;
  color: string;
}) {
  const filteredTeams = useMemo(() => {
    if (!searchQuery) return teams.filter(t => t.id !== otherTeamId).slice(0, 10);
    const q = searchQuery.toLowerCase();
    return teams
      .filter(t => t.id !== otherTeamId)
      .filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.abbrev?.toLowerCase().includes(q) ||
        t.city?.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [teams, searchQuery, otherTeamId]);

  if (selectedTeam) {
    return (
      <div className={cn("p-4 rounded-xl border-2", color)}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium opacity-70">{label}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0"
            onClick={() => onSelect(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="font-bold text-lg">{selectedTeam.city} {selectedTeam.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-medium border",
            sportColors[selectedTeam.sport_id]
          )}>
            {sportLabels[selectedTeam.sport_id]}
          </span>
          {selectedTeam.abbrev && (
            <span className="text-sm text-muted-foreground">{selectedTeam.abbrev}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-card rounded-xl p-2 border border-border/60">
        <Search className="h-4 w-4 text-muted-foreground ml-2" />
        <Input
          type="text"
          placeholder={`Search ${label.toLowerCase()}...`}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-0 bg-transparent focus-visible:ring-0"
        />
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {filteredTeams.map(team => (
          <button
            key={team.id}
            onClick={() => onSelect(team)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{team.city} {team.name}</div>
              <div className="text-xs text-muted-foreground">{team.abbrev}</div>
            </div>
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-medium border",
              sportColors[team.sport_id]
            )}>
              {team.sport_id.toUpperCase()}
            </span>
          </button>
        ))}
        {filteredTeams.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No teams found
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamCompare() {
  const [team1, setTeam1] = useState<Team | null>(null);
  const [team2, setTeam2] = useState<Team | null>(null);
  const [search1, setSearch1] = useState('');
  const [search2, setSearch2] = useState('');

  const { data: allTeams, isLoading: teamsLoading } = useQuery({
    queryKey: ['all-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, abbrev, city, sport_id')
        .order('name');
      if (error) throw error;
      return (data || []) as Team[];
    },
  });

  const { data: team1Seasons } = useQuery({
    queryKey: ['team-seasons', team1?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_seasons')
        .select('id, team_id, season_year, wins, losses, ppg_avg, opp_ppg_avg, playoff_result')
        .eq('team_id', team1!.id)
        .order('season_year', { ascending: true });
      if (error) throw error;
      return (data || []) as SeasonStats[];
    },
    enabled: !!team1?.id,
  });

  const { data: team2Seasons } = useQuery({
    queryKey: ['team-seasons', team2?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_seasons')
        .select('id, team_id, season_year, wins, losses, ppg_avg, opp_ppg_avg, playoff_result')
        .eq('team_id', team2!.id)
        .order('season_year', { ascending: true });
      if (error) throw error;
      return (data || []) as SeasonStats[];
    },
    enabled: !!team2?.id,
  });

  // Comparison stats
  const comparisonStats = useMemo(() => {
    if (!team1Seasons?.length || !team2Seasons?.length) return null;

    const calc = (seasons: SeasonStats[]) => {
      const totalWins = seasons.reduce((s, x) => s + (x.wins || 0), 0);
      const totalLosses = seasons.reduce((s, x) => s + (x.losses || 0), 0);
      const avgPPG = seasons.reduce((s, x) => s + (x.ppg_avg || 0), 0) / seasons.length;
      const avgOppPPG = seasons.reduce((s, x) => s + (x.opp_ppg_avg || 0), 0) / seasons.length;
      const playoffAppearances = seasons.filter(s => s.playoff_result).length;
      return {
        seasons: seasons.length,
        wins: totalWins,
        losses: totalLosses,
        winPct: (totalWins / (totalWins + totalLosses || 1)) * 100,
        avgPPG,
        avgOppPPG,
        diff: avgPPG - avgOppPPG,
        playoffAppearances,
      };
    };

    return {
      team1: calc(team1Seasons),
      team2: calc(team2Seasons),
    };
  }, [team1Seasons, team2Seasons]);

  // Chart data - merge by year
  const chartData = useMemo(() => {
    if (!team1Seasons?.length || !team2Seasons?.length) return [];
    
    const allYears = new Set([
      ...team1Seasons.map(s => s.season_year),
      ...team2Seasons.map(s => s.season_year),
    ]);

    return [...allYears].sort().map(year => {
      const t1 = team1Seasons.find(s => s.season_year === year);
      const t2 = team2Seasons.find(s => s.season_year === year);
      return {
        year,
        team1Wins: t1?.wins ?? null,
        team2Wins: t2?.wins ?? null,
        team1PPG: t1?.ppg_avg ?? null,
        team2PPG: t2?.ppg_avg ?? null,
        team1WinPct: t1 ? (t1.wins / (t1.wins + t1.losses || 1)) * 100 : null,
        team2WinPct: t2 ? (t2.wins / (t2.wins + t2.losses || 1)) * 100 : null,
      };
    });
  }, [team1Seasons, team2Seasons]);

  const bothSelected = team1 && team2;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-3">
            Team Comparison
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Compare historical performance between two teams
          </p>
        </div>

        {teamsLoading ? (
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Team Selectors */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card className="bg-card border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-primary">Team 1</CardTitle>
                </CardHeader>
                <CardContent>
                  <TeamSelector
                    selectedTeam={team1}
                    onSelect={setTeam1}
                    teams={allTeams || []}
                    searchQuery={search1}
                    onSearchChange={setSearch1}
                    otherTeamId={team2?.id || null}
                    label="Team 1"
                    color="border-primary/50 bg-primary/5"
                  />
                </CardContent>
              </Card>

              <Card className="bg-card border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-accent-foreground">Team 2</CardTitle>
                </CardHeader>
                <CardContent>
                  <TeamSelector
                    selectedTeam={team2}
                    onSelect={setTeam2}
                    teams={allTeams || []}
                    searchQuery={search2}
                    onSearchChange={setSearch2}
                    otherTeamId={team1?.id || null}
                    label="Team 2"
                    color="border-muted-foreground/50 bg-muted/20"
                  />
                </CardContent>
              </Card>
            </div>

            {bothSelected && comparisonStats && (
              <>
                {/* Stats Comparison */}
                <Card className="bg-card border-border/60 mb-8">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Head-to-Head Stats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { label: 'Seasons', v1: comparisonStats.team1.seasons, v2: comparisonStats.team2.seasons },
                        { label: 'Total Wins', v1: comparisonStats.team1.wins, v2: comparisonStats.team2.wins },
                        { label: 'Win %', v1: `${comparisonStats.team1.winPct.toFixed(1)}%`, v2: `${comparisonStats.team2.winPct.toFixed(1)}%`, compare: [comparisonStats.team1.winPct, comparisonStats.team2.winPct] },
                        { label: 'Avg PPG', v1: comparisonStats.team1.avgPPG.toFixed(1), v2: comparisonStats.team2.avgPPG.toFixed(1), compare: [comparisonStats.team1.avgPPG, comparisonStats.team2.avgPPG] },
                        { label: 'Point Diff', v1: comparisonStats.team1.diff.toFixed(1), v2: comparisonStats.team2.diff.toFixed(1), compare: [comparisonStats.team1.diff, comparisonStats.team2.diff] },
                        { label: 'Playoff Appearances', v1: comparisonStats.team1.playoffAppearances, v2: comparisonStats.team2.playoffAppearances, compare: [comparisonStats.team1.playoffAppearances, comparisonStats.team2.playoffAppearances] },
                      ].map((row, idx) => {
                        const t1Better = row.compare ? row.compare[0] > row.compare[1] : false;
                        const t2Better = row.compare ? row.compare[1] > row.compare[0] : false;
                        
                        return (
                          <div key={idx} className="grid grid-cols-3 items-center gap-4 py-2 border-b border-border/30 last:border-0">
                            <div className={cn(
                              "text-right font-medium",
                              t1Better && "text-status-over"
                            )}>
                              {row.v1}
                              {t1Better && <TrendingUp className="inline h-4 w-4 ml-1" />}
                            </div>
                            <div className="text-center text-sm text-muted-foreground">
                              {row.label}
                            </div>
                            <div className={cn(
                              "text-left font-medium",
                              t2Better && "text-status-over"
                            )}>
                              {t2Better && <TrendingUp className="inline h-4 w-4 mr-1" />}
                              {row.v2}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/60">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground mb-1">Team 1</div>
                        <div className="font-bold text-primary">{team1.abbrev || team1.name}</div>
                      </div>
                      <div className="text-center text-muted-foreground">vs</div>
                      <div className="text-left">
                        <div className="text-xs text-muted-foreground mb-1">Team 2</div>
                        <div className="font-bold">{team2.abbrev || team2.name}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Charts */}
                {chartData.length > 1 && (
                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <Card className="bg-card border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Win % by Season</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                              <XAxis dataKey="year" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} domain={[0, 100]} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                                formatter={(value: number) => value ? `${value.toFixed(1)}%` : 'N/A'}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="team1WinPct" 
                                name={team1.abbrev || team1.name}
                                stroke="hsl(var(--primary))" 
                                strokeWidth={2} 
                                dot={{ r: 3 }}
                                connectNulls
                              />
                              <Line 
                                type="monotone" 
                                dataKey="team2WinPct" 
                                name={team2.abbrev || team2.name}
                                stroke="hsl(var(--muted-foreground))" 
                                strokeWidth={2} 
                                dot={{ r: 3 }}
                                connectNulls
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">PPG by Season</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                              <XAxis dataKey="year" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                                formatter={(value: number) => value ? value.toFixed(1) : 'N/A'}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="team1PPG" 
                                name={team1.abbrev || team1.name}
                                stroke="hsl(var(--primary))" 
                                strokeWidth={2} 
                                dot={{ r: 3 }}
                                connectNulls
                              />
                              <Line 
                                type="monotone" 
                                dataKey="team2PPG" 
                                name={team2.abbrev || team2.name}
                                stroke="hsl(var(--muted-foreground))" 
                                strokeWidth={2} 
                                dot={{ r: 3 }}
                                connectNulls
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Season by Season Table */}
                <Card className="bg-card border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Season by Season</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/60 text-sm text-muted-foreground">
                            <th className="px-4 py-3 text-left font-medium">Year</th>
                            <th className="px-4 py-3 text-center font-medium" colSpan={3}>
                              {team1.abbrev || team1.name}
                            </th>
                            <th className="px-4 py-3 text-center font-medium" colSpan={3}>
                              {team2.abbrev || team2.name}
                            </th>
                          </tr>
                          <tr className="border-b border-border/60 text-xs text-muted-foreground">
                            <th className="px-4 py-2"></th>
                            <th className="px-2 py-2 text-center">W-L</th>
                            <th className="px-2 py-2 text-center">PPG</th>
                            <th className="px-2 py-2 text-center">Playoffs</th>
                            <th className="px-2 py-2 text-center">W-L</th>
                            <th className="px-2 py-2 text-center">PPG</th>
                            <th className="px-2 py-2 text-center">Playoffs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chartData.slice().reverse().map((row) => {
                            const t1 = team1Seasons?.find(s => s.season_year === row.year);
                            const t2 = team2Seasons?.find(s => s.season_year === row.year);

                            return (
                              <tr key={row.year} className="border-b border-border/30 hover:bg-muted/30">
                                <td className="px-4 py-3 font-medium">{row.year}</td>
                                <td className="px-2 py-3 text-center text-sm">
                                  {t1 ? `${t1.wins}-${t1.losses}` : '-'}
                                </td>
                                <td className="px-2 py-3 text-center text-sm">
                                  {t1?.ppg_avg?.toFixed(1) || '-'}
                                </td>
                                <td className="px-2 py-3 text-center">
                                  {t1?.playoff_result ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-500">
                                      <Trophy className="h-3 w-3" />
                                      {t1.playoff_result}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td className="px-2 py-3 text-center text-sm">
                                  {t2 ? `${t2.wins}-${t2.losses}` : '-'}
                                </td>
                                <td className="px-2 py-3 text-center text-sm">
                                  {t2?.ppg_avg?.toFixed(1) || '-'}
                                </td>
                                <td className="px-2 py-3 text-center">
                                  {t2?.playoff_result ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-500">
                                      <Trophy className="h-3 w-3" />
                                      {t2.playoff_result}
                                    </span>
                                  ) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {!bothSelected && (
              <div className="text-center py-12 text-muted-foreground">
                Select two teams to compare their historical performance
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
