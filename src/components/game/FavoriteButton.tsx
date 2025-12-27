import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FavoriteTeam } from "@/hooks/useFavorites";

interface FavoriteButtonProps {
  team: FavoriteTeam;
  isFavorite: boolean;
  onToggle: (team: FavoriteTeam) => void;
  size?: "sm" | "default";
}

export function FavoriteButton({
  team,
  isFavorite,
  onToggle,
  size = "sm",
}: FavoriteButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "transition-all",
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        isFavorite && "text-red-500 hover:text-red-600"
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(team);
      }}
    >
      <Heart
        className={cn(
          size === "sm" ? "h-4 w-4" : "h-5 w-5",
          isFavorite && "fill-current"
        )}
      />
    </Button>
  );
}
