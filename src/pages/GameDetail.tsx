import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Clock, History, BarChart3, Star, Shield } from "lucide-react";
import { GamesPerYearChart } from "@/components/game/GamesPerYearChart";
import { Layout } from "@/components/layout/Layout";
import { useGameDetail } from "@/hooks/useApi";
import { supabase } from "@/integrations/supabase/client";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { PickPill } from "@/components/game/PickPill";
import { WhatIsPPopover } from "@/components/game/WhatIsPPopover";
import { SegmentBadge } from "@/components/game/SegmentBadge";
import { SegmentSelector, type SegmentKey, type SegmentAvailability, getRecommendedSegment } from "@/components/game/SegmentSelector";
import { ConfidenceBadge } from "@/components/game/ConfidenceBadge";
import { RecencyIndicator } from "@/components/game/RecencyIndicator";
import { GameDetailSkeleton } from "@/components/game/GameDetailSkeleton";
import { RosterContinuityCard } from "@/components/game/RosterContinuityCard";
import { SegmentComparison } from "@/components/game/SegmentComparison";
import { SegmentTimeline } from "@/components/game/SegmentTimeline";
import { SegmentAnalysis } from "@/components/game/SegmentAnalysis";
import { EdgeDetectionCard } from "@/components/game/EdgeDetectionCard";
import { ParlayFAB } from "@/components/game/ParlayFAB";
import { Button } from "@/components/ui/button";
import { HistoricalDistributionChart } from "@/components/game/HistoricalDistributionChart";
import { useFavoriteMatchups } from "@/hooks/useFavoriteMatchups";
import { cn } from "@/lib/utils";
import { getTeamDisplayName, formatDateTimeET } from "@/lib/teamNames";
import type { SportId } from "@/types";

const sportColors: Record<SportId, { bg: string; text: string }> = {
  nfl: { bg: "bg-sport-nfl/10", text: "text-sport-nfl" },
  nba: { bg: "bg-sport-nba/10", text: "text-sport-nba" },
  mlb: { bg: "bg-sport-mlb/10", text: "text-sport-mlb" },
  nhl: { bg: "bg-muted", text: "text-muted-foreground" },
};

export default function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const [selectedSegment, setSelectedSegment] = useState<SegmentKey>("h2h_all");
  const { data, isLoading, error } = useGameDetail(id || "", selectedSegment);
  const { isFavorite, toggleFavorite } = useFavoriteMatchups();

  // Fetch roster continuity for both teams
  const { data: rosterData } = useQuery({
    queryKey: ["roster-continuity-game", data?.game?.home_team?.id, data?.game?.away_team?.id],
    queryFn: async () => {
      const homeId = data?.game?.home_team?.id;
      const awayId = data?.game?.away_team?.id;
      if (!homeId || !awayId) return null;

      const { data: rosters, error } = await supabase
        .from("roster_snapshots")
        .select("team_id, continuity_score, season_year, era_tag")
        .in("team_id", [homeId, awayId])
        .order("season_year", { ascending: false })
        .limit(10);

      if (error) throw error;

      const homeRoster = rosters?.find((r) => r.team_id === homeId);
      const awayRoster = rosters?.find((r) => r.team_id === awayId);

      return {
        homeContinuity: homeRoster?.continuity_score ?? null,
        awayContinuity: awayRoster?.continuity_score ?? null,
        homeEra: homeRoster?.era_tag ?? null,
        awayEra: awayRoster?.era_tag ?? null,
      };
    },
    enabled: !!data?.game?.home_team?.id && !!data?.game?.away_team?.id,
  });

  // Fetch segment availability for smart recommendations
  const { data: segmentAvailability } = useQuery({
    queryKey: ["segment-availability", data?.game?.home_team?.id, data?.game?.away_team?.id],
    queryFn: async () => {
      const homeId = data?.game?.home_team?.id;
      const awayId = data?.game?.away_team?.id;
      if (!homeId || !awayId) return [];

      const [lowId, highId] = [homeId, awayId].sort();

      const { data: stats, error } = await supabase
        .from("matchup_stats")
        .select("segment_key, n_games")
        .eq("team_low_id", lowId)
        .eq("team_high_id", highId);

      if (error) throw error;

      return (stats || []).map((s) => ({
        segment: s.segment_key as SegmentKey,
        nGames: s.n_games,
      })) as SegmentAvailability[];
    },
    enabled: !!data?.game?.home_team?.id && !!data?.game?.away_team?.id,
  });

  // Auto-select recommended segment when data loads
  useMemo(() => {
    if (segmentAvailability && segmentAvailability.length > 0 && selectedSegment === "h2h_all") {
      const recommended = getRecommendedSegment(segmentAvailability);
      if (recommended !== selectedSegment) {
        setSelectedSegment(recommended);
      }
    }
  }, [segmentAvailability]);

  if (isLoading) {
    return <GameDetailSkeleton />;
  }

  if (error || !data?.success) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto text-center py-16 px-4">
          <h2 className="text-xl font-semibold mb-2">Game not found</h2>
          <p className="text-muted-foreground mb-6">
            {error instanceof Error
              ? error.message
              : "The requested game could not be found."}
          </p>
          <Button asChild variant="outline">
            <Link to="/">Back to Today</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const { game, edge, stats, history } = data;
  const nH2H = stats?.n_games || edge?.n_h2h || 0;
  const hasEnoughData = nH2H >= 5;

  const homeTeamName = getTeamDisplayName(game.home_team, game.sport_id);
  const awayTeamName = getTeamDisplayName(game.away_team, game.sport_id);

  const isLive = game.status === "live";
  const isFinal = game.status === "final";

  const { time: gameTime, date: gameDate } = formatDateTimeET(
    game.start_time_utc
  );

  const colors = sportColors[game.sport_id];

  const matchupData = {
    gameId: game.id,
    homeTeamAbbrev: game.home_team?.abbrev || "HOME",
    awayTeamAbbrev: game.away_team?.abbrev || "AWAY",
    sportId: game.sport_id,
  };

  const isFav = isFavorite(game.id);

  return (
    <>
      <Helmet>
        <title>{`${awayTeamName} vs ${homeTeamName} | Game Percentiles`}</title>
        <meta
          name="description"
          content={`H2H historical analysis for ${awayTeamName} at ${homeTeamName}. View percentile bounds and DraftKings line analysis.`}
        />
      </Helmet>

      <Layout>
        <div className="max-w-xl mx-auto space-y-6 animate-fade-in px-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>

          {/* Segment Quick Selector */}
          <div className="bg-card rounded-xl border border-border/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Time Window</span>
              <SegmentSelector
                value={selectedSegment}
                onChange={setSelectedSegment}
                disabled={isLoading}
                availability={segmentAvailability}
                showRecommendation={true}
              />
            </div>
            {/* Year-based segments */}
            <div className="flex gap-2 flex-wrap mb-3">
              {(["h2h_1y", "h2h_3y", "h2h_5y", "h2h_10y", "h2h_all"] as const).map((seg) => {
                const avail = segmentAvailability?.find(a => a.segment === seg);
                const nGames = avail?.nGames ?? 0;
                const isActive = selectedSegment === seg;
                const isDisabled = nGames === 0;
                const labels: Record<string, string> = {
                  h2h_1y: "1Y",
                  h2h_3y: "3Y",
                  h2h_5y: "5Y",
                  h2h_10y: "10Y",
                  h2h_all: "All",
                };
                return (
                  <button
                    key={seg}
                    onClick={() => !isDisabled && setSelectedSegment(seg)}
                    disabled={isDisabled}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : isDisabled
                          ? "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                          : "bg-secondary hover:bg-secondary/80 text-foreground",
                      nGames > 0 && nGames < 5 && !isActive && "border border-status-over/30"
                    )}
                  >
                    <span>{labels[seg]}</span>
                    {nGames > 0 && (
                      <span className={cn(
                        "ml-1 text-2xs",
                        isActive ? "opacity-80" : "text-muted-foreground"
                      )}>
                        ({nGames})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Decade segments */}
            <div className="flex gap-2 flex-wrap">
              {(["decade_2020s", "decade_2010s", "decade_2000s", "decade_1990s"] as const).map((seg) => {
                const avail = segmentAvailability?.find(a => a.segment === seg);
                const nGames = avail?.nGames ?? 0;
                const isActive = selectedSegment === seg;
                const isDisabled = nGames === 0;
                const labels: Record<string, string> = {
                  decade_2020s: "2020s",
                  decade_2010s: "2010s",
                  decade_2000s: "2000s",
                  decade_1990s: "1990s",
                };
                return (
                  <button
                    key={seg}
                    onClick={() => !isDisabled && setSelectedSegment(seg)}
                    disabled={isDisabled}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                      isActive 
                        ? "bg-accent text-accent-foreground" 
                        : isDisabled
                          ? "bg-muted/20 text-muted-foreground/40 cursor-not-allowed"
                          : "bg-muted/50 hover:bg-muted text-muted-foreground",
                      nGames > 0 && nGames < 5 && !isActive && "border border-status-over/20"
                    )}
                  >
                    <span>{labels[seg]}</span>
                    {nGames > 0 && (
                      <span className="ml-1 opacity-70">({nGames})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main card - Hero pick first */}
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            {/* Top bar: time/status + league + favorite */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-status-live/10 text-status-live">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-live animate-pulse" />
                    LIVE
                  </span>
                ) : isFinal ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                    Final
                  </span>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{gameDate}</span>
                    <Clock className="h-4 w-4 ml-1" />
                    <span>{gameTime}</span>
                  </div>
                )}
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-md text-2xs font-semibold uppercase",
                    colors.bg,
                    colors.text
                  )}
                >
                  {game.sport_id}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-md text-2xs font-semibold tabular-nums",
                    nH2H >= 5
                      ? "bg-muted text-muted-foreground"
                      : "bg-status-over/10 text-status-over"
                  )}
                >
                  n={nH2H}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 transition-colors",
                    isFav && "text-yellow-500 hover:text-yellow-600"
                  )}
                  onClick={() => toggleFavorite(matchupData)}
                >
                  <Star className={cn("h-4 w-4", isFav && "fill-current")} />
                </Button>
              </div>
            </div>

            {/* Teams section */}
            <div className="px-5 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Away
                  </span>
                  <div className="text-xl font-semibold">{awayTeamName}</div>
                </div>
                {(isFinal || isLive) && game.away_score !== null && (
                  <span className="text-3xl font-bold tabular-nums">
                    {game.away_score}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Home
                  </span>
                  <div className="text-xl font-semibold">{homeTeamName}</div>
                </div>
                {(isFinal || isLive) && game.home_score !== null && (
                  <span className="text-3xl font-bold tabular-nums">
                    {game.home_score}
                  </span>
                )}
              </div>
            </div>

            {/* Hero: PickPill */}
            <div className="flex justify-center py-5 px-5 bg-secondary/30">
              <PickPill
                nH2H={nH2H}
                dkOffered={edge?.dk_offered ?? false}
                dkTotalLine={edge?.dk_total_line ?? null}
                dkLinePercentile={edge?.dk_line_percentile ?? null}
                bestOverEdge={edge?.best_over_edge ?? null}
                bestUnderEdge={edge?.best_under_edge ?? null}
                p95OverLine={edge?.p95_over_line ?? null}
                p05UnderLine={edge?.p05_under_line ?? null}
                p05={edge?.p05 ?? null}
                p95={edge?.p95 ?? null}
                isFinal={isFinal}
                className="text-base px-6 py-3"
              />
            </div>

            {/* PercentileBar */}
            {hasEnoughData && stats?.p05 !== null && stats?.p95 !== null && (
              <div className="px-5 py-4 border-t border-border/40">
                <PercentileBar
                  p05={stats.p05}
                  p95={stats.p95}
                  dkLine={edge?.dk_total_line}
                  dkPercentile={edge?.dk_line_percentile}
                  finalTotal={isFinal ? game.final_total : undefined}
                />
              </div>
            )}

            {/* DK Line Range - Highest Over / Lowest Under */}
            {edge?.alternate_lines && Array.isArray(edge.alternate_lines) && edge.alternate_lines.length > 0 && (
              <div className="px-5 py-3 border-t border-border/40">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 text-center">
                    <div className="text-2xs text-muted-foreground uppercase tracking-wide mb-1">DK Lowest</div>
                    {(() => {
                      const lines = edge.alternate_lines as Array<{ point: number; over_price: number; under_price: number }>;
                      const minLine = lines.reduce((min, l) => l.point < min.point ? l : min, lines[0]);
                      return (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-sm font-bold tabular-nums">{minLine.point}</span>
                          <span className="text-xs text-status-under font-medium">
                            U {minLine.under_price >= 0 ? `+${minLine.under_price}` : minLine.under_price}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="w-px h-8 bg-border/60" />
                  <div className="flex-1 text-center">
                    <div className="text-2xs text-muted-foreground uppercase tracking-wide mb-1">DK Main</div>
                    <span className="text-sm font-bold tabular-nums">{edge.dk_total_line}</span>
                  </div>
                  <div className="w-px h-8 bg-border/60" />
                  <div className="flex-1 text-center">
                    <div className="text-2xs text-muted-foreground uppercase tracking-wide mb-1">DK Highest</div>
                    {(() => {
                      const lines = edge.alternate_lines as Array<{ point: number; over_price: number; under_price: number }>;
                      const maxLine = lines.reduce((max, l) => l.point > max.point ? l : max, lines[0]);
                      return (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-sm font-bold tabular-nums">{maxLine.point}</span>
                          <span className="text-xs text-status-over font-medium">
                            O {maxLine.over_price >= 0 ? `+${maxLine.over_price}` : maxLine.over_price}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Footer with segment info and confidence */}
            <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {edge?.dk_offered && edge.dk_total_line !== null
                    ? `O/U ${edge.dk_total_line} • DraftKings`
                    : "DK unavailable"}
                </span>
                {edge?.segment_used && edge.segment_used !== 'insufficient' && (
                  <SegmentBadge 
                    segment={edge.segment_used} 
                    nUsed={edge.n_used}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <RecencyIndicator 
                  segment={edge?.segment_used} 
                  homeContinuity={rosterData?.homeContinuity}
                  awayContinuity={rosterData?.awayContinuity}
                  size="md"
                />
                <ConfidenceBadge 
                  nGames={nH2H} 
                  segment={edge?.segment_used}
                  homeContinuity={rosterData?.homeContinuity}
                  awayContinuity={rosterData?.awayContinuity}
                  showDetails={true}
                />
              </div>
            </div>
          </div>

          {/* Stats summary */}
          {hasEnoughData && stats && (
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-card border border-border/60 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {stats.n_games}
                </div>
                <div className="text-2xs text-muted-foreground">Games</div>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {stats.p05?.toFixed(1) || "—"}
                </div>
                <div className="text-2xs text-muted-foreground">P05</div>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {stats.median?.toFixed(1) || "—"}
                </div>
                <div className="text-2xs text-muted-foreground">Median</div>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {stats.p95?.toFixed(1) || "—"}
                </div>
                <div className="text-2xs text-muted-foreground">P95</div>
              </div>
            </div>
          )}

          {/* Edge Detection Card - alternate lines near p05/p95 */}
          {edge && hasEnoughData && (
            <EdgeDetectionCard
              p05={stats?.p05 ?? null}
              p95={stats?.p95 ?? null}
              p95OverLine={edge.p95_over_line ?? null}
              p95OverOdds={edge.p95_over_odds ?? null}
              p05UnderLine={edge.p05_under_line ?? null}
              p05UnderOdds={edge.p05_under_odds ?? null}
              bestOverEdge={edge.best_over_edge ?? null}
              bestUnderEdge={edge.best_under_edge ?? null}
              alternateLines={edge.alternate_lines ?? null}
              dkTotalLine={edge.dk_total_line ?? null}
            />
          )}

          {/* Roster Continuity Card */}
          {rosterData && (rosterData.homeContinuity !== null || rosterData.awayContinuity !== null) && (
            <RosterContinuityCard
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              homeContinuity={rosterData.homeContinuity}
              awayContinuity={rosterData.awayContinuity}
              homeEra={rosterData.homeEra}
              awayEra={rosterData.awayEra}
            />
          )}

          {/* Segment Analysis - All time windows with confidence */}
          {game.home_team?.id && game.away_team?.id && (
            <SegmentAnalysis
              sportId={game.sport_id}
              homeTeamId={game.home_team.id}
              awayTeamId={game.away_team.id}
              homeRosterContinuity={rosterData?.homeContinuity}
              awayRosterContinuity={rosterData?.awayContinuity}
              dkLine={edge?.dk_total_line}
              onSegmentSelect={(seg) => setSelectedSegment(seg as SegmentKey)}
              selectedSegment={selectedSegment}
            />
          )}

          {/* Segment Timeline Chart */}
          {game.home_team?.id && game.away_team?.id && (
            <SegmentTimeline
              homeTeamId={game.home_team.id}
              awayTeamId={game.away_team.id}
              dkLine={edge?.dk_total_line}
            />
          )}

          {/* Segment Comparison */}
          {game.home_team?.id && game.away_team?.id && (
            <SegmentComparison
              homeTeamId={game.home_team.id}
              awayTeamId={game.away_team.id}
              dkLine={edge?.dk_total_line}
            />
          )}

          {/* Distribution Chart */}
          {history.length >= 3 && (
            <div className="bg-card rounded-2xl border border-border/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Score Distribution</h2>
                <span className="text-xs text-muted-foreground ml-auto">
                  {history.length} games
                </span>
              </div>
              <HistoricalDistributionChart
                totals={history.map((g) => g.total)}
                p05={stats?.p05 ?? null}
                p95={stats?.p95 ?? null}
                median={stats?.median ?? null}
                dkLine={edge?.dk_total_line ?? null}
              />
            </div>
          )}

          {/* Games Per Year Chart */}
          {history.length >= 2 && (
            <GamesPerYearChart history={history} />
          )}

          {/* H2H History */}
          {history.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">H2H History</h2>
                <span className="text-xs text-muted-foreground ml-auto">
                  Last {history.length}
                </span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between py-2.5 px-3 bg-secondary/30 rounded-lg"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(h.played_at), "MMM d, yyyy")}
                      </span>
                      {h.home_score !== null && h.away_score !== null && (
                        <span className="text-2xs text-muted-foreground">
                          {h.away_team} {h.away_score} @ {h.home_team}{" "}
                          {h.home_score}
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-bold tabular-nums">
                      {h.total.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center pb-6">
            Historical data analysis for entertainment purposes only.
          </p>
        </div>

        {/* Floating Action Button for Parlay */}
        <ParlayFAB
          gameId={game.id}
          homeTeam={homeTeamName}
          awayTeam={awayTeamName}
          dkLine={edge?.dk_total_line ?? null}
          percentile={edge?.dk_line_percentile ?? null}
          p05={stats?.p05 ?? null}
          p95={stats?.p95 ?? null}
        />
      </Layout>
    </>
  );
}
