import { Skeleton } from "@/components/ui/skeleton";

export function GameCardSkeleton() {
  return (
    <div className="p-5 bg-card rounded-xl border border-border shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>

      {/* Teams */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-8" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-6 w-8" />
        </div>
      </div>

      {/* Percentile bar */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* DK badge */}
      <div className="mt-4 pt-4 border-t border-border">
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}
