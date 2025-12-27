import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, Database, TrendingUp, Users, Calendar, Grid3X3 } from "lucide-react";
import type { SportId } from "@/types";
import { cn } from "@/lib/utils";

interface SegmentStats {
  segment_key: string;
  count: number;
  avg_games: number;
  min_games: number;
  max_games: number;
}

interface MatchupCoverage {
  sport_id: string;
  total_matchups: number;
  matchups_with_5plus: number;
  matchups_with_10plus: number;
  matchups_with_20plus: number;
}

interface LowDataMatchup {
  franchise_high_name: string;
  franchise_low_name: string;
  sport_id: string;
  total_games: number;
  last_game: string;
}

export function DataHealthDashboard() {
  // Fetch segment statistics
  const { data: segmentStats, isLoading: segmentLoading } = useQuery({
    queryKey: ["data-health-segments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matchup_stats")
        .select("segment_key, n_games, sport_id")
        .order("segment_key");
      
      if (error) throw error;
      
      // Aggregate by segment_key
      const bySegment: Record<string, { count: number; games: number[]; bySport: Record<string, number> }> = {};
      
      for (const row of data || []) {
        const key = row.segment_key || "h2h_all";
        if (!bySegment[key]) {
          bySegment[key] = { count: 0, games: [], bySport: {} };
        }
        bySegment[key].count++;
        bySegment[key].games.push(row.n_games);
        bySegment[key].bySport[row.sport_id] = (bySegment[key].bySport[row.sport_id] || 0) + 1;
      }

      return Object.entries(bySegment).map(([key, stats]) => ({
        segment_key: key,
        count: stats.count,
        avg_games: stats.games.reduce((a, b) => a + b, 0) / stats.games.length || 0,
        min_games: Math.min(...stats.games),
        max_games: Math.max(...stats.games),
        bySport: stats.bySport,
      }));
    },
    staleTime: 60000,
  });

  // Fetch matchup coverage by sport
  const { data: coverageStats, isLoading: coverageLoading } = useQuery({
    queryKey: ["data-health-coverage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matchup_stats")
        .select("sport_id, n_games")
        .eq("segment_key", "h2h_all");
      
      if (error) throw error;
      
      // Aggregate by sport
      const bySport: Record<string, { total: number; with5: number; with10: number; with20: number }> = {};
      
      for (const row of data || []) {
        if (!bySport[row.sport_id]) {
          bySport[row.sport_id] = { total: 0, with5: 0, with10: 0, with20: 0 };
        }
        bySport[row.sport_id].total++;
        if (row.n_games >= 5) bySport[row.sport_id].with5++;
        if (row.n_games >= 10) bySport[row.sport_id].with10++;
        if (row.n_games >= 20) bySport[row.sport_id].with20++;
      }

      return Object.entries(bySport).map(([sport, stats]) => ({
        sport_id: sport,
        total_matchups: stats.total,
        matchups_with_5plus: stats.with5,
        matchups_with_10plus: stats.with10,
        matchups_with_20plus: stats.with20,
        coverage_5: stats.total > 0 ? (stats.with5 / stats.total) * 100 : 0,
        coverage_10: stats.total > 0 ? (stats.with10 / stats.total) * 100 : 0,
      }));
    },
    staleTime: 60000,
  });

  // Fetch low-data matchups (franchise_matchups view)
  const { data: lowDataMatchups, isLoading: lowDataLoading } = useQuery({
    queryKey: ["data-health-low-matchups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchise_matchups")
        .select("*")
        .lt("total_games", 5)
        .order("total_games", { ascending: true })
        .limit(20);
      
      if (error) throw error;
      return data as LowDataMatchup[];
    },
    staleTime: 60000,
  });

  // Fetch database totals
  const { data: dbStats, isLoading: dbLoading } = useQuery({
    queryKey: ["data-health-db-stats"],
    queryFn: async () => {
      const [games, matchupGames, franchises, teamVersions, seasons] = await Promise.all([
        supabase.from("games").select("id", { count: "exact", head: true }),
        supabase.from("matchup_games").select("id", { count: "exact", head: true }),
        supabase.from("franchises").select("id", { count: "exact", head: true }),
        supabase.from("team_versions").select("id", { count: "exact", head: true }),
        supabase.from("seasons").select("id", { count: "exact", head: true }),
      ]);

      return {
        games: games.count || 0,
        matchup_games: matchupGames.count || 0,
        franchises: franchises.count || 0,
        team_versions: teamVersions.count || 0,
        seasons: seasons.count || 0,
      };
    },
    staleTime: 60000,
  });

  // Fetch roster snapshots for continuity tracking
  const { data: rosterStats, isLoading: rosterLoading } = useQuery({
    queryKey: ["data-health-roster"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roster_snapshots")
        .select("sport_id, continuity_score, era_tag")
        .order("continuity_score", { ascending: true });
      
      if (error) throw error;
      
      // Aggregate by sport
      const bySport: Record<string, { count: number; lowContinuity: number; eras: Set<string> }> = {};
      
      for (const row of data || []) {
        if (!bySport[row.sport_id]) {
          bySport[row.sport_id] = { count: 0, lowContinuity: 0, eras: new Set() };
        }
        bySport[row.sport_id].count++;
        if (row.continuity_score !== null && row.continuity_score < 0.5) {
          bySport[row.sport_id].lowContinuity++;
        }
        if (row.era_tag) {
          bySport[row.sport_id].eras.add(row.era_tag);
        }
      }

      return Object.entries(bySport).map(([sport, stats]) => ({
        sport_id: sport,
        total_snapshots: stats.count,
        low_continuity: stats.lowContinuity,
        era_count: stats.eras.size,
      }));
    },
    staleTime: 60000,
  });

  const isLoading = segmentLoading || coverageLoading || lowDataLoading || dbLoading || rosterLoading;

  const segmentLabels: Record<string, string> = {
    h2h_1y: "1Y",
    h2h_3y: "3Y",
    h2h_5y: "5Y",
    h2h_10y: "10Y",
    h2h_all: "All",
    hybrid_form: "Hybrid",
  };

  const sportLabels: Record<string, string> = {
    nba: "NBA",
    nfl: "NFL",
    nhl: "NHL",
    mlb: "MLB",
  };

  // Build sport × segment coverage matrix
  const segments = ["h2h_1y", "h2h_3y", "h2h_5y", "h2h_10y", "h2h_all"];
  const sports = ["nba", "nfl", "nhl", "mlb"];
  
  const coverageMatrix: Record<string, Record<string, { count: number; avgGames: number }>> = {};
  sports.forEach(s => { coverageMatrix[s] = {}; });
  
  segmentStats?.forEach(seg => {
    if (seg.bySport) {
      Object.entries(seg.bySport).forEach(([sport, count]) => {
        if (!coverageMatrix[sport]) coverageMatrix[sport] = {};
        coverageMatrix[sport][seg.segment_key] = { 
          count: count as number, 
          avgGames: seg.avg_games 
        };
      });
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Data Health Dashboard</CardTitle>
          </div>
          <CardDescription>
            Segment coverage, matchup depth, and roster continuity tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-40" />
            </div>
          ) : (
            <>
              {/* Database Overview */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-secondary/30 text-center">
                  <div className="text-2xl font-bold">{dbStats?.games?.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Games</div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 text-center">
                  <div className="text-2xl font-bold">{dbStats?.matchup_games?.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">H2H Records</div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 text-center">
                  <div className="text-2xl font-bold">{dbStats?.franchises}</div>
                  <div className="text-xs text-muted-foreground">Franchises</div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 text-center">
                  <div className="text-2xl font-bold">{dbStats?.team_versions}</div>
                  <div className="text-xs text-muted-foreground">Team Versions</div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 text-center">
                  <div className="text-2xl font-bold">{dbStats?.seasons}</div>
                  <div className="text-xs text-muted-foreground">Seasons</div>
                </div>
              </div>

              {/* Sport × Segment Coverage Matrix */}
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Sport × Segment Coverage Matrix
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left p-2 border-b border-border font-medium text-muted-foreground">Sport</th>
                        {segments.map(seg => (
                          <th key={seg} className="text-center p-2 border-b border-border font-medium text-muted-foreground">
                            {segmentLabels[seg]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sports.map(sport => (
                        <tr key={sport} className="border-b border-border/50">
                          <td className="p-2 font-semibold uppercase">{sport}</td>
                          {segments.map(seg => {
                            const data = coverageMatrix[sport]?.[seg];
                            const count = data?.count || 0;
                            const hasData = count > 0;
                            const isGood = count >= 50;
                            const isWarning = count > 0 && count < 50;
                            
                            return (
                              <td key={seg} className="p-2 text-center">
                                <div className={cn(
                                  "inline-flex flex-col items-center px-2 py-1 rounded-md text-xs",
                                  !hasData && "bg-destructive/10 text-destructive",
                                  isWarning && "bg-yellow-500/10 text-yellow-600",
                                  isGood && "bg-status-live/10 text-status-live"
                                )}>
                                  <span className="font-bold">{count}</span>
                                  {hasData && (
                                    <span className="text-2xs opacity-70">
                                      ~{data?.avgGames?.toFixed(0) || 0}g
                                    </span>
                                  )}
                                  {!hasData && <span className="text-2xs">gap</span>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-status-live/20" /> 50+ matchups
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-yellow-500/20" /> 1-49 matchups
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-destructive/20" /> Gap (0)
                  </span>
                </div>
              </div>

              {/* Coverage by Sport */}
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Matchup Coverage by Sport (min sample thresholds)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {coverageStats?.map((sport) => (
                    <div
                      key={sport.sport_id}
                      className="p-4 rounded-lg border border-border/60 bg-card"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold uppercase">{sport.sport_id}</span>
                        <Badge variant="outline">{sport.total_matchups} matchups</Badge>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>≥5 games</span>
                            <span className={sport.coverage_5 >= 80 ? "text-status-live" : sport.coverage_5 >= 50 ? "text-yellow-500" : "text-destructive"}>
                              {sport.matchups_with_5plus} ({sport.coverage_5.toFixed(0)}%)
                            </span>
                          </div>
                          <Progress value={sport.coverage_5} className="h-1.5" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>≥10 games</span>
                            <span>{sport.matchups_with_10plus} ({sport.coverage_10.toFixed(0)}%)</span>
                          </div>
                          <Progress value={sport.coverage_10} className="h-1.5" />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ≥20 games: {sport.matchups_with_20plus}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roster Continuity */}
              {rosterStats && rosterStats.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Roster Continuity Tracking
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {rosterStats.map((sport) => (
                      <div
                        key={sport.sport_id}
                        className="p-3 rounded-lg border border-border/60 bg-card"
                      >
                        <div className="font-semibold uppercase text-sm mb-2">{sport.sport_id}</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-lg font-bold">{sport.total_snapshots}</div>
                            <div className="text-muted-foreground">Snapshots</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-status-over">{sport.low_continuity}</div>
                            <div className="text-muted-foreground">Low Continuity</div>
                          </div>
                        </div>
                        {sport.era_count > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {sport.era_count} distinct eras
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Low-Data Matchups */}
              {lowDataMatchups && lowDataMatchups.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-status-over" />
                    Low-Data Matchups (less than 5 games)
                  </h3>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {lowDataMatchups.map((matchup, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg bg-status-over/5 border border-status-over/20"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="uppercase text-2xs">
                              {matchup.sport_id}
                            </Badge>
                            <span className="text-sm">
                              {matchup.franchise_high_name} vs {matchup.franchise_low_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-status-over">{matchup.total_games} games</span>
                            {matchup.last_game && (
                              <span>Last: {new Date(matchup.last_game).getFullYear()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Success message if coverage is good */}
              {coverageStats && coverageStats.every(s => s.coverage_5 >= 80) && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-status-live/10 border border-status-live/30 mt-4">
                  <CheckCircle2 className="h-5 w-5 text-status-live" />
                  <span className="text-sm">
                    Excellent data coverage! 80%+ of matchups have sufficient historical data (≥5 games).
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
