import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Clock, TrendingUp, History, BarChart3 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useGameDetail } from "@/hooks/useApi";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HistoricalDistributionChart } from "@/components/game/HistoricalDistributionChart";
import { cn } from "@/lib/utils";
import { getTeamDisplayName, formatDateTimeET } from "@/lib/teamNames";
import type { SportId } from "@/types";

const sportColors: Record<SportId, string> = {
  nfl: "bg-sport-nfl",
  nba: "bg-sport-nba",
  mlb: "bg-sport-mlb",
  nhl: "bg-sport-nhl",
};

function GameDetailSkeleton() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </Layout>
  );
}

export default function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useGameDetail(id || '');

  if (isLoading) {
    return <GameDetailSkeleton />;
  }

  if (error || !data?.success) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-16">
          <h2 className="text-xl font-semibold mb-2">Game not found</h2>
          <p className="text-muted-foreground mb-6">
            {error instanceof Error ? error.message : 'The requested game could not be found.'}
          </p>
          <Button asChild variant="outline">
            <Link to="/">Back to Today</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const { game, edge, stats, history } = data;
  const hasEnoughData = (stats?.n_games || 0) >= 5;

  // Use DraftKings-style team names
  const homeTeamName = getTeamDisplayName(game.home_team, game.sport_id);
  const awayTeamName = getTeamDisplayName(game.away_team, game.sport_id);

  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  
  // Format time in Eastern Time
  const { time: gameTime, date: gameDate } = formatDateTimeET(game.start_time_utc);

  return (
    <>
      <Helmet>
        <title>{`${awayTeamName} vs ${homeTeamName} | Game Percentiles`}</title>
        <meta name="description" content={`H2H historical analysis for ${awayTeamName} at ${homeTeamName}. View percentile bounds and DraftKings line analysis.`} />
      </Helmet>

      <Layout>
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          {/* Game header card */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            {/* Sport & Status */}
            <div className="flex items-center gap-3 mb-6">
              <div className={cn("w-1 h-12 rounded-full", sportColors[game.sport_id])} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {game.sport_id}
                  </span>
                  {isLive && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-status-live/10 text-status-live">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-live animate-pulse" />
                      LIVE
                    </span>
                  )}
                  {isFinal && (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-muted text-muted-foreground">
                      FINAL
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {gameDate}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {gameTime}
                  </span>
                </div>
              </div>
            </div>

            {/* Teams */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                <div>
                  <span className="text-2xs text-muted-foreground block mb-0.5">AWAY</span>
                  <span className="text-lg font-semibold">{awayTeamName}</span>
                </div>
                {(isFinal || isLive) && game.away_score !== null && (
                  <span className="text-3xl font-bold tabular-nums">{game.away_score}</span>
                )}
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                <div>
                  <span className="text-2xs text-muted-foreground block mb-0.5">HOME</span>
                  <span className="text-lg font-semibold">{homeTeamName}</span>
                </div>
                {(isFinal || isLive) && game.home_score !== null && (
                  <span className="text-3xl font-bold tabular-nums">{game.home_score}</span>
                )}
              </div>
            </div>
          </div>

          {/* H2H Analysis card */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">H2H Analysis</h2>
            </div>

            {!hasEnoughData ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Insufficient sample size (n={stats?.n_games || edge?.n_h2h || 0})
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  At least 5 historical matchups required
                </p>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <span className="text-2xl font-bold">{stats.n_games}</span>
                    <span className="block text-2xs text-muted-foreground mt-0.5">Games</span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold">{stats.p05?.toFixed(1) || '—'}</span>
                    <span className="block text-2xs text-muted-foreground mt-0.5">P05</span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold">{stats.median?.toFixed(1) || '—'}</span>
                    <span className="block text-2xs text-muted-foreground mt-0.5">Median</span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold">{stats.p95?.toFixed(1) || '—'}</span>
                    <span className="block text-2xs text-muted-foreground mt-0.5">P95</span>
                  </div>
                </div>

                {/* Percentile bar */}
                {stats.p05 !== null && stats.p95 !== null && (
                  <PercentileBar
                    p05={stats.p05}
                    p95={stats.p95}
                    dkLine={edge?.dk_total_line}
                    dkPercentile={edge?.dk_line_percentile}
                    className="pt-4 border-t border-border"
                  />
                )}

                {/* DraftKings info */}
                <div className="p-4 bg-secondary/30 rounded-lg">
                  {edge?.dk_offered && edge.dk_total_line !== null ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-muted-foreground">DraftKings Total</span>
                        <span className="block text-2xl font-bold mt-0.5">{edge.dk_total_line.toFixed(1)}</span>
                      </div>
                      {edge.dk_line_percentile !== null && (
                        <div className={cn(
                          "px-4 py-2 rounded-lg text-center",
                          edge.dk_line_percentile <= 20 ? "bg-percentile-low/10" :
                          edge.dk_line_percentile >= 80 ? "bg-percentile-high/10" :
                          "bg-percentile-mid/10"
                        )}>
                          <span className="text-2xl font-bold">P{Math.round(edge.dk_line_percentile)}</span>
                          <span className="block text-2xs text-muted-foreground mt-0.5">Percentile</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      DraftKings totals unavailable
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Percentile Distribution Chart */}
          {history.length >= 3 && (
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Score Distribution</h2>
                <span className="text-sm text-muted-foreground ml-auto">{history.length} games</span>
              </div>
              <HistoricalDistributionChart
                totals={history.map(g => g.total)}
                p05={stats?.p05 ?? null}
                p95={stats?.p95 ?? null}
                median={stats?.median ?? null}
                dkLine={edge?.dk_total_line ?? null}
              />
            </div>
          )}

          {/* H2H History */}
          {history.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">H2H History</h2>
                <span className="text-sm text-muted-foreground ml-auto">Last {history.length} games</span>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {history.map((game) => (
                  <div
                    key={game.id}
                    className="flex items-center justify-between py-3 px-4 bg-secondary/20 rounded-lg"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(game.played_at), 'MMM d, yyyy')}
                      </span>
                      {game.home_score !== null && game.away_score !== null && (
                        <span className="text-xs text-muted-foreground">
                          {game.away_team} {game.away_score} @ {game.home_team} {game.home_score}
                        </span>
                      )}
                    </div>
                    <span className="text-xl font-bold tabular-nums">
                      {game.total.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center pb-4">
            Data updates hourly during game hours
          </p>
        </div>
      </Layout>
    </>
  );
}
