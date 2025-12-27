import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { SegmentSelector, type SegmentKey } from "@/components/game/SegmentSelector";
import { SegmentBadge } from "@/components/game/SegmentBadge";
import { ConfidenceBadge } from "@/components/game/ConfidenceBadge";
import { RecencyIndicator } from "@/components/game/RecencyIndicator";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { HistoricalDistributionChart } from "@/components/game/HistoricalDistributionChart";
import { calculateConfidence } from "@/lib/confidenceScore";
import { cn } from "@/lib/utils";
import { format, differenceInYears } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  Users,
  TrendingUp,
  History,
  Shield,
  ArrowRightLeft,
  Calendar,
  Target,
} from "lucide-react";
import type { SportId } from "@/types";

const SPORTS: SportId[] = ["nfl", "nba", "mlb", "nhl"];

export default function MatchupAnalysis() {
  const [sportId, setSportId] = useState<SportId>("nba");
  const [team1Id, setTeam1Id] = useState<string>("");
  const [team2Id, setTeam2Id] = useState<string>("");
  const [segment, setSegment] = useState<SegmentKey>("h2h_all");

  // Fetch franchises for selection
  const { data: franchises } = useQuery({
    queryKey: ["franchises", sportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchises")
        .select("id, canonical_name")
        .eq("sport_id", sportId)
        .order("canonical_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch matchup history
  const { data: matchupData, isLoading: isLoadingMatchup } = useQuery({
    queryKey: ["matchup-analysis", sportId, team1Id, team2Id, segment],
    queryFn: async () => {
      if (!team1Id || !team2Id) return null;

      // Sort IDs for consistent lookup
      const [lowId, highId] = [team1Id, team2Id].sort();

      // Get matchup stats
      const { data: stats, error: statsError } = await supabase
        .from("matchup_stats")
        .select("*")
        .eq("franchise_low_id", lowId)
        .eq("franchise_high_id", highId)
        .eq("segment_key", segment)
        .maybeSingle();

      if (statsError) throw statsError;

      // Get matchup games history
      const { data: games, error: gamesError } = await supabase
        .from("matchup_games")
        .select("*, game_id")
        .eq("franchise_low_id", lowId)
        .eq("franchise_high_id", highId)
        .order("played_at_utc", { ascending: false })
        .limit(50);

      if (gamesError) throw gamesError;

      return { stats, games };
    },
    enabled: !!team1Id && !!team2Id,
  });

  // Fetch roster continuity for both teams
  const { data: rosterData } = useQuery({
    queryKey: ["roster-continuity", team1Id, team2Id],
    queryFn: async () => {
      if (!team1Id || !team2Id) return null;

      // Get latest roster snapshots for both franchises
      const { data, error } = await supabase
        .from("roster_snapshots")
        .select("team_id, continuity_score, season_year, era_tag")
        .in("team_id", [team1Id, team2Id])
        .order("season_year", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Get latest continuity for each team
      const team1Roster = data?.find((r) => r.team_id === team1Id);
      const team2Roster = data?.find((r) => r.team_id === team2Id);

      return {
        team1Continuity: team1Roster?.continuity_score ?? null,
        team2Continuity: team2Roster?.continuity_score ?? null,
        team1Era: team1Roster?.era_tag ?? null,
        team2Era: team2Roster?.era_tag ?? null,
      };
    },
    enabled: !!team1Id && !!team2Id,
  });

  // Compute recency breakdown
  const recencyBreakdown = useMemo(() => {
    if (!matchupData?.games) return null;

    const now = new Date();
    let within1y = 0;
    let within3y = 0;
    let within5y = 0;

    matchupData.games.forEach((game) => {
      const years = differenceInYears(now, new Date(game.played_at_utc));
      if (years <= 1) within1y++;
      if (years <= 3) within3y++;
      if (years <= 5) within5y++;
    });

    return {
      within1y,
      within3y,
      within5y,
      total: matchupData.games.length,
    };
  }, [matchupData?.games]);

  // Compute confidence score
  const confidence = useMemo(() => {
    if (!matchupData?.stats) return null;

    return calculateConfidence({
      nGames: matchupData.stats.n_games,
      segment,
      homeContinuity: rosterData?.team1Continuity,
      awayContinuity: rosterData?.team2Continuity,
      recencyData: recencyBreakdown ?? undefined,
    });
  }, [matchupData?.stats, segment, rosterData, recencyBreakdown]);

  const team1Name =
    franchises?.find((f) => f.id === team1Id)?.canonical_name || "Team 1";
  const team2Name =
    franchises?.find((f) => f.id === team2Id)?.canonical_name || "Team 2";

  const hasData = matchupData?.stats && matchupData.stats.n_games > 0;

  return (
    <>
      <Helmet>
        <title>Matchup Analysis | Game Percentiles</title>
        <meta
          name="description"
          content="Comprehensive matchup analysis combining percentile data, roster continuity, and segment selection."
        />
      </Helmet>

      <Layout>
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in px-4 py-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Matchup Analysis</h1>
            <p className="text-muted-foreground">
              Comprehensive breakdown of historical data, roster continuity, and
              prediction confidence
            </p>
          </div>

          {/* Selection Controls */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Select Matchup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Sport */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Sport
                  </label>
                  <Select
                    value={sportId}
                    onValueChange={(v) => {
                      setSportId(v as SportId);
                      setTeam1Id("");
                      setTeam2Id("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPORTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Team 1 */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Team 1
                  </label>
                  <Select value={team1Id} onValueChange={setTeam1Id}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {franchises
                        ?.filter((f) => f.id !== team2Id)
                        .map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.canonical_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Team 2 */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Team 2
                  </label>
                  <Select value={team2Id} onValueChange={setTeam2Id}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {franchises
                        ?.filter((f) => f.id !== team1Id)
                        .map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.canonical_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Segment */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Segment
                  </label>
                  <SegmentSelector
                    value={segment}
                    onChange={setSegment}
                    disabled={!team1Id || !team2Id}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {team1Id && team2Id && (
            <>
              {isLoadingMatchup ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Loading matchup data...
                  </CardContent>
                </Card>
              ) : hasData ? (
                <>
                  {/* Confidence Overview */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* Confidence Score Card */}
                    <Card className="md:col-span-1">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Confidence Score
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-4">
                          <div
                            className={cn(
                              "text-5xl font-bold",
                              confidence?.color
                            )}
                          >
                            {confidence?.score ?? 0}
                          </div>
                          <div
                            className={cn(
                              "text-lg font-medium mt-1",
                              confidence?.color
                            )}
                          >
                            {confidence?.label}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Based on sample size, recency & roster continuity
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Factor Breakdown */}
                    <Card className="md:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Factor Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 py-2">
                          <FactorCard
                            icon={BarChart3}
                            label="Sample Size"
                            value={confidence?.factors.sampleSize ?? 0}
                            detail={`${matchupData?.stats?.n_games ?? 0} games`}
                          />
                          <FactorCard
                            icon={TrendingUp}
                            label="Recency"
                            value={confidence?.factors.recencyScore ?? 0}
                            detail={
                              recencyBreakdown
                                ? `${recencyBreakdown.within3y}/${recencyBreakdown.total} in 3y`
                                : undefined
                            }
                          />
                          <FactorCard
                            icon={Users}
                            label="Roster Continuity"
                            value={confidence?.factors.rosterContinuity ?? 0}
                            detail={
                              rosterData?.team1Era || rosterData?.team2Era
                                ? `${rosterData.team1Era || "?"} / ${rosterData.team2Era || "?"}`
                                : undefined
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Percentile Stats */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Percentile Bounds
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <SegmentBadge
                            segment={segment}
                            nUsed={matchupData?.stats?.n_games}
                          />
                          <RecencyIndicator segment={segment} size="md" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-5 gap-3">
                        <StatBox
                          label="Min"
                          value={matchupData?.stats?.min_total}
                        />
                        <StatBox
                          label="P05"
                          value={matchupData?.stats?.p05}
                          highlight
                        />
                        <StatBox
                          label="Median"
                          value={matchupData?.stats?.median}
                        />
                        <StatBox
                          label="P95"
                          value={matchupData?.stats?.p95}
                          highlight
                        />
                        <StatBox
                          label="Max"
                          value={matchupData?.stats?.max_total}
                        />
                      </div>

                      {/* Percentile Bar */}
                      {matchupData?.stats?.p05 && matchupData?.stats?.p95 && (
                        <PercentileBar
                          p05={matchupData.stats.p05}
                          p95={matchupData.stats.p95}
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* Distribution Chart */}
                  {matchupData?.games && matchupData.games.length >= 3 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Score Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <HistoricalDistributionChart
                          totals={matchupData.games.map((g) => g.total)}
                          p05={matchupData.stats?.p05 ?? null}
                          p95={matchupData.stats?.p95 ?? null}
                          median={matchupData.stats?.median ?? null}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Game History */}
                  {matchupData?.games && matchupData.games.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <History className="h-4 w-4" />
                          Historical Games
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {matchupData.games.map((game, idx) => {
                            const years = differenceInYears(
                              new Date(),
                              new Date(game.played_at_utc)
                            );
                            return (
                              <div
                                key={game.id || idx}
                                className={cn(
                                  "flex items-center justify-between py-2.5 px-3 rounded-lg",
                                  years <= 3
                                    ? "bg-status-live/5"
                                    : "bg-secondary/30"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">
                                    {format(
                                      new Date(game.played_at_utc),
                                      "MMM d, yyyy"
                                    )}
                                  </span>
                                  {years <= 1 && (
                                    <span className="text-2xs px-1.5 py-0.5 rounded bg-status-live/10 text-status-live">
                                      Recent
                                    </span>
                                  )}
                                </div>
                                <span className="text-lg font-bold tabular-nums">
                                  {game.total.toFixed(0)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="text-muted-foreground">
                      No historical data found for {team1Name} vs {team2Name}
                      <br />
                      <span className="text-sm">
                        Try a different segment or team combination
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!team1Id || !team2Id ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select two teams above to see matchup analysis
              </CardContent>
            </Card>
          ) : null}
        </div>
      </Layout>
    </>
  );
}

function FactorCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Shield;
  label: string;
  value: number;
  detail?: string;
}) {
  let color = "text-muted-foreground";
  if (value >= 70) color = "text-status-live";
  else if (value >= 45) color = "text-yellow-500";
  else if (value < 30) color = "text-status-over";

  return (
    <div className="text-center p-3 rounded-lg bg-secondary/30">
      <Icon className={cn("h-5 w-5 mx-auto mb-1", color)} />
      <div className={cn("text-2xl font-bold", color)}>{value}%</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {detail && (
        <div className="text-2xs text-muted-foreground mt-1">{detail}</div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-xl text-center",
        highlight
          ? "bg-primary/10 border border-primary/20"
          : "bg-secondary/30"
      )}
    >
      <div className="text-lg font-bold tabular-nums">
        {value?.toFixed(1) ?? "—"}
      </div>
      <div className="text-2xs text-muted-foreground">{label}</div>
    </div>
  );
}
