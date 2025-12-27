import { useState, useEffect, useCallback } from "react";

const FAVORITES_KEY = "game-percentiles-favorites";

export interface FavoriteTeam {
  id: string;
  name: string;
  abbrev: string;
  sportId: string;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>([]);

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

  const saveFavorites = useCallback((newFavorites: FavoriteTeam[]) => {
    setFavorites(newFavorites);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
  }, []);

  const addFavorite = useCallback((team: FavoriteTeam) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === team.id)) return prev;
      const updated = [...prev, team];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFavorite = useCallback((teamId: string) => {
    setFavorites((prev) => {
      const updated = prev.filter((f) => f.id !== teamId);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isFavorite = useCallback(
    (teamId: string) => favorites.some((f) => f.id === teamId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (team: FavoriteTeam) => {
      if (isFavorite(team.id)) {
        removeFavorite(team.id);
      } else {
        addFavorite(team);
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
