import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function GameCardSkeleton() {
  return (
    <div className="p-5 bg-card rounded-2xl border border-border/60 animate-fade-in">
      {/* Header: time + league | n badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-10 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-10 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-full" />
        </div>
      </div>

      {/* Teams */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
        </div>
      </div>

      {/* PickPill placeholder */}
      <div className="flex justify-center mb-4">
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>

      {/* PercentileBar placeholder */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-border/40">
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

export function GameCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </div>
  );
}
