import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  color?: "primary" | "success" | "warning" | "muted";
  showDots?: boolean;
}

const colors = {
  primary: "stroke-primary",
  success: "stroke-status-under",
  warning: "stroke-status-over",
  muted: "stroke-muted-foreground",
};

const fillColors = {
  primary: "fill-primary/10",
  success: "fill-status-under/10",
  warning: "fill-status-over/10",
  muted: "fill-muted/20",
};

export function Sparkline({ 
  data, 
  width = 80, 
  height = 24, 
  className,
  color = "primary",
  showDots = false
}: SparklineProps) {
  const path = useMemo(() => {
    if (data.length < 2) return "";
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + (1 - (value - min) / range) * chartHeight;
      return `${x},${y}`;
    });
    
    return `M${points.join(" L")}`;
  }, [data, width, height]);

  const areaPath = useMemo(() => {
    if (data.length < 2) return "";
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + (1 - (value - min) / range) * chartHeight;
      return `${x},${y}`;
    });
    
    const lastX = padding + chartWidth;
    const firstX = padding;
    const bottomY = height - padding;
    
    return `M${firstX},${bottomY} L${points.join(" L")} L${lastX},${bottomY} Z`;
  }, [data, width, height]);

  if (data.length < 2) {
    return null;
  }

  return (
    <svg 
      width={width} 
      height={height} 
      className={cn("overflow-visible", className)}
    >
      {/* Area fill */}
      <path
        d={areaPath}
        className={cn(fillColors[color])}
      />
      {/* Line */}
      <path
        d={path}
        fill="none"
        className={cn(colors[color], "stroke-[1.5]")}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {showDots && data.length > 0 && (
        <circle
          cx={width - 2}
          cy={2 + (1 - (data[data.length - 1] - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1)) * (height - 4)}
          r={2.5}
          className={cn(colors[color].replace("stroke-", "fill-"))}
        />
      )}
    </svg>
  );
}
