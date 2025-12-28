import { useLockParlayHistory } from "@/hooks/useLockParlayHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LockParlayChart } from "./LockParlayChart";
import { 
  Trophy, 
  TrendingUp, 
  Target, 
  CheckCircle2, 
  XCircle, 
  Clock,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function LockParlayStats() {
  const { history, stats, isLoading } = useLockParlayHistory();

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="py-6 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No lock parlays tracked yet. Build your first lock parlay to start tracking!
          </p>
        </CardContent>
      </Card>
    );
  }

  const recentParlays = history.slice(0, 5);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Lock Parlay Performance
          <Badge variant="outline" className="ml-auto text-xs">
            {stats.totalParlays} tracked
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-1.5 text-green-600 mb-1">
              <Trophy className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Win Rate</span>
            </div>
            <div className="text-xl font-bold text-green-600">
              {stats.winRate.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {stats.wins}W / {stats.losses}L
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-1.5 text-blue-600 mb-1">
              <Target className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Leg Hit Rate</span>
            </div>
            <div className="text-xl font-bold text-blue-600">
              {stats.legHitRate.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {stats.legsHit} / {stats.totalLegs} legs
            </div>
          </div>

          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-1.5 text-purple-600 mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Avg Probability</span>
            </div>
            <div className="text-xl font-bold text-purple-600">
              {stats.avgCombinedProbability.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">
              combined prob
            </div>
          </div>

          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-1.5 text-yellow-600 mb-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Pending</span>
            </div>
            <div className="text-xl font-bold text-yellow-600">
              {stats.pendingParlays}
            </div>
            <div className="text-xs text-muted-foreground">
              awaiting results
            </div>
          </div>
        </div>

        {/* Performance Chart */}
        <LockParlayChart history={history} />

        {/* Recent Parlays */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Recent Parlays
          </h4>
          <div className="space-y-1.5">
            {recentParlays.map(parlay => (
              <div 
                key={parlay.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg text-sm",
                  parlay.is_complete 
                    ? parlay.is_win 
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                    : "bg-muted/50 border border-border/50"
                )}
              >
                <div className="flex items-center gap-2">
                  {parlay.is_complete ? (
                    parlay.is_win ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-600" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(parlay.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">
                    {parlay.legs_hit}/{parlay.num_legs} legs
                  </span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs font-mono",
                      parlay.is_complete && parlay.is_win && "border-green-500/50 text-green-600",
                      parlay.is_complete && !parlay.is_win && "border-red-500/50 text-red-500"
                    )}
                  >
                    {parlay.combined_probability?.toFixed(0)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
