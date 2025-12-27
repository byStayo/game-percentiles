import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Clock, History, BarChart3, Star } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useGameDetail } from "@/hooks/useApi";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { PickPill } from "@/components/game/PickPill";
import { WhatIsPPopover } from "@/components/game/WhatIsPPopover";
import { GameDetailSkeleton } from "@/components/game/GameDetailSkeleton";
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
  const { data, isLoading, error } = useGameDetail(id || "");
  const { isFavorite, toggleFavorite } = useFavoriteMatchups();

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
            <WhatIsPPopover />
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

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border/40 text-center text-xs text-muted-foreground">
              {edge?.dk_offered && edge.dk_total_line !== null
                ? `O/U ${edge.dk_total_line} • DraftKings`
                : "DK unavailable"}
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
      </Layout>
    </>
  );
}
