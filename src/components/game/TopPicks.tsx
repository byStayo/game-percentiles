import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import type { TodayGame } from "@/hooks/useApi";

interface TopPicksProps {
  games: TodayGame[];
  isLoading: boolean;
}

export function TopPicks({ games, isLoading }: TopPicksProps) {
  const topPicks = useMemo(() => {
    // Filter games with percentiles and find extreme edges
    const withEdge = games.filter(
      (g) => g.dk_line_percentile !== null && g.dk_offered
    );

    // Sort by distance from 50 (most extreme first)
    const sorted = [...withEdge].sort((a, b) => {
      const aDistance = Math.abs(50 - (a.dk_line_percentile ?? 50));
      const bDistance = Math.abs(50 - (b.dk_line_percentile ?? 50));
      return bDistance - aDistance;
    });

    // Take top 3 extreme picks
    return sorted.slice(0, 3);
  }, [games]);

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            Top Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (topPicks.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-primary" />
          Top Picks of the Day
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Games with extreme percentile edges
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topPicks.map((game, idx) => {
            const isOver = (game.dk_line_percentile ?? 50) <= 30;
            const isUnder = (game.dk_line_percentile ?? 50) >= 70;
            const percentile = game.dk_line_percentile ?? 50;

            return (
              <Link
                key={game.id}
                to={`/game/${game.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                <div className="font-medium truncate group-hover:text-primary transition-colors">
                    {game.away_team?.abbrev || 'Away'} @ {game.home_team?.abbrev || 'Home'}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="uppercase text-xs font-medium">
                      {game.sport_id}
                    </span>
                    {game.dk_total_line && (
                      <span>Line: {game.dk_total_line}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      isOver
                        ? "bg-status-over/20 text-status-over border-status-over/30"
                        : isUnder
                        ? "bg-status-under/20 text-status-under border-status-under/30"
                        : ""
                    }
                  >
                    {isOver ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : isUnder ? (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    ) : null}
                    P{Math.round(percentile)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {isOver ? "OVER" : isUnder ? "UNDER" : "EDGE"}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
