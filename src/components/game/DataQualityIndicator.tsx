import { cn } from "@/lib/utils";
import { Database, TrendingUp, AlertTriangle, Ban } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DataQualityIndicatorProps {
  nGames: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

type DataQuality = "excellent" | "good" | "fair" | "low" | "insufficient";

function getDataQuality(nGames: number): {
  quality: DataQuality;
  label: string;
  description: string;
  color: string;
  bgColor: string;
} {
  if (nGames >= 20) {
    return {
      quality: "excellent",
      label: "Excellent",
      description: `${nGames} historical matchups provide highly reliable predictions`,
      color: "text-status-live",
      bgColor: "bg-status-live/10",
    };
  }
  if (nGames >= 10) {
    return {
      quality: "good",
      label: "Good",
      description: `${nGames} historical matchups provide solid predictions`,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    };
  }
  if (nGames >= 5) {
    return {
      quality: "fair",
      label: "Fair",
      description: `${nGames} historical matchups - predictions are reasonable`,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    };
  }
  if (nGames >= 1) {
    return {
      quality: "low",
      label: "Low",
      description: `Only ${nGames} historical matchup${nGames > 1 ? "s" : ""} - use caution`,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    };
  }
  return {
    quality: "insufficient",
    label: "No Data",
    description: "No historical matchups available",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  };
}

const qualityIcons: Record<DataQuality, React.ReactNode> = {
  excellent: <TrendingUp className="h-3 w-3" />,
  good: <Database className="h-3 w-3" />,
  fair: <Database className="h-3 w-3" />,
  low: <AlertTriangle className="h-3 w-3" />,
  insufficient: <Ban className="h-3 w-3" />,
};

export function DataQualityIndicator({
  nGames,
  className,
  showLabel = false,
  size = "sm",
}: DataQualityIndicatorProps) {
  const { quality, label, description, color, bgColor } = getDataQuality(nGames);

  const sizeClasses = {
    sm: "h-5 px-1.5 text-2xs gap-1",
    md: "h-6 px-2 text-xs gap-1.5",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center rounded-md font-medium",
              bgColor,
              color,
              sizeClasses[size],
              className
            )}
          >
            {qualityIcons[quality]}
            {showLabel && <span>{label}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="space-y-1">
            <p className="font-medium">{label} Data Quality</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
