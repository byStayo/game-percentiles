import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PercentileBar } from "@/components/ui/percentile-bar";
import type { TodayGame } from "@/hooks/useApi";
import type { SportId } from "@/types";

interface GameCardProps {
  game: TodayGame;
}

const sportAccents: Record<SportId, string> = {
  nfl: "hover:border-l-sport-nfl",
  nba: "hover:border-l-sport-nba",
  mlb: "hover:border-l-sport-mlb",
  nhl: "hover:border-l-sport-nhl",
  soccer: "hover:border-l-sport-soccer",
};

export function GameCard({ game }: GameCardProps) {
  const startTime = new Date(game.start_time_utc);
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';

  const homeTeamName = game.home_team?.city 
    ? `${game.home_team.city} ${game.home_team.name}` 
    : game.home_team?.name || 'TBD';
  
  const awayTeamName = game.away_team?.city 
    ? `${game.away_team.city} ${game.away_team.name}` 
    : game.away_team?.name || 'TBD';

  return (
    <Link
      to={`/game/${game.game_id}`}
      className={cn(
        "block p-5 bg-card rounded-xl border border-border shadow-card",
        "border-l-4 border-l-transparent transition-all duration-200",
        "hover:shadow-md hover:scale-[1.01]",
        sportAccents[game.sport_id]
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
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
          {!isLive && !isFinal && (
            <span className="text-sm text-muted-foreground">
              {format(startTime, 'h:mm a')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-2xs">H2H</span>
          <span className="text-sm font-semibold text-foreground">{game.n_h2h}</span>
        </div>
      </div>

      {/* Teams */}
      <div className="space-y-2.5 mb-5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground truncate pr-2">{awayTeamName}</span>
          {(isFinal || isLive) && game.away_score !== null && (
            <span className="text-xl font-bold tabular-nums">{game.away_score}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground truncate pr-2">{homeTeamName}</span>
          {(isFinal || isLive) && game.home_score !== null && (
            <span className="text-xl font-bold tabular-nums">{game.home_score}</span>
          )}
        </div>
      </div>

      {/* Percentile bar */}
      {game.p05 !== null && game.p95 !== null && (
        <PercentileBar
          p05={game.p05}
          p95={game.p95}
          dkLine={game.dk_total_line}
          dkPercentile={game.dk_line_percentile}
        />
      )}

      {/* DK Status */}
      <div className="mt-4 pt-4 border-t border-border">
        {game.dk_offered ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">DraftKings</span>
            <span className="font-semibold">{game.dk_total_line?.toFixed(1)}</span>
          </div>
        ) : (
          <span className="text-2xs text-muted-foreground">
            DraftKings totals unavailable
          </span>
        )}
      </div>
    </Link>
  );
}
