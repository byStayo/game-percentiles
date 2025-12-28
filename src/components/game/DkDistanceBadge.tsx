import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, Target } from "lucide-react";

interface DkDistanceBadgeProps {
  dkLine: number | null;
  p05: number | null;
  p95: number | null;
  showBeyondExtremes?: boolean;
  compact?: boolean;
}

export function DkDistanceBadge({ 
  dkLine, 
  p05, 
  p95, 
  showBeyondExtremes = true,
  compact = false 
}: DkDistanceBadgeProps) {
  if (dkLine === null || p05 === null || p95 === null) return null;

  const distanceToP05 = dkLine - p05;
  const distanceToP95 = p95 - dkLine;
  
  // Check if DK line is beyond extremes
  const isBelowP05 = dkLine < p05;
  const isAboveP95 = dkLine > p95;
  const isBeyondExtremes = isBelowP05 || isAboveP95;
  
  // Calculate distance from nearest percentile
  const nearestDistance = Math.min(Math.abs(distanceToP05), Math.abs(distanceToP95));
  const isCloserToP05 = Math.abs(distanceToP05) < Math.abs(distanceToP95);
  
  // Get badge styling based on position
  const getBadgeStyle = () => {
    if (isBeyondExtremes) {
      return "bg-status-live/20 text-status-live border-status-live/40 animate-pulse";
    }
    if (nearestDistance <= 3) {
      return "bg-status-edge/20 text-status-edge border-status-edge/40";
    }
    if (nearestDistance <= 6) {
      return "bg-yellow-500/20 text-yellow-600 border-yellow-500/40";
    }
    return "bg-muted/50 text-muted-foreground border-border";
  };

  const getLabel = () => {
    if (isBelowP05) {
      return `${Math.abs(distanceToP05).toFixed(1)} below P5`;
    }
    if (isAboveP95) {
      return `${Math.abs(distanceToP95).toFixed(1)} above P95`;
    }
    if (isCloserToP05) {
      return `${distanceToP05.toFixed(1)} from P5`;
    }
    return `${distanceToP95.toFixed(1)} from P95`;
  };

  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className={cn("text-2xs gap-1", getBadgeStyle())}
      >
        {isBeyondExtremes && <AlertTriangle className="h-2.5 w-2.5" />}
        {nearestDistance.toFixed(1)}pt
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn("text-2xs gap-1", getBadgeStyle())}
    >
      {isBeyondExtremes ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Target className="h-3 w-3" />
      )}
      {getLabel()}
    </Badge>
  );
}

// Utility to check if DK line extends beyond historical extremes
export function isDkBeyondExtremes(dkLine: number | null, p05: number | null, p95: number | null): boolean {
  if (dkLine === null || p05 === null || p95 === null) return false;
  return dkLine < p05 || dkLine > p95;
}

// Visual indicator specifically for beyond extremes warning
export function BeyondExtremesWarning({ 
  dkLine, 
  p05, 
  p95 
}: { 
  dkLine: number | null; 
  p05: number | null; 
  p95: number | null;
}) {
  if (!isDkBeyondExtremes(dkLine, p05, p95)) return null;
  
  const isBelowP05 = dkLine! < p05!;
  const distance = isBelowP05 
    ? Math.abs(dkLine! - p05!) 
    : Math.abs(dkLine! - p95!);

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
      "bg-status-live/10 border border-status-live/30 text-status-live"
    )}>
      <AlertTriangle className="h-4 w-4 animate-pulse" />
      <span>
        DK line is {distance.toFixed(1)} pts {isBelowP05 ? "below" : "above"} historical {isBelowP05 ? "P5" : "P95"}!
      </span>
    </div>
  );
}
