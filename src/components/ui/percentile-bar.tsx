import { cn } from "@/lib/utils";

interface PercentileBarProps {
  p05: number;
  p95: number;
  dkLine?: number | null;
  dkPercentile?: number | null;
  finalTotal?: number | null;
  className?: string;
}

export function PercentileBar({
  p05,
  p95,
  dkLine,
  dkPercentile,
  finalTotal,
  className,
}: PercentileBarProps) {
  const range = p95 - p05;
  const padding = range * 0.15;
  const min = Math.max(0, p05 - padding);
  const max = p95 + padding;
  const totalRange = max - min;

  const p05Position = ((p05 - min) / totalRange) * 100;
  const p95Position = ((p95 - min) / totalRange) * 100;
  const p50Value = (p05 + p95) / 2;
  const p50Position = ((p50Value - min) / totalRange) * 100;
  const dkPosition =
    dkLine != null
      ? Math.min(Math.max(((dkLine - min) / totalRange) * 100, 4), 96)
      : null;
  const finalPosition =
    finalTotal != null
      ? Math.min(Math.max(((finalTotal - min) / totalRange) * 100, 2), 98)
      : null;

  const hasDkLine = dkLine != null && dkPercentile != null;
  const P = dkPercentile != null ? Math.round(dkPercentile) : null;

  const getMarkerColor = () => {
    if (P === null) return "bg-muted-foreground";
    if (P <= 30) return "bg-status-over";
    if (P >= 70) return "bg-status-under";
    return "bg-foreground";
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Labels row */}
      <div className="flex justify-between items-end text-xs">
        <div className="text-center">
          <div className="text-muted-foreground font-medium">P05</div>
          <div className="font-bold tabular-nums">{p05.toFixed(1)}</div>
        </div>

        {hasDkLine ? (
          <div className="text-center">
            <div className="text-muted-foreground font-medium">
              DK {dkLine.toFixed(1)}
            </div>
            <div
              className={cn(
                "font-bold tabular-nums",
                P !== null && P <= 30 && "text-status-over",
                P !== null && P >= 70 && "text-status-under"
              )}
            >
              P={P}
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground text-2xs">
            DK line not found
          </div>
        )}

        <div className="text-center">
          <div className="text-muted-foreground font-medium">P95</div>
          <div className="font-bold tabular-nums">{p95.toFixed(1)}</div>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-2.5 bg-secondary rounded-full overflow-visible">
        {/* Range fill */}
        <div
          className="absolute h-full bg-gradient-to-r from-status-over/30 via-muted/50 to-status-under/30 rounded-full"
          style={{
            left: `${p05Position}%`,
            width: `${p95Position - p05Position}%`,
          }}
        />

        {/* P05 tick */}
        <div
          className="absolute top-1/2 w-0.5 h-4 bg-muted-foreground/40 -translate-y-1/2"
          style={{ left: `${p05Position}%` }}
        />

        {/* P50 tick (median) */}
        <div
          className="absolute top-1/2 w-0.5 h-3 bg-muted-foreground/30 -translate-y-1/2"
          style={{ left: `${p50Position}%` }}
        />

        {/* P95 tick */}
        <div
          className="absolute top-1/2 w-0.5 h-4 bg-muted-foreground/40 -translate-y-1/2"
          style={{ left: `${p95Position}%` }}
        />

        {/* Final total marker (diamond) */}
        {finalPosition !== null && (
          <div
            className={cn(
              "absolute top-1/2 w-3 h-3 rotate-45 border-2 border-background shadow-sm",
              finalTotal! > (dkLine ?? 0)
                ? "bg-status-over"
                : finalTotal! < (dkLine ?? 0)
                ? "bg-status-under"
                : "bg-foreground"
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
              "absolute top-1/2 w-3.5 h-3.5 rounded-full shadow-sm ring-2 ring-background",
              getMarkerColor(),
              finalTotal != null && "opacity-60"
            )}
            style={{
              left: `${dkPosition}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>

      {/* Final result */}
      {finalTotal != null && dkLine != null && (
        <div className="text-center text-xs text-muted-foreground">
          Final: <span className="font-semibold text-foreground">{finalTotal}</span>
          {" → "}
          <span
            className={cn(
              "font-semibold",
              finalTotal > dkLine
                ? "text-status-over"
                : finalTotal < dkLine
                ? "text-status-under"
                : "text-foreground"
            )}
          >
            {finalTotal > dkLine ? "OVER" : finalTotal < dkLine ? "UNDER" : "PUSH"}
          </span>
        </div>
      )}
    </div>
  );
}
