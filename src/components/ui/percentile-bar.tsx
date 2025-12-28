import { cn } from "@/lib/utils";

interface PercentileBarProps {
  p05: number;
  p95: number;
  dkLine?: number | null;
  dkPercentile?: number | null;
  finalTotal?: number | null;
  compact?: boolean;
  className?: string;
}

export function PercentileBar({
  p05,
  p95,
  dkLine,
  dkPercentile,
  finalTotal,
  compact = false,
  className,
}: PercentileBarProps) {
  const range = p95 - p05;
  const padding = range * 0.1;
  const min = Math.max(0, p05 - padding);
  const max = p95 + padding;
  const totalRange = max - min;

  const p05Position = ((p05 - min) / totalRange) * 100;
  const p95Position = ((p95 - min) / totalRange) * 100;
  const dkPosition =
    dkLine != null
      ? Math.min(Math.max(((dkLine - min) / totalRange) * 100, 5), 95)
      : null;
  const finalPosition =
    finalTotal != null
      ? Math.min(Math.max(((finalTotal - min) / totalRange) * 100, 3), 97)
      : null;

  const P = dkPercentile != null ? Math.round(dkPercentile) : null;

  // Determine zone: low = over value, high = under value
  const getZone = () => {
    if (P === null) return "neutral";
    if (P <= 30) return "over"; // Line is low → expect over
    if (P >= 70) return "under"; // Line is high → expect under
    return "neutral";
  };

  const zone = getZone();

  if (compact) {
    return (
      <div className={cn("space-y-1", className)}>
        {/* Simplified bar for mobile */}
        <div className="relative h-1.5 bg-secondary rounded-full overflow-visible">
          {/* Historical range */}
          <div
            className="absolute h-full bg-muted-foreground/20 rounded-full"
            style={{
              left: `${p05Position}%`,
              width: `${p95Position - p05Position}%`,
            }}
          />

          {/* DK Line marker */}
          {dkPosition !== null && (
            <div
              className={cn(
                "absolute top-1/2 w-2.5 h-2.5 rounded-full ring-1 ring-background",
                zone === "over" && "bg-status-over",
                zone === "under" && "bg-status-under",
                zone === "neutral" && "bg-muted-foreground"
              )}
              style={{
                left: `${dkPosition}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}

          {/* Final result marker */}
          {finalPosition !== null && (
            <div
              className={cn(
                "absolute top-1/2 w-2 h-2 rotate-45 ring-1 ring-background",
                finalTotal! > (dkLine ?? 0) ? "bg-status-over" : "bg-status-under"
              )}
              style={{
                left: `${finalPosition}%`,
                transform: "translate(-50%, -50%) rotate(45deg)",
              }}
            />
          )}
        </div>

        {/* Mini labels */}
        <div className="flex justify-between text-2xs text-muted-foreground tabular-nums">
          <span>{p05}</span>
          {dkLine && <span className="font-medium text-foreground">Line: {dkLine}</span>}
          <span>{p95}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Bar with labels inline */}
      <div className="relative h-2 bg-secondary rounded-full overflow-visible">
        {/* Historical range fill */}
        <div
          className={cn(
            "absolute h-full rounded-full",
            zone === "over" && "bg-status-over/20",
            zone === "under" && "bg-status-under/20",
            zone === "neutral" && "bg-muted-foreground/15"
          )}
          style={{
            left: `${p05Position}%`,
            width: `${p95Position - p05Position}%`,
          }}
        />

        {/* P05 tick */}
        <div
          className="absolute top-1/2 w-0.5 h-3 bg-muted-foreground/40 -translate-y-1/2"
          style={{ left: `${p05Position}%` }}
        />

        {/* P95 tick */}
        <div
          className="absolute top-1/2 w-0.5 h-3 bg-muted-foreground/40 -translate-y-1/2"
          style={{ left: `${p95Position}%` }}
        />

        {/* Final total marker (diamond) */}
        {finalPosition !== null && (
          <div
            className={cn(
              "absolute top-1/2 w-2.5 h-2.5 rotate-45 ring-2 ring-background shadow-sm",
              finalTotal! > (dkLine ?? 0) ? "bg-status-over" : "bg-status-under"
            )}
            style={{
              left: `${finalPosition}%`,
              transform: "translate(-50%, -50%) rotate(45deg)",
            }}
          />
        )}

        {/* DK Line marker (circle) */}
        {dkPosition !== null && (
          <div
            className={cn(
              "absolute top-1/2 w-3 h-3 rounded-full shadow-sm ring-2 ring-background",
              zone === "over" && "bg-status-over",
              zone === "under" && "bg-status-under",
              zone === "neutral" && "bg-foreground",
              finalTotal != null && "opacity-50"
            )}
            style={{
              left: `${dkPosition}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>

      {/* Labels row - simplified */}
      <div className="flex justify-between items-center text-xs tabular-nums">
        <span className="text-muted-foreground">{p05}</span>
        
        {dkLine != null ? (
          <span className={cn(
            "font-medium",
            zone === "over" && "text-status-over",
            zone === "under" && "text-status-under",
            zone === "neutral" && "text-muted-foreground"
          )}>
            Line: {dkLine}
          </span>
        ) : (
          <span className="text-muted-foreground/60">No line</span>
        )}
        
        <span className="text-muted-foreground">{p95}</span>
      </div>

      {/* Final result - only show when game is final */}
      {finalTotal != null && dkLine != null && (
        <div className="text-center text-xs">
          <span className="text-muted-foreground">Final: </span>
          <span className="font-semibold">{finalTotal}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span
            className={cn(
              "font-bold",
              finalTotal > dkLine ? "text-status-over" : "text-status-under"
            )}
          >
            {finalTotal > dkLine ? "OVER ✓" : finalTotal < dkLine ? "UNDER ✓" : "PUSH"}
          </span>
        </div>
      )}
    </div>
  );
}
