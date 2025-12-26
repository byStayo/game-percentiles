import { cn } from "@/lib/utils";
import type { SportId } from "@/types";

interface SportTabsProps {
  sports: Array<{ id: SportId; display_name: string }>;
  activeSport: SportId;
  onSportChange: (sport: SportId) => void;
}

export function SportTabs({ sports, activeSport, onSportChange }: SportTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
      {sports.map((sport) => (
        <button
          key={sport.id}
          onClick={() => onSportChange(sport.id)}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            activeSport === sport.id
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          {sport.display_name}
        </button>
      ))}
    </div>
  );
}
