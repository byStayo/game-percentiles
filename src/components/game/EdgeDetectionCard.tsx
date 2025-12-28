import { TrendingUp, TrendingDown, Zap, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlternateLine {
  point: number;
  over_price: number;
  under_price: number;
}

interface EdgeDetectionCardProps {
  p05: number | null;
  p95: number | null;
  p95OverLine: number | null;
  p95OverOdds: number | null;
  p05UnderLine: number | null;
  p05UnderOdds: number | null;
  bestOverEdge: number | null;
  bestUnderEdge: number | null;
  alternateLines: AlternateLine[] | null;
  dkTotalLine: number | null;
}

function formatOdds(odds: number): string {
  if (odds >= 0) return `+${odds}`;
  return odds.toString();
}

function getOddsColor(odds: number): string {
  if (odds >= 200) return "text-status-live"; // Great value
  if (odds >= 100) return "text-green-500";
  if (odds >= -110) return "text-yellow-500";
  return "text-muted-foreground";
}

function getEdgeStrengthInfo(edge: number | null): { label: string; color: string } {
  if (edge === null || edge <= 0) return { label: "", color: "" };
  if (edge > 2) return { label: "Strong", color: "text-status-live" };
  if (edge >= 1) return { label: "Moderate", color: "text-yellow-500" };
  return { label: "Weak", color: "text-muted-foreground" };
}

export function EdgeDetectionCard({
  p05,
  p95,
  p95OverLine,
  p95OverOdds,
  p05UnderLine,
  p05UnderOdds,
  bestOverEdge,
  bestUnderEdge,
  alternateLines,
  dkTotalLine,
}: EdgeDetectionCardProps) {
  const hasEdgeData = p95OverLine !== null || p05UnderLine !== null;
  const hasAlternates = alternateLines && alternateLines.length > 0;
  
  if (!hasEdgeData && !hasAlternates) {
    return null;
  }

  // Find lines near historical percentiles
  const linesNearP95 = alternateLines?.filter(line => 
    p95 !== null && Math.abs(line.point - p95) <= 3
  ).sort((a, b) => b.point - a.point).slice(0, 3) || [];

  const linesNearP05 = alternateLines?.filter(line => 
    p05 !== null && Math.abs(line.point - p05) <= 3
  ).sort((a, b) => a.point - b.point).slice(0, 3) || [];

  return (
    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
        <Zap className="h-4 w-4 text-status-live" />
        <h2 className="text-sm font-semibold">Edge Detection</h2>
        <span className="text-2xs text-muted-foreground ml-auto">
          vs Historical Percentiles
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Main Edges */}
        <div className="grid grid-cols-2 gap-4">
          {/* Over Edge (P95) */}
          <div className={cn(
            "p-4 rounded-xl border",
            p95OverLine !== null 
              ? "bg-status-over/5 border-status-over/20" 
              : "bg-muted/30 border-border/40"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-status-over" />
              <span className="text-xs font-medium text-muted-foreground">OVER Edge</span>
            </div>
            
            {p95OverLine !== null && p95OverOdds !== null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums">O{p95OverLine}</span>
                  <span className={cn("text-lg font-semibold tabular-nums", getOddsColor(p95OverOdds))}>
                    {formatOdds(p95OverOdds)}
                  </span>
                </div>
                <div className="text-2xs text-muted-foreground mt-1 flex items-center gap-1">
                  <span>Near P95 ({p95?.toFixed(0)})</span>
                  <span>•</span>
                  <span className={getEdgeStrengthInfo(bestOverEdge).color}>
                    {bestOverEdge?.toFixed(1) || 0} pts {getEdgeStrengthInfo(bestOverEdge).label}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No lines near P95
              </div>
            )}
          </div>

          {/* Under Edge (P05) */}
          <div className={cn(
            "p-4 rounded-xl border",
            p05UnderLine !== null 
              ? "bg-status-under/5 border-status-under/20" 
              : "bg-muted/30 border-border/40"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-status-under" />
              <span className="text-xs font-medium text-muted-foreground">UNDER Edge</span>
            </div>
            
            {p05UnderLine !== null && p05UnderOdds !== null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums">U{p05UnderLine}</span>
                  <span className={cn("text-lg font-semibold tabular-nums", getOddsColor(p05UnderOdds))}>
                    {formatOdds(p05UnderOdds)}
                  </span>
                </div>
                <div className="text-2xs text-muted-foreground mt-1 flex items-center gap-1">
                  <span>Near P05 ({p05?.toFixed(0)})</span>
                  <span>•</span>
                  <span className={getEdgeStrengthInfo(bestUnderEdge).color}>
                    {bestUnderEdge?.toFixed(1) || 0} pts {getEdgeStrengthInfo(bestUnderEdge).label}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No lines near P05
              </div>
            )}
          </div>
        </div>

        {/* Alternate Lines Near Percentiles */}
        {(linesNearP95.length > 0 || linesNearP05.length > 0) && (
          <div className="pt-3 border-t border-border/40">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Alternate Lines Near Edges</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Lines near P95 (OVER plays) */}
              {linesNearP95.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-2xs uppercase tracking-wide text-status-over font-medium">
                    Near P95 ({p95?.toFixed(0)})
                  </span>
                  {linesNearP95.map((line, idx) => (
                    <div 
                      key={`over-${idx}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-status-over/5"
                    >
                      <span className="text-sm font-medium tabular-nums">O{line.point}</span>
                      <span className={cn("text-sm font-semibold tabular-nums", getOddsColor(line.over_price))}>
                        {formatOdds(line.over_price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Lines near P05 (UNDER plays) */}
              {linesNearP05.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-2xs uppercase tracking-wide text-status-under font-medium">
                    Near P05 ({p05?.toFixed(0)})
                  </span>
                  {linesNearP05.map((line, idx) => (
                    <div 
                      key={`under-${idx}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-status-under/5"
                    >
                      <span className="text-sm font-medium tabular-nums">U{line.point}</span>
                      <span className={cn("text-sm font-semibold tabular-nums", getOddsColor(line.under_price))}>
                        {formatOdds(line.under_price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Explanation */}
        <div className="pt-3 border-t border-border/40">
          <p className="text-2xs text-muted-foreground">
            <strong>Edge Detection</strong> finds DraftKings alternate lines at or beyond historical extremes. 
            Lines near P95 may offer value on OVER bets (historically only 5% of games scored higher). 
            Lines near P05 may offer UNDER value (only 5% scored lower).
          </p>
        </div>
      </div>
    </div>
  );
}