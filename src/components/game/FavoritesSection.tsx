import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, X, Star } from "lucide-react";
import type { FavoriteTeam } from "@/hooks/useFavorites";
import type { TodayGame } from "@/hooks/useApi";

interface FavoritesSectionProps {
  favorites: FavoriteTeam[];
  games: TodayGame[];
  onRemove: (teamId: string) => void;
}

export function FavoritesSection({
  favorites,
  games,
  onRemove,
}: FavoritesSectionProps) {
  if (favorites.length === 0) {
    return null;
  }

  // Find games involving favorite teams
  const favoriteGames = games.filter((game) =>
    favorites.some(
      (fav) =>
        fav.abbrev === game.home_team?.abbrev ||
        fav.abbrev === game.away_team?.abbrev
    )
  );

  return (
    <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Heart className="h-5 w-5 text-red-500 fill-red-500" />
          Your Favorites
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Teams you're tracking
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Favorite teams list */}
        <div className="flex flex-wrap gap-2">
          {favorites.map((team) => (
            <div
              key={team.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/60 text-sm"
            >
              <span className="font-medium">{team.abbrev}</span>
              <span className="text-muted-foreground text-xs uppercase">
                {team.sportId}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-1 hover:bg-destructive/20 hover:text-destructive"
                onClick={() => onRemove(team.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Games today involving favorites */}
        {favoriteGames.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <Star className="h-4 w-4 text-yellow-500" />
              Today's Games
            </h4>
            <div className="space-y-2">
              {favoriteGames.map((game) => (
                <Link
                  key={game.id}
                  to={`/game/${game.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="font-medium">
                    {game.away_team?.abbrev || 'Away'} @ {game.home_team?.abbrev || 'Home'}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="uppercase text-xs font-medium">
                      {game.sport_id}
                    </span>
                    {game.dk_line_percentile !== null && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        P{Math.round(game.dk_line_percentile)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {favoriteGames.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No games today for your favorite teams.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
