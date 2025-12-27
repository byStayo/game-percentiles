import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface RosterSnapshot {
  id: string;
  team_id: string;
  sport_id: string;
  season_year: number;
  continuity_score: number | null;
  era_tag: string | null;
  key_players: any[] | null;
}

interface TeamInfo {
  id: string;
  name: string;
  abbrev: string | null;
}

const sportLabels: Record<string, string> = {
  nba: 'NBA',
  nfl: 'NFL',
  nhl: 'NHL',
  mlb: 'MLB',
};

// Continuity score thresholds
const CONTINUITY_HIGH = 70; // 70%+ = stable roster
const CONTINUITY_LOW = 40;  // <40% = major turnover

export function RosterContinuityTimeline() {
  const [selectedSport, setSelectedSport] = useState<string>('nba');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Fetch teams for the selected sport
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', selectedSport],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, abbrev')
        .eq('sport_id', selectedSport)
        .order('name');
      
      if (error) throw error;
      return data as TeamInfo[];
    },
  });

  // Fetch roster snapshots
  const { data: snapshots, isLoading: snapshotsLoading } = useQuery({
    queryKey: ['roster-snapshots', selectedSport, selectedTeam],
    queryFn: async () => {
      let query = supabase
        .from('roster_snapshots')
        .select('*')
        .eq('sport_id', selectedSport)
        .order('season_year', { ascending: true });

      if (selectedTeam) {
        query = query.eq('team_id', selectedTeam);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RosterSnapshot[];
    },
  });

  // Group snapshots by team
  const groupedByTeam = useMemo(() => {
    if (!snapshots || !teams) return {};
    
    const grouped: Record<string, { team: TeamInfo; snapshots: RosterSnapshot[] }> = {};
    
    for (const snapshot of snapshots) {
      const team = teams.find(t => t.id === snapshot.team_id);
      if (!team) continue;
      
      if (!grouped[snapshot.team_id]) {
        grouped[snapshot.team_id] = { team, snapshots: [] };
      }
      grouped[snapshot.team_id].snapshots.push(snapshot);
    }
    
    return grouped;
  }, [snapshots, teams]);

  // Find years with major roster changes
  const majorChangeYears = useMemo(() => {
    const changes: { teamId: string; year: number; score: number }[] = [];
    
    for (const teamData of Object.values(groupedByTeam)) {
      for (const snapshot of teamData.snapshots) {
        if (snapshot.continuity_score !== null && snapshot.continuity_score < CONTINUITY_LOW) {
          changes.push({
            teamId: snapshot.team_id,
            year: snapshot.season_year,
            score: snapshot.continuity_score,
          });
        }
      }
    }
    
    return changes;
  }, [groupedByTeam]);

  const isLoading = teamsLoading || snapshotsLoading;

  // Get all years from snapshots
  const allYears = useMemo(() => {
    if (!snapshots?.length) return [];
    const years = [...new Set(snapshots.map(s => s.season_year))].sort();
    return years;
  }, [snapshots]);

  const getContinuityColor = (score: number | null) => {
    if (score === null) return 'bg-muted';
    if (score >= CONTINUITY_HIGH) return 'bg-status-live';
    if (score >= CONTINUITY_LOW) return 'bg-amber-500';
    return 'bg-destructive';
  };

  const getContinuityIcon = (score: number | null) => {
    if (score === null) return null;
    if (score >= CONTINUITY_HIGH) return <TrendingUp className="h-3 w-3" />;
    if (score >= CONTINUITY_LOW) return null;
    return <TrendingDown className="h-3 w-3" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Roster Continuity Timeline
            </CardTitle>
            <CardDescription>
              Track how team composition changes over seasons. Low continuity may affect historical data relevance.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sportLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTeam || 'all'} onValueChange={(v) => setSelectedTeam(v === 'all' ? null : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams?.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.abbrev || team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : Object.keys(groupedByTeam).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No roster data available for {sportLabels[selectedSport]}.</p>
            <p className="text-sm">Run the roster backfill to populate this data.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-status-live" />
                <span>High Continuity (70%+)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Moderate (40-70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-destructive" />
                <span>Major Turnover (&lt;40%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-muted" />
                <span>No Data</span>
              </div>
            </div>

            {/* Major changes alert */}
            {majorChangeYears.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-500">
                      {majorChangeYears.length} major roster turnover{majorChangeYears.length > 1 ? 's' : ''} detected
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Historical data from before these changes may be less predictive for current matchups.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline header */}
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Year labels */}
                <div className="flex items-center mb-2 pl-24">
                  {allYears.map((year) => (
                    <div key={year} className="flex-1 text-center text-xs text-muted-foreground min-w-[40px]">
                      {year.toString().slice(-2)}
                    </div>
                  ))}
                </div>

                {/* Team rows */}
                <div className="space-y-1">
                  <TooltipProvider>
                    {Object.entries(groupedByTeam)
                      .sort((a, b) => a[1].team.name.localeCompare(b[1].team.name))
                      .map(([teamId, { team, snapshots }]) => (
                        <div key={teamId} className="flex items-center gap-2">
                          <div className="w-20 text-xs font-medium truncate" title={team.name}>
                            {team.abbrev || team.name.slice(0, 6)}
                          </div>
                          <div className="flex flex-1 gap-0.5">
                            {allYears.map((year) => {
                              const snapshot = snapshots.find(s => s.season_year === year);
                              const score = snapshot?.continuity_score;
                              const hasData = score !== null && score !== undefined;
                              
                              return (
                                <Tooltip key={year}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "flex-1 min-w-[40px] h-6 rounded-sm flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80",
                                        getContinuityColor(score ?? null)
                                      )}
                                    >
                                      {hasData && score < CONTINUITY_LOW && (
                                        <TrendingDown className="h-3 w-3 text-white" />
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <div className="space-y-1">
                                      <p className="font-medium">{team.name} ({year})</p>
                                      {hasData ? (
                                        <>
                                          <p className="text-sm">
                                            Continuity: <span className="font-medium">{score.toFixed(0)}%</span>
                                          </p>
                                          {score < CONTINUITY_LOW && (
                                            <p className="text-xs text-amber-500">
                                              ⚠️ Major roster turnover - historical data may be less relevant
                                            </p>
                                          )}
                                          {snapshot?.era_tag && (
                                            <Badge variant="outline" className="text-xs">
                                              {snapshot.era_tag}
                                            </Badge>
                                          )}
                                        </>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">No data available</p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {/* Summary stats */}
            {snapshots && snapshots.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-2xl font-bold">{Object.keys(groupedByTeam).length}</p>
                  <p className="text-xs text-muted-foreground">Teams Tracked</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{allYears.length}</p>
                  <p className="text-xs text-muted-foreground">Seasons</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{snapshots.length}</p>
                  <p className="text-xs text-muted-foreground">Data Points</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{majorChangeYears.length}</p>
                  <p className="text-xs text-muted-foreground">Major Turnovers</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
