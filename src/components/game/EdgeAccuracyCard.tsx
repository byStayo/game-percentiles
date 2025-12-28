import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEdgeAccuracy, type EdgeResult } from "@/hooks/useEdgeAccuracy";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  CheckCircle2, 
  XCircle, 
  MinusCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  BarChart3
} from "lucide-react";

export function EdgeAccuracyCard() {
  const [daysBack, setDaysBack] = useState(30);
  const [showResults, setShowResults] = useState(false);
  const { data, isLoading, error } = useEdgeAccuracy(daysBack);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Edge Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Edge Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load accuracy data</p>
        </CardContent>
      </Card>
    );
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 55) return "text-status-over";
    if (accuracy >= 50) return "text-status-edge";
    if (accuracy >= 45) return "text-muted-foreground";
    return "text-status-live";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Historical Edge Accuracy
          </CardTitle>
          <div className="flex gap-1">
            {[7, 30, 90].map(days => (
              <Button
                key={days}
                variant={daysBack === days ? "default" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setDaysBack(days)}
              >
                {days}d
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-3">
          {/* Overall */}
          <div className="p-3 rounded-xl bg-muted/50 text-center">
            <div className={cn("text-2xl font-bold tabular-nums", getAccuracyColor(data.totalAccuracy))}>
              {data.totalAccuracy.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              Overall ({data.overEdgeHits + data.underEdgeHits}/{data.totalGames})
            </div>
          </div>

          {/* Beyond Extremes */}
          <div className="p-3 rounded-xl bg-status-live/10 text-center">
            <div className={cn("text-2xl font-bold tabular-nums", getAccuracyColor(data.beyondExtremesAccuracy))}>
              {data.beyondExtremesAccuracy.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Beyond ({data.beyondExtremesHits}/{data.beyondExtremesGames})
            </div>
          </div>
        </div>

        {/* Over/Under Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-status-over/10">
            <TrendingUp className="h-4 w-4 text-status-over" />
            <div>
              <div className={cn("text-sm font-semibold", getAccuracyColor(data.overAccuracy))}>
                {data.overAccuracy.toFixed(1)}%
              </div>
              <div className="text-2xs text-muted-foreground">
                Over edges ({data.overEdgeHits}/{data.overEdgeGames})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-status-under/10">
            <TrendingDown className="h-4 w-4 text-status-under" />
            <div>
              <div className={cn("text-sm font-semibold", getAccuracyColor(data.underAccuracy))}>
                {data.underAccuracy.toFixed(1)}%
              </div>
              <div className="text-2xs text-muted-foreground">
                Under edges ({data.underEdgeHits}/{data.underEdgeGames})
              </div>
            </div>
          </div>
        </div>

        {/* Recent Results Toggle */}
        {data.recentResults.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-xs"
              onClick={() => setShowResults(!showResults)}
            >
              <span>Recent Results ({data.recentResults.length})</span>
              {showResults ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showResults && (
              <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                {data.recentResults.map((result) => (
                  <ResultRow key={result.gameId} result={result} />
                ))}
              </div>
            )}
          </div>
        )}

        {data.totalGames === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No completed edge games in the last {daysBack} days
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ResultRow({ result }: { result: EdgeResult }) {
  const ResultIcon = result.result === "hit" ? CheckCircle2 : result.result === "miss" ? XCircle : MinusCircle;
  const resultColor = result.result === "hit" ? "text-status-over" : result.result === "miss" ? "text-status-live" : "text-muted-foreground";
  
  const overEdge = result.edgeType === "over" || result.edgeType === "both";
  const underEdge = result.edgeType === "under" || result.edgeType === "both";
  // For "both", we show the actual result direction
  const wasOver = result.finalTotal > result.dkLine;

  return (
    <Link
      to={`/game/${result.gameId}`}
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg border transition-colors hover:bg-muted/50",
        result.result === "hit" && "border-status-over/20 bg-status-over/5",
        result.result === "miss" && "border-status-live/20 bg-status-live/5",
        result.result === "push" && "border-border"
      )}
    >
      <ResultIcon className={cn("h-4 w-4 flex-shrink-0", resultColor)} />
      
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">
          {result.awayTeam} @ {result.homeTeam}
        </div>
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <span className="uppercase">{result.sportId}</span>
          <span>•</span>
          <span>{result.dateLocal}</span>
          {result.isBeyondExtremes && (
            <>
              <span>•</span>
              <AlertTriangle className="h-2.5 w-2.5 text-status-live" />
            </>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-xs font-medium tabular-nums">
          {result.finalTotal} {wasOver ? ">" : "<"} {result.dkLine}
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "text-2xs px-1 py-0",
            wasOver ? "text-status-over border-status-over/30" : "text-status-under border-status-under/30"
          )}
        >
          {wasOver ? "OVER" : "UNDER"}
        </Badge>
      </div>
    </Link>
  );
}
