import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getTeamDisplayName, formatTimeET } from "@/lib/teamNames";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { PickPill } from "@/components/game/PickPill";
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

const sportColors: Record<SportId, { bg: string; text: string; border: string }> = {
  nfl: { bg: "bg-sport-nfl/10", text: "text-sport-nfl", border: "border-sport-nfl/30" },
  nba: { bg: "bg-sport-nba/10", text: "text-sport-nba", border: "border-sport-nba/30" },
  mlb: { bg: "bg-sport-mlb/10", text: "text-sport-mlb", border: "border-sport-mlb/30" },
  nhl: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
};

export function GameCard({ game }: GameCardProps) {
  const navigate = useNavigate();
  const startTime = new Date(game.start_time_utc);
  const isLive = game.status === "live";
  const isFinal = game.status === "final";
  const colors = sportColors[game.sport_id];
  const { isFavorite, toggleFavorite } = useFavoriteMatchups();
  const { lightTap, success, warning } = useHapticFeedback();
  const [swipeState, setSwipeState] = useState<"none" | "left" | "right">("none");

  const hasEdge = (game.best_over_edge ?? 0) > 0 || (game.best_under_edge ?? 0) > 0;

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
      const pickType = overEdge > underEdge ? "over" : "under";

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
  }, [game, matchupData, navigate, success, warning]);

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
      className="relative overflow-hidden rounded-2xl"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Swipe indicators */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-14 flex items-center justify-center bg-primary/20 transition-opacity duration-200 z-10 pointer-events-none rounded-l-2xl",
          swipeState === "right" ? "opacity-100" : "opacity-0"
        )}
      >
        <Heart className="h-5 w-5 text-primary" />
      </div>
      <div
        className={cn(
          "absolute inset-y-0 right-0 w-14 flex items-center justify-center bg-status-edge/20 transition-opacity duration-200 z-10 pointer-events-none rounded-r-2xl",
          swipeState === "left" ? "opacity-100" : "opacity-0"
        )}
      >
        <Plus className="h-5 w-5 text-status-edge" />
      </div>

      <Link
        to={`/game/${game.game_id}`}
        onClick={handleCardClick}
        className={cn(
          "group block p-3 bg-card rounded-2xl border transition-all duration-150 touch-manipulation",
          "active:scale-[0.98] active:bg-muted/30",
          hasEdge
            ? "border-status-edge/40 ring-1 ring-status-edge/20"
            : "border-border/50",
          swipeState === "left" && "-translate-x-3",
          swipeState === "right" && "translate-x-3"
        )}
      >
        {/* Header: Time + Sport + Favorite */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {isLive ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-status-live/10 text-status-live">
                <span className="w-1.5 h-1.5 rounded-full bg-status-live animate-pulse" />
                LIVE
              </span>
            ) : isFinal ? (
              <span className="px-1.5 py-0.5 rounded-full text-2xs font-medium bg-muted text-muted-foreground">
                Final
              </span>
            ) : (
              <span className="text-xs text-muted-foreground font-medium">
                {formatTimeET(startTime)}
              </span>
            )}
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-2xs font-bold uppercase",
                colors.bg,
                colors.text
              )}
            >
              {game.sport_id}
            </span>
            <span className="text-2xs text-muted-foreground/70">
              n={game.n_h2h}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 -mr-1",
              isFav && "text-yellow-500 hover:text-yellow-600"
            )}
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

        {/* Teams - clean and scannable */}
        <div className="space-y-0.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground truncate pr-2">
              {awayTeamName}
            </span>
            {(isFinal || isLive) && game.away_score !== null && (
              <span className="text-lg font-bold tabular-nums">{game.away_score}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground truncate pr-2">
              {homeTeamName}
            </span>
            {(isFinal || isLive) && game.home_score !== null && (
              <span className="text-lg font-bold tabular-nums">{game.home_score}</span>
            )}
          </div>
        </div>

        {/* Pick recommendation - the main focus */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <PickPill
            nH2H={game.n_h2h}
            dkOffered={game.dk_offered}
            dkTotalLine={game.dk_total_line}
            dkLinePercentile={game.dk_line_percentile}
            bestOverEdge={game.best_over_edge}
            bestUnderEdge={game.best_under_edge}
            p95OverLine={game.p95_over_line}
            p05UnderLine={game.p05_under_line}
            p05={game.p05}
            p95={game.p95}
            isFinal={isFinal}
            compact
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
        </div>

        {/* Percentile bar - simplified */}
        {game.p05 !== null && game.p95 !== null && (
          <PercentileBar
            p05={game.p05}
            p95={game.p95}
            dkLine={game.dk_total_line}
            dkPercentile={game.dk_line_percentile}
            finalTotal={isFinal ? game.final_total : undefined}
          />
        )}
      </Link>
    </div>
  );
}
