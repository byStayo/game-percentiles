import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CalendarDays, Sparkles } from "lucide-react";

interface GameHistoryItem {
  id: number;
  played_at: string;
  total: number;
}

interface GamesPerYearChartProps {
  history: GameHistoryItem[];
  className?: string;
}

export function GamesPerYearChart({ history, className }: GamesPerYearChartProps) {
  // Group games by year
  const yearData = useMemo(() => {
    const byYear: Record<number, { count: number; totals: number[]; avg: number }> = {};
    
    history.forEach((game) => {
      const year = new Date(game.played_at).getFullYear();
      if (!byYear[year]) {
        byYear[year] = { count: 0, totals: [], avg: 0 };
      }
      byYear[year].count++;
      byYear[year].totals.push(game.total);
    });
    
    // Calculate averages
    Object.keys(byYear).forEach((year) => {
      const data = byYear[Number(year)];
      data.avg = data.totals.reduce((a, b) => a + b, 0) / data.totals.length;
    });
    
    // Sort by year descending
    const sorted = Object.entries(byYear)
      .map(([year, data]) => ({ year: Number(year), ...data }))
      .sort((a, b) => b.year - a.year);
    
    return sorted;
  }, [history]);

  const maxCount = Math.max(...yearData.map((d) => d.count), 1);
  const currentYear = new Date().getFullYear();
  const has2025Data = yearData.some(d => d.year === 2025);
  const games2025 = yearData.find(d => d.year === 2025);

  if (yearData.length === 0) return null;

  return (
    <div className={cn("bg-card rounded-2xl border border-border/60 p-5", className)}>
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Games by Year</h2>
        {has2025Data && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-2xs font-medium">
            <Sparkles className="h-3 w-3" />
            2025 data
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {history.length} total
        </span>
      </div>
      
      <div className="space-y-2">
        {yearData.map((data) => {
          const is2025 = data.year === 2025;
          const isRecent = currentYear - data.year <= 3;
          const barWidth = (data.count / maxCount) * 100;
          
          return (
            <div key={data.year} className={cn(
              "flex items-center gap-3",
              is2025 && "relative"
            )}>
              {is2025 && (
                <div className="absolute -left-1 -right-1 -top-1 -bottom-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 pointer-events-none" />
              )}
              <span className={cn(
                "w-12 text-xs font-medium tabular-nums relative z-10",
                is2025 ? "text-emerald-400 font-bold" : isRecent ? "text-foreground" : "text-muted-foreground"
              )}>
                {data.year}
                {is2025 && <span className="ml-0.5 text-emerald-500">★</span>}
              </span>
              
              <div className={cn(
                "flex-1 h-6 rounded-md overflow-hidden relative z-10",
                is2025 ? "bg-emerald-950/50" : "bg-secondary/50"
              )}>
                <div
                  className={cn(
                    "h-full rounded-md transition-all duration-300",
                    is2025 ? "bg-gradient-to-r from-emerald-600 to-emerald-500" : 
                    isRecent ? "bg-primary/60" : "bg-muted-foreground/30"
                  )}
                  style={{ width: `${barWidth}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-2">
                  <span className={cn(
                    "text-2xs font-semibold",
                    is2025 ? "text-white" :
                    barWidth > 30 ? "text-primary-foreground" : "text-foreground"
                  )}>
                    {data.count} {data.count === 1 ? "game" : "games"}
                  </span>
                  <span className={cn(
                    "text-2xs tabular-nums",
                    is2025 ? "text-emerald-200" : "text-muted-foreground"
                  )}>
                    avg: {data.avg.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Recency indicator */}
      <div className="mt-4 pt-3 border-t border-border/40">
        <div className="flex items-center justify-between text-2xs">
          <div className="flex items-center gap-3">
            {games2025 && (
              <span className="text-emerald-400 font-medium">
                2025: {games2025.count} {games2025.count === 1 ? "game" : "games"}
              </span>
            )}
            <span className="text-muted-foreground">
              Recent (3y): {yearData.filter(d => currentYear - d.year <= 3 && d.year !== 2025).reduce((sum, d) => sum + d.count, 0)}
            </span>
          </div>
          <span className="text-muted-foreground">
            Historical: {yearData.filter(d => currentYear - d.year > 3).reduce((sum, d) => sum + d.count, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}