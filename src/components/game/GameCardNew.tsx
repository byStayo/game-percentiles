import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getTeamDisplayName, formatTimeET } from "@/lib/teamNames";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { PickPill } from "@/components/game/PickPill";
import { SegmentBadge } from "@/components/game/SegmentBadge";
import { RecencyIndicator } from "@/components/game/RecencyIndicator";
import { ConfidenceBadge } from "@/components/game/ConfidenceBadge";
import { DataQualityIndicator } from "@/components/game/DataQualityIndicator";
import { useFavoriteMatchups } from "@/hooks/useFavoriteMatchups";
import { Star, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TodayGame } from "@/hooks/useApi";
import type { SportId } from "@/types";

// Format odds for display
const formatOdds = (odds: number): string => {
  return odds > 0 ? `+${odds}` : `${odds}`;
};

// Get edge strength label and color based on edge value
const getEdgeStrength = (edge: number | null | undefined): { label: string; color: string } | null => {
  if (!edge || edge <= 0) return null;
  if (edge >= 3) return { label: "Strong", color: "bg-status-edge text-background" };
  if (edge >= 1.5) return { label: "Good", color: "bg-status-edge/70 text-background" };
  return { label: "Mild", color: "bg-status-edge/40 text-foreground" };
};

interface GameCardProps {
  game: TodayGame;
}

const sportColors: Record<SportId, { bg: string; text: string }> = {
  nfl: { bg: "bg-sport-nfl/10", text: "text-sport-nfl" },
  nba: { bg: "bg-sport-nba/10", text: "text-sport-nba" },
  mlb: { bg: "bg-sport-mlb/10", text: "text-sport-mlb" },
  nhl: { bg: "bg-muted", text: "text-muted-foreground" },
};

export function GameCard({ game }: GameCardProps) {
  const startTime = new Date(game.start_time_utc);
  const isLive = game.status === "live";
  const isFinal = game.status === "final";
  const colors = sportColors[game.sport_id];
  const { isFavorite, toggleFavorite } = useFavoriteMatchups();
  
  // Determine if this game has a strong edge
  const hasStrongEdge = game.best_over_edge || game.best_under_edge;
  
  // Calculate edge strengths
  const overEdgeStrength = getEdgeStrength(game.best_over_edge);
  const underEdgeStrength = getEdgeStrength(game.best_under_edge);

  const homeTeamName = getTeamDisplayName(game.home_team, game.sport_id);
  const awayTeamName = getTeamDisplayName(game.away_team, game.sport_id);

  const matchupData = {
    gameId: game.game_id,
    homeTeamAbbrev: game.home_team?.abbrev || "HOME",
    awayTeamAbbrev: game.away_team?.abbrev || "AWAY",
    sportId: game.sport_id,
  };

  const isFav = isFavorite(game.game_id);

  // Determine footer text
  const getFooterText = () => {
    if (!game.dk_offered || game.dk_total_line === null) {
      return "DK unavailable";
    }
    return `O/U ${game.dk_total_line} • DraftKings`;
  };

  return (
    <Link
      to={`/game/${game.game_id}`}
      className={cn(
        "group block p-4 sm:p-5 bg-card rounded-2xl border",
        "shadow-sm transition-all duration-200 ease-out touch-manipulation",
        "active:scale-[0.98] active:bg-muted/30",
        "md:hover:shadow-md md:hover:-translate-y-0.5 md:hover:border-border",
        hasStrongEdge
          ? "border-status-edge/40 ring-1 ring-status-edge/20 shadow-edge-glow"
          : "border-border/60"
      )}
    >
      {/* Top row: time + league | n badge + favorite */}
      <div className="flex items-center justify-between mb-4">
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
            <span className="text-sm text-muted-foreground">
              {formatTimeET(startTime)} ET
            </span>
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
          <DataQualityIndicator nGames={game.n_h2h} showLabel={false} />
          <span
            className={cn(
              "px-2 py-1 rounded-md text-xs font-semibold tabular-nums",
              game.n_h2h >= 5
                ? "bg-muted text-muted-foreground"
                : "bg-status-over/10 text-status-over"
            )}
          >
            n={game.n_h2h}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 touch-target transition-colors",
              isFav && "text-yellow-500 hover:text-yellow-600"
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(matchupData);
            }}
          >
            <Star
              className={cn("h-5 w-5", isFav && "fill-current")}
            />
          </Button>
        </div>
      </div>

      {/* Teams */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base sm:text-lg font-semibold text-foreground truncate">
            {awayTeamName}
          </span>
          {(isFinal || isLive) && game.away_score !== null && (
            <span className="text-xl sm:text-2xl font-bold tabular-nums flex-shrink-0">
              {game.away_score}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base sm:text-lg font-semibold text-foreground truncate">
            {homeTeamName}
          </span>
          {(isFinal || isLive) && game.home_score !== null && (
            <span className="text-xl sm:text-2xl font-bold tabular-nums flex-shrink-0">
              {game.home_score}
            </span>
          )}
        </div>
      </div>

      {/* Hero: PickPill */}
      <div className="flex justify-center mb-4">
        <PickPill
          nH2H={game.n_h2h}
          dkOffered={game.dk_offered}
          dkTotalLine={game.dk_total_line}
          dkLinePercentile={game.dk_line_percentile}
          isFinal={isFinal}
        />
      </div>

      {/* Edge Indicators */}
      {(game.best_over_edge || game.best_under_edge) && (
        <div className="flex gap-2 mb-4">
          {game.best_over_edge && game.p95_over_line && game.p95_over_odds && (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-status-over/10 border border-status-over/20">
              <TrendingUp className="h-4 w-4 text-status-over flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-status-over">Over Edge</span>
                  {overEdgeStrength && (
                    <span className={cn("px-1.5 py-0.5 rounded text-2xs font-bold", overEdgeStrength.color)}>
                      {overEdgeStrength.label}
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-foreground">
                  O {game.p95_over_line} <span className="text-status-over">{formatOdds(game.p95_over_odds)}</span>
                </div>
              </div>
            </div>
          )}
          {game.best_under_edge && game.p05_under_line && game.p05_under_odds && (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-status-under/10 border border-status-under/20">
              <TrendingDown className="h-4 w-4 text-status-under flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-status-under">Under Edge</span>
                  {underEdgeStrength && (
                    <span className={cn("px-1.5 py-0.5 rounded text-2xs font-bold", underEdgeStrength.color)}>
                      {underEdgeStrength.label}
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-foreground">
                  U {game.p05_under_line} <span className="text-status-under">{formatOdds(game.p05_under_odds)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PercentileBar */}
      {game.p05 !== null && game.p95 !== null && (
        <div className="mb-4">
          <PercentileBar
            p05={game.p05}
            p95={game.p95}
            dkLine={game.dk_total_line}
            dkPercentile={game.dk_line_percentile}
            finalTotal={isFinal ? game.final_total : undefined}
          />
        </div>
      )}

      {/* Footer with segment info and confidence indicators */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{getFooterText()}</span>
          {game.segment_used && game.segment_used !== 'insufficient' && (
            <SegmentBadge 
              segment={game.segment_used} 
              nUsed={game.n_used} 
              showTooltip={false}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <RecencyIndicator segment={game.segment_used} size="sm" />
          <ConfidenceBadge 
            nGames={game.n_h2h} 
            segment={game.segment_used}
            showDetails={true}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}
