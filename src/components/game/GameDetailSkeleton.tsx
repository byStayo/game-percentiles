import { Skeleton } from "@/components/ui/skeleton";
import { Layout } from "@/components/layout/Layout";

export function GameDetailSkeleton() {
  return (
    <Layout>
      <div className="max-w-xl mx-auto space-y-6 px-4 animate-fade-in">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>

        {/* Main card */}
        <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-10 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-10 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>

          {/* Teams section */}
          <div className="px-5 py-4 space-y-3">
            <div>
              <Skeleton className="h-3 w-10 mb-1" />
              <Skeleton className="h-6 w-40" />
            </div>
            <div>
              <Skeleton className="h-3 w-10 mb-1" />
              <Skeleton className="h-6 w-36" />
            </div>
          </div>

          {/* PickPill */}
          <div className="flex justify-center py-5 px-5 bg-secondary/30">
            <Skeleton className="h-12 w-48 rounded-xl" />
          </div>

          {/* PercentileBar */}
          <div className="px-5 py-4 border-t border-border/40 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border/40 flex justify-center">
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-card border border-border/60 text-center"
            >
              <Skeleton className="h-5 w-10 mx-auto mb-1" />
              <Skeleton className="h-3 w-8 mx-auto" />
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="bg-card rounded-2xl border border-border/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>

        {/* History placeholder */}
        <div className="bg-card rounded-2xl border border-border/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 px-3 bg-secondary/30 rounded-lg"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
