import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PercentileBar } from "@/components/ui/percentile-bar";
import type { DailyEdge, Game, Team, SportId } from "@/types";
import { Badge } from "@/components/ui/badge";

interface GameCardProps {
  edge: DailyEdge;
  game: Game;
  homeTeam: Team;
  awayTeam: Team;
}

const sportAccents: Record<SportId, string> = {
  nfl: "border-l-sport-nfl",
  nba: "border-l-sport-nba",
  mlb: "border-l-sport-mlb",
  nhl: "border-l-sport-nhl",
};

export function GameCard({ edge, game, homeTeam, awayTeam }: GameCardProps) {
  const startTime = new Date(game.start_time_utc);
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';

  return (
    <Link
      to={`/game/${game.id}`}
      className={cn(
        "block p-5 bg-card rounded-lg border border-border shadow-card",
        "border-l-4 transition-all duration-200",
        "hover:shadow-md hover:border-border/80",
        sportAccents[edge.sport_id]
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          {isLive && (
            <Badge variant="outline" className="bg-status-live/10 text-status-live border-status-live/30 text-2xs">
              LIVE
            </Badge>
          )}
          {isFinal && (
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-2xs">
              FINAL
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {format(startTime, 'h:mm a')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium",
            edge.n_h2h >= 10 ? "bg-status-under/10 text-status-under" :
            edge.n_h2h >= 5 ? "bg-status-edge/10 text-status-edge" :
            "bg-muted text-muted-foreground"
          )}>
            <span className="font-normal opacity-70">n=</span>{edge.n_h2h}
          </span>
        </div>
      </div>

      {/* Teams */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">AWAY</span>
            <span className="font-medium">{awayTeam.name}</span>
          </div>
          {isFinal && game.away_score !== null && (
            <span className="text-lg font-semibold tabular-nums">{game.away_score}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">HOME</span>
            <span className="font-medium">{homeTeam.name}</span>
          </div>
          {isFinal && game.home_score !== null && (
            <span className="text-lg font-semibold tabular-nums">{game.home_score}</span>
          )}
        </div>
      </div>

      {/* Percentile bar */}
      {edge.p05 !== null && edge.p95 !== null && (
        <PercentileBar
          p05={edge.p05}
          p95={edge.p95}
          dkLine={edge.dk_total_line}
          dkPercentile={edge.dk_line_percentile}
        />
      )}

      {/* DK Badge */}
      {edge.dk_offered && (
        <div className="mt-3 pt-3 border-t border-border">
          <Badge variant="secondary" className="text-2xs">
            DraftKings Available
          </Badge>
        </div>
      )}
    </Link>
  );
}
