import { useState, useEffect, useCallback } from "react";

const FAVORITES_KEY = "game-percentiles-favorite-matchups";

export interface FavoriteMatchup {
  gameId: string;
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
  sportId: string;
}

export function useFavoriteMatchups() {
  const [favorites, setFavorites] = useState<FavoriteMatchup[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch {
        setFavorites([]);
      }
    }
  }, []);

  const addFavorite = useCallback((matchup: FavoriteMatchup) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.gameId === matchup.gameId)) return prev;
      const updated = [...prev, matchup];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFavorite = useCallback((gameId: string) => {
    setFavorites((prev) => {
      const updated = prev.filter((f) => f.gameId !== gameId);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isFavorite = useCallback(
    (gameId: string) => favorites.some((f) => f.gameId === gameId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (matchup: FavoriteMatchup) => {
      if (isFavorite(matchup.gameId)) {
        removeFavorite(matchup.gameId);
      } else {
        addFavorite(matchup);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
  };
}
