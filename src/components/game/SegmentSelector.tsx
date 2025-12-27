import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Clock, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SegmentKey = 
  | "h2h_1y" 
  | "h2h_3y" 
  | "h2h_5y" 
  | "h2h_10y" 
  | "h2h_20y" 
  | "h2h_all"
  | "recency_weighted"
  | "decade_2020s"
  | "decade_2010s"
  | "decade_2000s"
  | "decade_1990s";

export interface SegmentAvailability {
  segment: SegmentKey;
  nGames: number;
  isRecommended?: boolean;
}

interface SegmentSelectorProps {
  value: SegmentKey;
  onChange: (value: SegmentKey) => void;
  disabled?: boolean;
  /** Optional segment availability data for smart recommendations */
  availability?: SegmentAvailability[];
  /** Show smart recommendation badge */
  showRecommendation?: boolean;
}

const timeWindowSegments: { key: SegmentKey; label: string }[] = [
  { key: "recency_weighted", label: "Recency Weighted" },
  { key: "h2h_1y", label: "Last 1 Year" },
  { key: "h2h_3y", label: "Last 3 Years" },
  { key: "h2h_5y", label: "Last 5 Years" },
  { key: "h2h_10y", label: "Last 10 Years" },
  { key: "h2h_20y", label: "Last 20 Years" },
  { key: "h2h_all", label: "All-Time" },
];

const decadeSegments: { key: SegmentKey; label: string }[] = [
  { key: "decade_2020s", label: "2020s" },
  { key: "decade_2010s", label: "2010s" },
  { key: "decade_2000s", label: "2000s" },
  { key: "decade_1990s", label: "1990s" },
];

const allSegmentLabels: Record<SegmentKey, string> = {
  recency_weighted: "Recency Weighted",
  h2h_1y: "Last 1 Year",
  h2h_3y: "Last 3 Years",
  h2h_5y: "Last 5 Years",
  h2h_10y: "Last 10 Years",
  h2h_20y: "Last 20 Years",
  h2h_all: "All-Time",
  decade_2020s: "2020s",
  decade_2010s: "2010s",
  decade_2000s: "2000s",
  decade_1990s: "1990s",
};

const MIN_GAMES_THRESHOLD = 5;

/**
 * Determine the best segment based on data availability
 * Prioritizes recency with sufficient sample size
 */
export function getRecommendedSegment(availability: SegmentAvailability[]): SegmentKey {
  const bySegment = new Map(availability.map(a => [a.segment, a.nGames]));
  
  // Priority order: prefer recency-weighted if enough data, then increasingly longer windows
  const priorityOrder: SegmentKey[] = [
    "recency_weighted",
    "h2h_3y",
    "h2h_5y", 
    "h2h_10y",
    "h2h_20y",
    "h2h_all",
  ];
  
  for (const segment of priorityOrder) {
    const nGames = bySegment.get(segment);
    if (nGames && nGames >= MIN_GAMES_THRESHOLD) {
      return segment;
    }
  }
  
  // Fall back to all-time even if insufficient
  return "h2h_all";
}

export function SegmentSelector({ 
  value, 
  onChange, 
  disabled,
  availability,
  showRecommendation = true,
}: SegmentSelectorProps) {
  const recommendedSegment = useMemo(() => {
    if (!availability || availability.length === 0) return null;
    return getRecommendedSegment(availability);
  }, [availability]);

  const availabilityMap = useMemo(() => {
    if (!availability) return null;
    return new Map(availability.map(a => [a.segment, a.nGames]));
  }, [availability]);

  const isCurrentRecommended = recommendedSegment === value;

  const renderSegmentItem = (key: SegmentKey, label: string) => {
    const nGames = availabilityMap?.get(key);
    const isRecommended = key === recommendedSegment;
    const hasEnoughData = nGames !== undefined && nGames >= MIN_GAMES_THRESHOLD;
    const hasNoData = nGames !== undefined && nGames === 0;

    return (
      <SelectItem 
        key={key} 
        value={key} 
        className={cn(
          "text-xs",
          hasNoData && "opacity-50"
        )}
        disabled={hasNoData}
      >
        <div className="flex items-center gap-2 w-full">
          <span className={cn(isRecommended && "font-medium")}>{label}</span>
          {nGames !== undefined && (
            <span className={cn(
              "text-2xs tabular-nums ml-auto",
              hasEnoughData ? "text-muted-foreground" : "text-status-over"
            )}>
              n={nGames}
            </span>
          )}
          {isRecommended && showRecommendation && (
            <Sparkles className="h-3 w-3 text-primary" />
          )}
        </div>
      </SelectItem>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {showRecommendation && recommendedSegment && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "p-1 rounded",
              isCurrentRecommended ? "text-primary" : "text-muted-foreground"
            )}>
              {isCurrentRecommended ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            {isCurrentRecommended 
              ? "Using recommended segment"
              : `Recommended: ${allSegmentLabels[recommendedSegment]}`
            }
          </TooltipContent>
        </Tooltip>
      )}
      {!showRecommendation && <Clock className="h-4 w-4 text-muted-foreground" />}
      
      <Select value={value} onValueChange={(v) => onChange(v as SegmentKey)} disabled={disabled}>
        <SelectTrigger className="w-[160px] h-8 text-xs bg-card">
          <SelectValue placeholder="Time Window">
            <div className="flex items-center gap-1.5">
              <span>{allSegmentLabels[value]}</span>
              {isCurrentRecommended && showRecommendation && (
                <Sparkles className="h-3 w-3 text-primary" />
              )}
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover border border-border z-50">
          {recommendedSegment && showRecommendation && (
            <>
              <SelectGroup>
                <SelectLabel className="text-2xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Recommended
                </SelectLabel>
                {renderSegmentItem(recommendedSegment, allSegmentLabels[recommendedSegment])}
              </SelectGroup>
              <SelectSeparator />
            </>
          )}
          <SelectGroup>
            <SelectLabel className="text-2xs text-muted-foreground">Recent (Most Relevant)</SelectLabel>
            {timeWindowSegments.slice(0, 4).map(({ key, label }) => 
              key !== recommendedSegment && renderSegmentItem(key, label)
            )}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel className="text-2xs text-muted-foreground">Extended History</SelectLabel>
            {timeWindowSegments.slice(4).map(({ key, label }) => 
              key !== recommendedSegment && renderSegmentItem(key, label)
            )}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel className="text-2xs text-muted-foreground">By Decade</SelectLabel>
            {decadeSegments.map(({ key, label }) => 
              key !== recommendedSegment && renderSegmentItem(key, label)
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
