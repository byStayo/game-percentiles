import { cn } from "@/lib/utils";
import type { SportId } from "@/types";

interface SportTabsProps {
  sports: Array<{ id: SportId; display_name: string }>;
  activeSport: SportId;
  onSportChange: (sport: SportId) => void;
}

const sportColors: Record<SportId, string> = {
  nfl: "data-[state=active]:bg-sport-nfl data-[state=active]:text-primary-foreground",
  nba: "data-[state=active]:bg-sport-nba data-[state=active]:text-primary-foreground",
  mlb: "data-[state=active]:bg-sport-mlb data-[state=active]:text-primary-foreground",
  nhl: "data-[state=active]:bg-sport-nhl data-[state=active]:text-primary-foreground",
  soccer: "data-[state=active]:bg-sport-soccer data-[state=active]:text-primary-foreground",
};

export function SportTabs({ sports, activeSport, onSportChange }: SportTabsProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-secondary rounded-full w-fit">
      {sports.map((sport) => (
        <button
          key={sport.id}
          data-state={activeSport === sport.id ? "active" : "inactive"}
          onClick={() => onSportChange(sport.id)}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
            "text-muted-foreground hover:text-foreground",
            "data-[state=active]:shadow-sm",
            sportColors[sport.id]
          )}
        >
          {sport.display_name}
        </button>
      ))}
    </div>
  );
}
