import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface StickyFiltersProps {
  children: ReactNode;
  className?: string;
  offset?: number;
}

export function StickyFilters({ children, className, offset = 60 }: StickyFiltersProps) {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    const container = containerRef.current;
    if (!element || !container) return;

    // Measure the height to prevent layout shift when sticky
    const measureHeight = () => {
      if (container) {
        setPlaceholderHeight(container.offsetHeight);
      }
    };

    measureHeight();
    
    // Use ResizeObserver to track size changes
    const resizeObserver = new ResizeObserver(measureHeight);
    resizeObserver.observe(container);

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { 
        threshold: 0, 
        rootMargin: `-${offset}px 0px 0px 0px` 
      }
    );

    observer.observe(element);
    
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [offset]);

  return (
    <>
      {/* Sentinel element for intersection observer */}
      <div ref={ref} className="h-0 w-full" aria-hidden="true" />
      
      {/* Placeholder to prevent layout shift */}
      {isSticky && (
        <div 
          style={{ height: placeholderHeight }} 
          className="w-full" 
          aria-hidden="true" 
        />
      )}
      
      {/* Sticky container */}
      <div
        ref={containerRef}
        className={cn(
          "w-full transition-all duration-200 ease-out will-change-transform",
          isSticky && [
            "fixed left-0 right-0 z-40",
            "bg-background/95 backdrop-blur-md",
            "border-b border-border/40",
            "shadow-sm",
            "px-3 py-2 sm:px-4",
            // iOS-specific fixes
            "transform-gpu",
          ],
          className
        )}
        style={isSticky ? { 
          top: `${offset - 4}px`,
          // Prevent iOS Safari from causing shifts during momentum scroll
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
        } : undefined}
      >
        {children}
      </div>
    </>
  );
}
