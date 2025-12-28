import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { format, startOfWeek, startOfMonth, parseISO, isWithinInterval, subMonths } from "date-fns";
import { BarChart3, TrendingUp, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface ParlayLeg {
  game_id: string;
  sport_id: string;
  pick: "over" | "under";
  line: number;
  hit_probability: number;
  home_team: string;
  away_team: string;
  result?: "hit" | "miss" | "pending";
  final_total?: number;
}

interface LockParlayRecord {
  id: string;
  created_at: string;
  num_legs: number;
  legs_hit: number;
  legs_pending: number;
  is_complete: boolean;
  is_win: boolean;
  combined_probability: number;
  legs: ParlayLeg[];
}

type TimeRange = "week" | "month";

interface LockParlayChartProps {
  history: LockParlayRecord[];
}

export function LockParlayChart({ history }: LockParlayChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [chartType, setChartType] = useState<"line" | "bar">("bar");

  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];

    // Group parlays by time period
    const groupedData = new Map<string, {
      total: number;
      wins: number;
      completed: number;
      legsTotal: number;
      legsHit: number;
    }>();

    // Filter to last 3 months of data
    const threeMonthsAgo = subMonths(new Date(), 3);

    history
      .filter(p => {
        const date = parseISO(p.created_at);
        return isWithinInterval(date, { start: threeMonthsAgo, end: new Date() });
      })
      .forEach(parlay => {
        const date = parseISO(parlay.created_at);
        const periodStart = timeRange === "week" 
          ? startOfWeek(date, { weekStartsOn: 1 })
          : startOfMonth(date);
        const key = format(periodStart, "yyyy-MM-dd");
        
        const existing = groupedData.get(key) || {
          total: 0,
          wins: 0,
          completed: 0,
          legsTotal: 0,
          legsHit: 0,
        };

        existing.total += 1;
        existing.legsTotal += parlay.num_legs;
        existing.legsHit += parlay.legs_hit || 0;
        
        if (parlay.is_complete) {
          existing.completed += 1;
          if (parlay.is_win) {
            existing.wins += 1;
          }
        }

        groupedData.set(key, existing);
      });

    // Convert to array and calculate rates
    return Array.from(groupedData.entries())
      .map(([dateKey, data]) => ({
        date: dateKey,
        label: timeRange === "week"
          ? format(parseISO(dateKey), "MMM d")
          : format(parseISO(dateKey), "MMM yyyy"),
        total: data.total,
        wins: data.wins,
        losses: data.completed - data.wins,
        winRate: data.completed > 0 ? (data.wins / data.completed) * 100 : 0,
        legHitRate: data.legsTotal > 0 ? (data.legsHit / data.legsTotal) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [history, timeRange]);

  if (!history || history.length === 0) {
    return null;
  }

  if (chartData.length < 2) {
    return (
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="py-6 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Need more data across multiple {timeRange}s to show trends
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Performance Trends
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-border/50">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 rounded-none text-xs",
                  timeRange === "week" && "bg-primary/10 text-primary"
                )}
                onClick={() => setTimeRange("week")}
              >
                <Calendar className="h-3 w-3 mr-1" />
                Weekly
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 rounded-none text-xs",
                  timeRange === "month" && "bg-primary/10 text-primary"
                )}
                onClick={() => setTimeRange("month")}
              >
                <Calendar className="h-3 w-3 mr-1" />
                Monthly
              </Button>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-border/50">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 rounded-none text-xs",
                  chartType === "bar" && "bg-primary/10 text-primary"
                )}
                onClick={() => setChartType("bar")}
              >
                <BarChart3 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 rounded-none text-xs",
                  chartType === "line" && "bg-primary/10 text-primary"
                )}
                onClick={() => setChartType("line")}
              >
                <TrendingUp className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) => {
                    if (name === "winRate" || name === "legHitRate") {
                      return [`${value.toFixed(1)}%`, name === "winRate" ? "Win Rate" : "Leg Hit Rate"];
                    }
                    return [value, name === "wins" ? "Wins" : "Losses"];
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value) => value === "wins" ? "Wins" : "Losses"}
                />
                <Bar dataKey="wins" stackId="a" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="losses" stackId="a" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)}%`,
                    name === "winRate" ? "Win Rate" : "Leg Hit Rate"
                  ]}
                />
                <Legend 
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value) => value === "winRate" ? "Win Rate" : "Leg Hit Rate"}
                />
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(142, 76%, 36%)", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="legHitRate"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(217, 91%, 60%)", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
        
        {/* Summary row */}
        <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span className="text-muted-foreground">
              Avg Win Rate: {(chartData.reduce((sum, d) => sum + d.winRate, 0) / chartData.length).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-muted-foreground">
              Avg Leg Hit: {(chartData.reduce((sum, d) => sum + d.legHitRate, 0) / chartData.length).toFixed(0)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
