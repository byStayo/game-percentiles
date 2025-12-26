import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getTeamDisplayName } from "@/lib/teamNames";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight, AlertTriangle } from "lucide-react";
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

export function GameCard({ game }: GameCardProps) {
  const startTime = new Date(game.start_time_utc);
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const colors = sportColors[game.sport_id];

  const homeTeamName = getTeamDisplayName(game.home_team, game.sport_id);
  const awayTeamName = getTeamDisplayName(game.away_team, game.sport_id);

  return (
    <Link
      to={`/game/${game.game_id}`}
      className={cn(
        "group block p-6 bg-card rounded-2xl border border-border/60",
        "shadow-card transition-all duration-300 ease-out",
        "hover:shadow-card-hover hover:-translate-y-1 hover:border-border"
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
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              Final
            </span>
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
            </span>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </div>
    </Link>
  );
}