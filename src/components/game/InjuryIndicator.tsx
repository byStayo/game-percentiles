import { AlertTriangle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Injury {
  player_name: string;
  injury_status: string;
  position?: string;
  injury_type?: string;
}

interface InjuryIndicatorProps {
  injuries: Injury[];
  teamAbbrev: string;
  size?: "xs" | "sm" | "md";
}

const statusColors: Record<string, { bg: string; text: string }> = {
  out: { bg: "bg-destructive/10", text: "text-destructive" },
  doubtful: { bg: "bg-orange-500/10", text: "text-orange-500" },
  questionable: { bg: "bg-yellow-500/10", text: "text-yellow-500" },
  probable: { bg: "bg-green-500/10", text: "text-green-500" },
};

function getStatusColor(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("out") || normalized.includes("ir")) {
    return statusColors.out;
  }
  if (normalized.includes("doubtful")) {
    return statusColors.doubtful;
  }
  if (normalized.includes("questionable") || normalized.includes("quest")) {
    return statusColors.questionable;
  }
  if (normalized.includes("probable")) {
    return statusColors.probable;
  }
  return statusColors.questionable;
}

export function InjuryIndicator({ injuries, teamAbbrev, size = "sm" }: InjuryIndicatorProps) {
  if (!injuries || injuries.length === 0) return null;

  // Group by status severity
  const outCount = injuries.filter(i => 
    i.injury_status.toLowerCase().includes("out") || 
    i.injury_status.toLowerCase().includes("ir")
  ).length;
  
  const questionableCount = injuries.filter(i => 
    i.injury_status.toLowerCase().includes("questionable") ||
    i.injury_status.toLowerCase().includes("doubtful")
  ).length;

  const sizeClasses = {
    xs: "h-3.5 w-3.5",
    sm: "h-4 w-4",
    md: "h-5 w-5",
  };

  const textSizes = {
    xs: "text-2xs",
    sm: "text-xs",
    md: "text-sm",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded cursor-help",
              outCount > 0 ? "bg-destructive/10" : "bg-yellow-500/10"
            )}
          >
            <AlertTriangle className={cn(
              sizeClasses[size],
              outCount > 0 ? "text-destructive" : "text-yellow-500"
            )} />
            <span className={cn(
              textSizes[size],
              "font-medium",
              outCount > 0 ? "text-destructive" : "text-yellow-500"
            )}>
              {injuries.length}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="max-w-xs p-2"
        >
          <div className="space-y-1">
            <div className="font-semibold text-xs mb-1.5">
              {teamAbbrev} Injuries ({injuries.length})
            </div>
            {injuries.slice(0, 6).map((injury, idx) => {
              const colors = getStatusColor(injury.injury_status);
              return (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded font-medium shrink-0",
                    colors.bg, colors.text
                  )}>
                    {injury.injury_status}
                  </span>
                  <span className="truncate">
                    {injury.position && <span className="text-muted-foreground">{injury.position} </span>}
                    {injury.player_name}
                  </span>
                </div>
              );
            })}
            {injuries.length > 6 && (
              <div className="text-2xs text-muted-foreground pt-1">
                +{injuries.length - 6} more
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
