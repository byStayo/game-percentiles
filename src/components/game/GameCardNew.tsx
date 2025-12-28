import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getTeamDisplayName, formatTimeET } from "@/lib/teamNames";
import { StatsChart } from "@/components/game/StatsChart";
import { useFavoriteMatchups } from "@/hooks/useFavoriteMatchups";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { Star, ChevronRight, Plus, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { TodayGame } from "@/hooks/useApi";
import type { SportId } from "@/types";

const PARLAY_STORAGE_KEY = 'parlay-picks';

interface GameCardProps {
  game: TodayGame;
}

const sportColors: Record<SportId, string> = {
  nfl: "text-sport-nfl bg-sport-nfl/10",
  nba: "text-sport-nba bg-sport-nba/10",
  mlb: "text-sport-mlb bg-sport-mlb/10",
  nhl: "text-muted-foreground bg-muted",
};

export function GameCard({ game }: GameCardProps) {
  const navigate = useNavigate();
  const startTime = new Date(game.start_time_utc);
  const isLive = game.status === "live";
  const isFinal = game.status === "final";
  const { isFavorite, toggleFavorite } = useFavoriteMatchups();
  const { lightTap, success, warning } = useHapticFeedback();
  const [swipeState, setSwipeState] = useState<"none" | "left" | "right">("none");

  const hasEdge = (game.best_over_edge ?? 0) > 0 || (game.best_under_edge ?? 0) > 0;
  
  // Determine if there's a percentile-based lean
  const P = game.dk_line_percentile ?? 50;
  const hasLean = P <= 30 || P >= 70;

  const homeTeamName = getTeamDisplayName(game.home_team, game.sport_id);
  const awayTeamName = getTeamDisplayName(game.away_team, game.sport_id);

  const matchupData = {
    gameId: game.game_id,
    homeTeamAbbrev: game.home_team?.abbrev || "HOME",
    awayTeamAbbrev: game.away_team?.abbrev || "AWAY",
    sportId: game.sport_id,
  };

  const isFav = isFavorite(game.game_id);

  // Add to parlay
  const addToParlay = useCallback(() => {
    try {
      const stored = localStorage.getItem(PARLAY_STORAGE_KEY);
      const picks = stored ? JSON.parse(stored) : [];

      if (picks.some((p: { gameId: string }) => p.gameId === game.game_id)) {
        warning();
        toast.info("Already in parlay");
        return;
      }

      const overEdge = game.best_over_edge ?? 0;
      const underEdge = game.best_under_edge ?? 0;
      const pickType = overEdge > underEdge ? "over" : (P <= 30 ? "over" : "under");

      picks.push({
        gameId: game.game_id,
        homeTeam: matchupData.homeTeamAbbrev,
        awayTeam: matchupData.awayTeamAbbrev,
        sportId: game.sport_id,
        pickType,
        line: game.dk_total_line,
      });

      localStorage.setItem(PARLAY_STORAGE_KEY, JSON.stringify(picks));
      success();
      toast.success("Added to parlay", {
        action: { label: "View", onClick: () => navigate("/parlay") },
      });
    } catch {
      toast.error("Could not add to parlay");
    }
  }, [game, matchupData, navigate, success, warning, P]);

  // Swipe handlers
  const handleSwipeLeft = useCallback(() => {
    lightTap();
    setSwipeState("left");
    addToParlay();
    setTimeout(() => setSwipeState("none"), 300);
  }, [addToParlay, lightTap]);

  const handleSwipeRight = useCallback(() => {
    lightTap();
    setSwipeState("right");
    toggleFavorite(matchupData);
    setTimeout(() => setSwipeState("none"), 300);
  }, [toggleFavorite, matchupData, lightTap]);

  const { onTouchStart, onTouchEnd } = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 60,
  });

  const handleCardClick = () => {
    lightTap();
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Swipe indicators */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-12 flex items-center justify-center bg-primary/20 transition-opacity duration-200 z-10 pointer-events-none rounded-l-xl",
          swipeState === "right" ? "opacity-100" : "opacity-0"
        )}
      >
        <Heart className="h-5 w-5 text-primary" />
      </div>
      <div
        className={cn(
          "absolute inset-y-0 right-0 w-12 flex items-center justify-center bg-status-edge/20 transition-opacity duration-200 z-10 pointer-events-none rounded-r-xl",
          swipeState === "left" ? "opacity-100" : "opacity-0"
        )}
      >
        <Plus className="h-5 w-5 text-status-edge" />
      </div>

      <Link
        to={`/game/${game.game_id}`}
        onClick={handleCardClick}
        className={cn(
          "group block p-3 bg-card rounded-xl border transition-all duration-150 touch-manipulation",
          "active:scale-[0.98]",
          hasEdge
            ? "border-status-edge/50 shadow-sm"
            : hasLean
              ? "border-border"
              : "border-border/40",
          swipeState === "left" && "-translate-x-2",
          swipeState === "right" && "translate-x-2"
        )}
      >
        {/* Row 1: Status + Sport + Matchup count + Favorite */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isLive ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold bg-status-live/10 text-status-live">
                <span className="w-1.5 h-1.5 rounded-full bg-status-live animate-pulse" />
                LIVE
              </span>
            ) : isFinal ? (
              <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-muted text-muted-foreground">
                Final
              </span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">
                {formatTimeET(startTime)}
              </span>
            )}
            <span className={cn("px-1.5 py-0.5 rounded text-2xs font-bold uppercase", sportColors[game.sport_id])}>
              {game.sport_id}
            </span>
            <span className="text-2xs text-muted-foreground/70 tabular-nums">
              {game.n_used ?? game.n_h2h} games
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 -mr-1 shrink-0", isFav && "text-yellow-500")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lightTap();
              toggleFavorite(matchupData);
            }}
          >
            <Star className={cn("h-4 w-4", isFav && "fill-current")} />
          </Button>
        </div>

        {/* Row 2: Teams */}
        <div className="mb-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold truncate">{awayTeamName}</span>
            {(isFinal || isLive) && game.away_score !== null && (
              <span className="text-base font-bold tabular-nums">{game.away_score}</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold truncate">{homeTeamName}</span>
            {(isFinal || isLive) && game.home_score !== null && (
              <span className="text-base font-bold tabular-nums">{game.home_score}</span>
            )}
          </div>
        </div>

        {/* Stats visualization */}
        {game.p05 !== null && game.p95 !== null && (
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <StatsChart
                p05={game.p05}
                p95={game.p95}
                dkLine={game.dk_total_line}
                dkPercentile={game.dk_line_percentile}
                finalTotal={isFinal ? game.final_total : undefined}
                bestOverEdge={game.best_over_edge}
                bestUnderEdge={game.best_under_edge}
                p95OverLine={game.p95_over_line}
                p05UnderLine={game.p05_under_line}
                nH2H={game.n_used ?? game.n_h2h}
                segmentUsed={game.segment_used}
              />
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-3 group-active:translate-x-0.5 transition-transform" />
          </div>
        )}
      </Link>
    </div>
  );
}
