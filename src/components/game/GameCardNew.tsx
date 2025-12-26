import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getTeamDisplayName } from "@/lib/teamNames";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight, AlertTriangle, Check, X, TrendingUp, TrendingDown } from "lucide-react";
import type { TodayGame } from "@/hooks/useApi";
import type { SportId } from "@/types";

interface GameCardProps {
  game: TodayGame;
}

const sportColors: Record<SportId, { bg: string; text: string; border: string }> = {
  nfl: { bg: "bg-sport-nfl/8", text: "text-sport-nfl", border: "border-sport-nfl/20" },
  nba: { bg: "bg-sport-nba/8", text: "text-sport-nba", border: "border-sport-nba/20" },
  mlb: { bg: "bg-sport-mlb/8", text: "text-sport-mlb", border: "border-sport-mlb/20" },
  nhl: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
};

interface PredictionResult {
  type: 'hit' | 'miss' | 'push';
  label: string;
  description: string;
  overUnder?: 'over' | 'under' | 'push';
}

function getPredictionResult(game: TodayGame): PredictionResult | null {
  // Only show for final games with all required data
  if (game.status !== 'final' || game.final_total === null) return null;
  if (game.dk_total_line === null || game.dk_line_percentile === null) return null;
  if (game.p05 === null || game.p95 === null) return null;

  const finalTotal = game.final_total;
  const dkLine = game.dk_total_line;
  const percentile = game.dk_line_percentile;

  // Determine if it went over or under
  const wentOver = finalTotal > dkLine;
  const wentUnder = finalTotal < dkLine;
  const isPush = finalTotal === dkLine;

  if (isPush) {
    return { type: 'push', label: 'Push', description: `Final ${finalTotal} matched the line`, overUnder: 'push' };
  }

  // Our edge prediction logic:
  // - If DK line is at low percentile (<30%), we expect OVER (line is too low)
  // - If DK line is at high percentile (>70%), we expect UNDER (line is too high)
  const predictedOver = percentile < 30;
  const predictedUnder = percentile > 70;

  if (predictedOver) {
    // We predicted OVER
    if (wentOver) {
      return { type: 'hit', label: 'Over Hit', description: `Predicted over at ${percentile.toFixed(0)}%ile, final ${finalTotal} > ${dkLine}`, overUnder: 'over' };
    } else {
      return { type: 'miss', label: 'Over Miss', description: `Predicted over at ${percentile.toFixed(0)}%ile, but final ${finalTotal} < ${dkLine}`, overUnder: 'over' };
    }
  } else if (predictedUnder) {
    // We predicted UNDER
    if (wentUnder) {
      return { type: 'hit', label: 'Under Hit', description: `Predicted under at ${percentile.toFixed(0)}%ile, final ${finalTotal} < ${dkLine}`, overUnder: 'under' };
    } else {
      return { type: 'miss', label: 'Under Miss', description: `Predicted under at ${percentile.toFixed(0)}%ile, but final ${finalTotal} > ${dkLine}`, overUnder: 'under' };
    }
  }

  // No strong prediction (line was in the middle range)
  return null;
}

export function GameCard({ game }: GameCardProps) {
  const startTime = new Date(game.start_time_utc);
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const colors = sportColors[game.sport_id];
  const predictionResult = getPredictionResult(game);

  const homeTeamName = getTeamDisplayName(game.home_team, game.sport_id);
  const awayTeamName = getTeamDisplayName(game.away_team, game.sport_id);

  return (
    <Link
      to={`/game/${game.game_id}`}
      className={cn(
        "group block p-6 bg-card rounded-2xl border border-border/60",
        "shadow-card transition-all duration-300 ease-out",
        "hover:shadow-card-hover hover:-translate-y-1 hover:border-border",
        predictionResult?.type === 'hit' && "ring-2 ring-status-under/30 border-status-under/40",
        predictionResult?.type === 'miss' && "ring-2 ring-status-over/30 border-status-over/40"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-status-live/10 text-status-live">
              <span className="w-1.5 h-1.5 rounded-full bg-status-live animate-pulse-soft" />
              LIVE
            </span>
          ) : isFinal ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                Final
              </span>
              {predictionResult && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold",
                        predictionResult.type === 'hit' && "bg-status-under/15 text-status-under",
                        predictionResult.type === 'miss' && "bg-status-over/15 text-status-over",
                        predictionResult.type === 'push' && "bg-muted text-muted-foreground"
                      )}>
                        {predictionResult.type === 'hit' && <Check className="h-3 w-3" />}
                        {predictionResult.type === 'miss' && <X className="h-3 w-3" />}
                        {predictionResult.overUnder === 'over' && <TrendingUp className="h-3 w-3" />}
                        {predictionResult.overUnder === 'under' && <TrendingDown className="h-3 w-3" />}
                        {predictionResult.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] text-xs">
                      {predictionResult.description}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              {format(startTime, 'h:mm a')}
            </span>
          )}
        </div>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                {game.n_h2h === 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-status-over/10 text-status-over">
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                )}
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold tabular-nums",
                  game.n_h2h >= 10 ? "bg-status-under/10 text-status-under" :
                  game.n_h2h >= 5 ? "bg-status-edge/10 text-status-edge" :
                  game.n_h2h >= 2 ? "bg-muted text-muted-foreground" :
                  "bg-status-over/10 text-status-over"
                )}>
                  n={game.n_h2h}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-xs">
              <strong>{game.n_h2h}</strong> historical matchups between these teams
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Teams */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-foreground truncate pr-3">{awayTeamName}</span>
          {(isFinal || isLive) && game.away_score !== null && (
            <span className="text-2xl font-bold tabular-nums">{game.away_score}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-foreground truncate pr-3">{homeTeamName}</span>
          {(isFinal || isLive) && game.home_score !== null && (
            <span className="text-2xl font-bold tabular-nums">{game.home_score}</span>
          )}
        </div>
      </div>

      {/* Percentile visualization */}
      {game.p05 !== null && game.p95 !== null && (
        <div className="mb-5">
          <PercentileBar
            p05={game.p05}
            p95={game.p95}
            dkLine={game.dk_total_line}
            dkPercentile={game.dk_line_percentile}
            finalTotal={isFinal ? game.final_total : undefined}
            showRecommendation={!isFinal && !isLive}
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-2 py-0.5 rounded-md text-2xs font-semibold uppercase",
            colors.bg, colors.text
          )}>
            {game.sport_id}
          </span>
          {game.dk_offered && game.dk_total_line && (
            <span className="text-sm text-muted-foreground">
              O/U <span className="font-semibold text-foreground">{game.dk_total_line.toFixed(1)}</span>
              {isFinal && game.final_total !== null && (
                <span className="ml-1.5 text-muted-foreground">
                  → <span className={cn(
                    "font-semibold",
                    game.final_total > game.dk_total_line ? "text-status-over" : 
                    game.final_total < game.dk_total_line ? "text-status-under" : "text-foreground"
                  )}>{game.final_total}</span>
                </span>
              )}
            </span>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </div>
    </Link>
  );
}