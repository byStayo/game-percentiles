import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Search, Users, Calendar, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SportId } from "@/types";

interface TeamSeason {
  id: string;
  team_id: string;
  team_name: string;
  team_abbrev: string | null;
  sport_id: SportId;
  season_year: number;
  wins: number;
  losses: number;
  ppg_avg: number;
  opp_ppg_avg: number;
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

export default function TeamSeasons() {
  const [sportFilter, setSportFilter] = useState<SportId | 'all'>('nba');
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'wins' | 'winPct' | 'ppg' | 'diff'>('wins');

  const { data: teamSeasons, isLoading } = useQuery({
    queryKey: ['team-seasons'],
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
          teams!inner(name, abbrev)
        `)
        .order('season_year', { ascending: false })
        .order('wins', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        team_id: row.team_id,
        team_name: row.teams.name,
        team_abbrev: row.teams.abbrev,
        sport_id: row.sport_id as SportId,
        season_year: row.season_year,
        wins: row.wins,
        losses: row.losses,
        ppg_avg: row.ppg_avg,
        opp_ppg_avg: row.opp_ppg_avg,
      })) as TeamSeason[];
    },
    staleTime: 60000,
  });

  // Get unique years
  const availableYears = useMemo(() => {
    if (!teamSeasons) return [];
    const years = [...new Set(teamSeasons.map(ts => ts.season_year))];
    return years.sort((a, b) => b - a);
  }, [teamSeasons]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    if (!teamSeasons) return [];

    let filtered = teamSeasons;

    // Sport filter
    if (sportFilter !== 'all') {
      filtered = filtered.filter(ts => ts.sport_id === sportFilter);
    }

    // Year filter
    if (yearFilter !== 'all') {
      filtered = filtered.filter(ts => ts.season_year === yearFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ts => 
        ts.team_name.toLowerCase().includes(query) ||
        (ts.team_abbrev && ts.team_abbrev.toLowerCase().includes(query))
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      const aWinPct = a.wins / (a.wins + a.losses || 1);
      const bWinPct = b.wins / (b.wins + b.losses || 1);
      const aDiff = a.ppg_avg - a.opp_ppg_avg;
      const bDiff = b.ppg_avg - b.opp_ppg_avg;

      switch (sortBy) {
        case 'wins':
          return b.wins - a.wins;
        case 'winPct':
          return bWinPct - aWinPct;
        case 'ppg':
          return b.ppg_avg - a.ppg_avg;
        case 'diff':
          return bDiff - aDiff;
        default:
          return 0;
      }
    });
  }, [teamSeasons, sportFilter, yearFilter, searchQuery, sortBy]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!filteredData.length) return null;

    const totalWins = filteredData.reduce((sum, ts) => sum + ts.wins, 0);
    const totalLosses = filteredData.reduce((sum, ts) => sum + ts.losses, 0);
    const avgPPG = filteredData.reduce((sum, ts) => sum + ts.ppg_avg, 0) / filteredData.length;
    const topTeam = filteredData[0];

    return {
      totalTeams: filteredData.length,
      totalWins,
      totalLosses,
      avgPPG: avgPPG.toFixed(1),
      topTeam,
    };
  }, [filteredData]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-3">
            Team Seasons
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Historical team performance by season
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          {/* Sport Filter */}
          <div className="flex items-center gap-2 bg-card rounded-xl p-1.5 border border-border/60">
            <Users className="h-4 w-4 text-muted-foreground ml-2" />
            <button
              onClick={() => setSportFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                sportFilter === 'all'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              All
            </button>
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
              value={yearFilter === 'all' ? 'all' : yearFilter.toString()}
              onValueChange={(v) => setYearFilter(v === 'all' ? 'all' : parseInt(v))}
            >
              <SelectTrigger className="w-28 h-8 border-0 bg-transparent">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 bg-card rounded-xl p-1.5 border border-border/60">
            <TrendingUp className="h-4 w-4 text-muted-foreground ml-2" />
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-28 h-8 border-0 bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wins">Wins</SelectItem>
                <SelectItem value="winPct">Win %</SelectItem>
                <SelectItem value="ppg">PPG</SelectItem>
                <SelectItem value="diff">Point Diff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-card rounded-xl p-1.5 border border-border/60">
            <Search className="h-4 w-4 text-muted-foreground ml-2" />
            <Input
              type="text"
              placeholder="Search team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 h-8 border-0 bg-transparent focus-visible:ring-0"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : summaryStats ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-card border-border/60">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Teams</div>
                  <div className="text-2xl font-bold">{summaryStats.totalTeams}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/60">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Games</div>
                  <div className="text-2xl font-bold">
                    {summaryStats.totalWins + summaryStats.totalLosses}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/60">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Avg PPG</div>
                  <div className="text-2xl font-bold">{summaryStats.avgPPG}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/60">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Trophy className="h-3 w-3" /> Top Team
                  </div>
                  <div className="text-lg font-bold truncate">
                    {summaryStats.topTeam?.team_name}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Team List */}
            <Card className="bg-card border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {yearFilter !== 'all' ? `${yearFilter} Season` : 'All Seasons'} 
                  {sportFilter !== 'all' ? ` - ${sportLabels[sportFilter]}` : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-sm text-muted-foreground">
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Team</th>
                        {sportFilter === 'all' && <th className="px-4 py-3 font-medium">Sport</th>}
                        {yearFilter === 'all' && <th className="px-4 py-3 font-medium">Year</th>}
                        <th className="px-4 py-3 font-medium text-right">W</th>
                        <th className="px-4 py-3 font-medium text-right">L</th>
                        <th className="px-4 py-3 font-medium text-right">Win%</th>
                        <th className="px-4 py-3 font-medium text-right">PPG</th>
                        <th className="px-4 py-3 font-medium text-right">Opp PPG</th>
                        <th className="px-4 py-3 font-medium text-right">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.slice(0, 100).map((ts, idx) => {
                        const winPct = ((ts.wins / (ts.wins + ts.losses || 1)) * 100).toFixed(1);
                        const diff = (ts.ppg_avg - ts.opp_ppg_avg).toFixed(1);
                        const isPositive = parseFloat(diff) > 0;

                        return (
                          <tr 
                            key={ts.id} 
                            className="border-b border-border/30 hover:bg-muted/30 transition-colors group"
                          >
                            <td className="px-4 py-3 text-muted-foreground text-sm">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <Link 
                                to={`/team/${ts.team_id}`}
                                className="flex items-center gap-2 hover:text-primary transition-colors"
                              >
                                <div>
                                  <div className="font-medium">{ts.team_name}</div>
                                  {ts.team_abbrev && (
                                    <div className="text-xs text-muted-foreground">{ts.team_abbrev}</div>
                                  )}
                                </div>
                                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                              </Link>
                            </td>
                            {sportFilter === 'all' && (
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-xs font-medium border",
                                  sportColors[ts.sport_id]
                                )}>
                                  {ts.sport_id.toUpperCase()}
                                </span>
                              </td>
                            )}
                            {yearFilter === 'all' && (
                              <td className="px-4 py-3 text-muted-foreground">
                                {ts.season_year}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right font-medium text-status-over">
                              {ts.wins}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-status-under">
                              {ts.losses}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {winPct}%
                            </td>
                            <td className="px-4 py-3 text-right">
                              {ts.ppg_avg?.toFixed(1) || '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {ts.opp_ppg_avg?.toFixed(1) || '-'}
                            </td>
                            <td className={cn(
                              "px-4 py-3 text-right font-medium",
                              isPositive ? "text-status-over" : "text-status-under"
                            )}>
                              {isPositive ? '+' : ''}{diff}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {filteredData.length > 100 && (
                  <div className="px-4 py-3 text-center text-sm text-muted-foreground border-t border-border/60">
                    Showing 100 of {filteredData.length} results
                  </div>
                )}
                
                {filteredData.length === 0 && (
                  <div className="px-4 py-12 text-center text-muted-foreground">
                    No team seasons found matching your filters
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
