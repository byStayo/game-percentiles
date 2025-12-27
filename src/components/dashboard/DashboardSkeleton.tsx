import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="container py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      {/* Second Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CardSkeleton height="h-32" />
        </div>
        <div className="lg:col-span-2">
          <CardSkeleton height="h-32" />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} height="h-20" />
        ))}
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="p-6 bg-card rounded-xl border border-border/60">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

function CardSkeleton({ height = "h-24" }: { height?: string }) {
  return (
    <div className={`p-6 bg-card rounded-xl border border-border/60 ${height}`}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-6 w-48" />
    </div>
  );
}
