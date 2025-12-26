import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { ArrowLeft, Calendar, TrendingUp, Clock } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useGameDetail } from "@/hooks/useGameDetail";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SportId } from "@/types";

const sportColors: Record<SportId, string> = {
  nfl: "bg-sport-nfl",
  nba: "bg-sport-nba",
  mlb: "bg-sport-mlb",
  nhl: "bg-sport-nhl",
  soccer: "bg-sport-soccer",
};

export default function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useGameDetail(id || '');

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold mb-2">Game not found</h2>
          <p className="text-muted-foreground mb-4">The requested game could not be found.</p>
          <Button asChild variant="outline">
            <Link to="/">Back to Today</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const { game, matchupStats, matchupGames, dailyEdge } = data;
  const hasEnoughData = (matchupStats?.n_games || 0) >= 5;

  return (
    <>
      <Helmet>
        <title>{`${game.away_team.name} vs ${game.home_team.name} | Percentile Totals`}</title>
        <meta name="description" content={`H2H historical analysis for ${game.away_team.name} at ${game.home_team.name}. View percentile bounds and DraftKings line analysis.`} />
      </Helmet>

      <Layout>
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Today
          </Link>

          {/* Game header */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className={cn("w-2 h-12 rounded-full", sportColors[game.sport_id])} />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {game.sport_id.toUpperCase()}
                  </Badge>
                  {game.status === 'live' && (
                    <Badge variant="outline" className="bg-status-live/10 text-status-live border-status-live/30 text-xs">
                      LIVE
                    </Badge>
                  )}
                  {game.status === 'final' && (
                    <Badge variant="outline" className="text-xs">FINAL</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(game.start_time_utc), 'EEEE, MMMM d, yyyy')}
                  <Clock className="h-4 w-4 ml-2" />
                  {format(new Date(game.start_time_utc), 'h:mm a')}
                </div>
              </div>
            </div>

            {/* Teams */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">AWAY</span>
                  <span className="text-xl font-semibold">{game.away_team.name}</span>
                </div>
                {game.status === 'final' && game.away_score !== null && (
                  <span className="text-3xl font-bold tabular-nums">{game.away_score}</span>
                )}
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">HOME</span>
                  <span className="text-xl font-semibold">{game.home_team.name}</span>
                </div>
                {game.status === 'final' && game.home_score !== null && (
                  <span className="text-3xl font-bold tabular-nums">{game.home_score}</span>
                )}
              </div>
            </div>
          </div>

          {/* Percentile analysis */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">H2H Analysis</h2>
            </div>

            {!hasEnoughData ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Insufficient H2H sample (n={matchupStats?.n_games || 0})
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  At least 5 historical matchups required
                </p>
              </div>
            ) : matchupStats && dailyEdge ? (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <span className="text-2xl font-bold">{matchupStats.n_games}</span>
                    <span className="block text-xs text-muted-foreground">Games</span>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-bold">{matchupStats.p05?.toFixed(1)}</span>
                    <span className="block text-xs text-muted-foreground">P05</span>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-bold">{matchupStats.median?.toFixed(1)}</span>
                    <span className="block text-xs text-muted-foreground">Median</span>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-bold">{matchupStats.p95?.toFixed(1)}</span>
                    <span className="block text-xs text-muted-foreground">P95</span>
                  </div>
                </div>

                {/* Percentile bar */}
                {dailyEdge.p05 !== null && dailyEdge.p95 !== null && (
                  <PercentileBar
                    p05={dailyEdge.p05}
                    p95={dailyEdge.p95}
                    dkLine={dailyEdge.dk_total_line}
                    dkPercentile={dailyEdge.dk_line_percentile}
                    className="pt-4 border-t border-border"
                  />
                )}

                {/* DK info */}
                {dailyEdge.dk_offered && dailyEdge.dk_total_line !== null && (
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-muted-foreground">DraftKings Line</span>
                        <span className="block text-xl font-bold">{dailyEdge.dk_total_line.toFixed(1)}</span>
                      </div>
                      {dailyEdge.dk_line_percentile !== null && (
                        <div className={cn(
                          "px-4 py-2 rounded-lg text-center",
                          dailyEdge.dk_line_percentile <= 10 ? "bg-percentile-low/10" :
                          dailyEdge.dk_line_percentile >= 90 ? "bg-percentile-high/10" :
                          "bg-percentile-mid/10"
                        )}>
                          <span className="text-2xl font-bold">P{Math.round(dailyEdge.dk_line_percentile)}</span>
                          <span className="block text-xs text-muted-foreground">Percentile</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* H2H History */}
          {matchupGames.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <h2 className="text-lg font-semibold mb-4">Recent H2H Games</h2>
              <div className="space-y-2">
                {matchupGames.map((mg) => (
                  <div
                    key={mg.id}
                    className="flex items-center justify-between py-3 px-4 bg-secondary/30 rounded-lg"
                  >
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(mg.played_at_utc), 'MMM d, yyyy')}
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {mg.total.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last updated */}
          {dailyEdge && (
            <p className="text-xs text-muted-foreground text-center">
              Last updated: {format(new Date(dailyEdge.updated_at), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      </Layout>
    </>
  );
}
