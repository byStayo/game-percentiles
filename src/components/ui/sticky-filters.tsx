import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface StickyFiltersProps {
  children: ReactNode;
  className?: string;
  offset?: number;
}

export function StickyFilters({ children, className, offset = 60 }: StickyFiltersProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: `-${offset}px 0px 0px 0px` }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [offset]);

  return (
    <>
      <div ref={ref} className="h-0" aria-hidden="true" />
      <div
        className={cn(
          "transition-all duration-300 ease-out z-40",
          isSticky && "sticky top-14 bg-background/95 backdrop-blur-md border-b border-border/40 shadow-sm -mx-3 px-3 py-2 sm:-mx-4 sm:px-4",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}
