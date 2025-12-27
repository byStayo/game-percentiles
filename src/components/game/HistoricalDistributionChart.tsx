import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface HistoricalDistributionChartProps {
  totals: number[];
  p05: number | null;
  p95: number | null;
  median: number | null;
  dkLine?: number | null;
}

export function HistoricalDistributionChart({
  totals,
  p05,
  p95,
  median,
  dkLine,
}: HistoricalDistributionChartProps) {
  const chartData = useMemo(() => {
    if (totals.length === 0) return [];

    // Create histogram buckets
    const min = Math.floor(Math.min(...totals) / 5) * 5;
    const max = Math.ceil(Math.max(...totals) / 5) * 5;
    const bucketSize = 5;
    const buckets: Record<number, number> = {};

    for (let i = min; i <= max; i += bucketSize) {
      buckets[i] = 0;
    }

    totals.forEach((total) => {
      const bucket = Math.floor(total / bucketSize) * bucketSize;
      if (buckets[bucket] !== undefined) {
        buckets[bucket]++;
      }
    });

    return Object.entries(buckets).map(([range, count]) => ({
      range: Number(range),
      rangeLabel: `${range}-${Number(range) + bucketSize - 1}`,
      count,
    }));
  }, [totals]);

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        No historical data available
      </div>
    );
  }

  const chartConfig = {
    count: {
      label: "Games",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="range"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(value) => String(value)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            allowDecimals={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => [`${value} games`, "Count"]}
                labelFormatter={(label) => `Total: ${label}-${Number(label) + 4}`}
              />
            }
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={30}>
            {chartData.map((entry, index) => {
              const midpoint = entry.range + 2.5;
              let fill = "hsl(var(--muted))";
              if (p05 !== null && p95 !== null) {
                if (midpoint < p05) {
                  fill = "hsl(var(--percentile-low))";
                } else if (midpoint > p95) {
                  fill = "hsl(var(--percentile-high))";
                } else {
                  fill = "hsl(var(--primary))";
                }
              }
              return <Cell key={`cell-${index}`} fill={fill} />;
            })}
          </Bar>
          {p05 !== null && (
            <ReferenceLine
              x={Math.floor(p05 / 5) * 5}
              stroke="hsl(var(--percentile-low))"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `P5: ${p05.toFixed(0)}`,
                position: "top",
                fill: "hsl(var(--percentile-low))",
                fontSize: 10,
              }}
            />
          )}
          {p95 !== null && (
            <ReferenceLine
              x={Math.floor(p95 / 5) * 5}
              stroke="hsl(var(--percentile-high))"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `P95: ${p95.toFixed(0)}`,
                position: "top",
                fill: "hsl(var(--percentile-high))",
                fontSize: 10,
              }}
            />
          )}
          {dkLine !== null && (
            <ReferenceLine
              x={Math.floor(dkLine / 5) * 5}
              stroke="hsl(var(--chart-5))"
              strokeWidth={2}
              label={{
                value: `DK: ${dkLine.toFixed(1)}`,
                position: "insideTopRight",
                fill: "hsl(var(--chart-5))",
                fontSize: 10,
                fontWeight: 600,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
