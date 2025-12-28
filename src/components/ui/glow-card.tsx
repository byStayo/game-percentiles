import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "edge" | "primary" | "success" | "warning";
  intensity?: "subtle" | "medium" | "strong";
}

const glowColors = {
  edge: "shadow-edge-glow border-status-edge/30",
  primary: "shadow-[0_0_20px_-5px_hsl(var(--primary)/0.3)] border-primary/30",
  success: "shadow-[0_0_20px_-5px_hsl(var(--status-under)/0.3)] border-status-under/30",
  warning: "shadow-[0_0_20px_-5px_hsl(var(--status-over)/0.3)] border-status-over/30",
};

const intensities = {
  subtle: "opacity-50",
  medium: "opacity-75",
  strong: "opacity-100",
};

export function GlowCard({ 
  children, 
  className, 
  glowColor = "edge",
  intensity = "medium" 
}: GlowCardProps) {
  return (
    <div 
      className={cn(
        "relative rounded-2xl bg-card border-2 overflow-hidden transition-all duration-300",
        glowColors[glowColor],
        intensities[intensity],
        className
      )}
    >
      {/* Gradient border effect */}
      <div 
        className={cn(
          "absolute inset-0 opacity-10 pointer-events-none",
          glowColor === "edge" && "bg-gradient-to-br from-status-edge/20 via-transparent to-status-edge/10",
          glowColor === "primary" && "bg-gradient-to-br from-primary/20 via-transparent to-primary/10",
          glowColor === "success" && "bg-gradient-to-br from-status-under/20 via-transparent to-status-under/10",
          glowColor === "warning" && "bg-gradient-to-br from-status-over/20 via-transparent to-status-over/10"
        )}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
