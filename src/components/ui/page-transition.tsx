import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <div 
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out",
        className
      )}
    >
      {children}
    </div>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({ children, className, staggerDelay = 50 }: StaggerContainerProps) {
  return (
    <div 
      className={cn("contents", className)}
      style={{ 
        "--stagger-delay": `${staggerDelay}ms` 
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  index: number;
  className?: string;
}

export function StaggerItem({ children, index, className }: StaggerItemProps) {
  return (
    <div 
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out fill-mode-backwards",
        className
      )}
      style={{ 
        animationDelay: `${index * 50}ms` 
      }}
    >
      {children}
    </div>
  );
}
