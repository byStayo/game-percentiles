import { cn } from "@/lib/utils";
import type { SportId } from "@/types";

interface SportIconProps {
  sport: SportId;
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}

const sportEmojis: Record<SportId, string> = {
  nfl: "🏈",
  nba: "🏀",
  mlb: "⚾",
  nhl: "🏒",
};

const sportColors: Record<SportId, string> = {
  nfl: "bg-sport-nfl/10 text-sport-nfl",
  nba: "bg-sport-nba/10 text-sport-nba",
  mlb: "bg-sport-mlb/10 text-sport-mlb",
  nhl: "bg-muted text-muted-foreground",
};

const sizes = {
  sm: "w-5 h-5 text-xs",
  md: "w-7 h-7 text-sm",
  lg: "w-9 h-9 text-base",
};

export function SportIcon({ sport, size = "sm", className, showLabel }: SportIconProps) {
  return (
    <div 
      className={cn(
        "inline-flex items-center justify-center rounded-lg",
        sportColors[sport],
        sizes[size],
        className
      )}
    >
      <span role="img" aria-label={sport.toUpperCase()}>
        {sportEmojis[sport]}
      </span>
      {showLabel && (
        <span className="ml-1 font-semibold uppercase">{sport}</span>
      )}
    </div>
  );
}

// Sport badge with count
interface SportBadgeProps {
  sport: SportId;
  count: number;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SportBadge({ sport, count, isActive, onClick, className }: SportBadgeProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap touch-manipulation active:scale-95",
        isActive
          ? "bg-foreground text-background shadow-sm"
          : "bg-muted/50 text-muted-foreground hover:bg-muted",
        className
      )}
    >
      <span role="img" aria-label={sport.toUpperCase()}>
        {sportEmojis[sport]}
      </span>
      <span className="uppercase">{sport}</span>
      <span className={cn(
        "px-1.5 rounded text-2xs tabular-nums",
        isActive ? "bg-background/20" : "bg-muted"
      )}>
        {count}
      </span>
    </button>
  );
}
