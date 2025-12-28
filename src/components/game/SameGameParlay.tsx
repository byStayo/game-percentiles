import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import type { TodayGame } from "@/hooks/useApi";

const EDGE_PARLAY_KEY = 'edge-parlay-picks';

// SGP correlation factor - accounts for correlation between picks on same game
// Sportsbooks typically apply a ~20% correlation penalty
const SGP_CORRELATION_FACTOR = 0.85;

interface RankedGame extends TodayGame {
  hitProbability: number;
  bestPick: "over" | "under" | null;
  edgeStrength: number;
}

interface SGPGroup {
  gameId: string;
  sportId: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  picks: {
    type: "over" | "under";
    line: number | null;
    odds: number | null;
    hitProbability: number;
    edge: number;
  }[];
  combinedProbability: number;
  adjustedProbability: number; // After SGP correlation
}

interface SameGameParlayProps {
  rankedGames: RankedGame[];
}

export function SameGameParlay({ rankedGames }: SameGameParlayProps) {
  const navigate = useNavigate();
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());

  // Group games with both over and under edges (potential SGP candidates)
  const sgpGroups = useMemo(() => {
    const groups: SGPGroup[] = [];

    rankedGames.forEach(game => {
      const hasOverEdge = game.p95_over_line !== null && game.p95_over_line !== undefined;
      const hasUnderEdge = game.p05_under_line !== null && game.p05_under_line !== undefined;

      // Calculate both probabilities for this game
      const dkLine = game.dk_total_line ?? 0;
      const p05 = game.p05 ?? 0;
      const p95 = game.p95 ?? 0;
      const range = p95 - p05;

      let overHitProb = 50;
      let underHitProb = 50;

      if (range > 0 && dkLine > 0) {
        const positionInRange = (dkLine - p05) / range;
        
        if (dkLine <= p05) {
          const beyondAmount = (p05 - dkLine) / (range || 1);
          underHitProb = Math.min(99, 95 + beyondAmount * 4);
          overHitProb = 5;
        } else if (dkLine >= p95) {
          const beyondAmount = (dkLine - p95) / (range || 1);
          overHitProb = Math.min(99, 95 + beyondAmount * 4);
          underHitProb = 5;
        } else {
          underHitProb = 95 - (positionInRange * 90);
          overHitProb = 5 + (positionInRange * 90);
        }
      }

      const picks: SGPGroup["picks"] = [];

      if (hasOverEdge) {
        picks.push({
          type: "over",
          line: game.p95_over_line ?? null,
          odds: game.p95_over_odds ?? null,
          hitProbability: overHitProb,
          edge: Math.max(0, game.best_over_edge ?? 0),
        });
      }

      if (hasUnderEdge) {
        picks.push({
          type: "under",
          line: game.p05_under_line ?? null,
          odds: game.p05_under_odds ?? null,
          hitProbability: underHitProb,
          edge: Math.max(0, game.best_under_edge ?? 0),
        });
      }

      // Only include games with meaningful edges on both sides or single strong edge
      if (picks.length > 0 && picks.some(p => p.hitProbability >= 60)) {
        const combinedProb = picks.reduce((acc, p) => acc * (p.hitProbability / 100), 1) * 100;
        const adjustedProb = combinedProb * SGP_CORRELATION_FACTOR;

        groups.push({
          gameId: game.game_id,
          sportId: game.sport_id,
          homeTeam: game.home_team.name,
          awayTeam: game.away_team.name,
          startTime: game.start_time_utc,
          picks,
          combinedProbability: combinedProb,
          adjustedProbability: adjustedProb,
        });
      }
    });

    // Sort by adjusted probability
    return groups.sort((a, b) => b.adjustedProbability - a.adjustedProbability);
  }, [rankedGames]);

  const toggleExpanded = (gameId: string) => {
    setExpandedGames(prev => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const handleBuildSGP = (group: SGPGroup) => {
    const edgePicks = group.picks.map(pick => ({
      gameId: group.gameId,
      sportId: group.sportId,
      pick: pick.type,
      edgeStrength: pick.edge,
      line: pick.line,
      odds: pick.odds,
      homeTeam: group.homeTeam,
      awayTeam: group.awayTeam,
      isSGP: true,
    }));

    localStorage.setItem(EDGE_PARLAY_KEY, JSON.stringify(edgePicks));
    toast.success(`Built SGP with ${group.picks.length} legs`);
    navigate("/parlay");
  };

  if (sgpGroups.length === 0) {
    return null;
  }

  // Only show top SGP opportunities
  const topSGPs = sgpGroups.filter(g => g.picks.length >= 1 && g.adjustedProbability >= 40).slice(0, 5);

  if (topSGPs.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-purple-500/50 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-1.5 rounded-lg bg-purple-500/20">
              <Layers className="h-5 w-5 text-purple-500" />
            </div>
            Same Game Parlay
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help border-purple-500/50 text-purple-600">
                  <Info className="h-3 w-3 mr-1" />
                  SGP Mode
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  <strong>Same Game Parlay:</strong> Combine multiple picks from the same game. 
                  Probabilities are adjusted by ~15% to account for correlation between picks.
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <Badge className="bg-purple-500/20 text-purple-600 border border-purple-500/30">
            {topSGPs.length} SGP opportunit{topSGPs.length !== 1 ? 'ies' : 'y'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Games with multiple edge picks that can be combined into same-game parlays
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {topSGPs.map(group => {
          const isExpanded = expandedGames.has(group.gameId);
          
          return (
            <div 
              key={group.gameId}
              className="p-3 rounded-lg bg-background/50 border border-purple-500/20 hover:border-purple-500/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {group.awayTeam} @ {group.homeTeam}
                    </span>
                    <Badge variant="outline" className="text-xs uppercase">
                      {group.sportId}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {group.picks.map((pick, idx) => (
                      <Badge 
                        key={idx}
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          pick.type === "over" 
                            ? "bg-status-over/20 text-status-over border-status-over/30"
                            : "bg-status-under/20 text-status-under border-status-under/30"
                        )}
                      >
                        {pick.type === "over" ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {pick.type.toUpperCase()} {pick.line?.toFixed(1)}
                        <span className="ml-1 opacity-70">({pick.hitProbability.toFixed(0)}%)</span>
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="bg-purple-600 text-white font-bold cursor-help">
                        {group.adjustedProbability.toFixed(0)}%
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        Raw combined: {group.combinedProbability.toFixed(1)}%<br />
                        After SGP correlation adjustment: {group.adjustedProbability.toFixed(1)}%
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => toggleExpanded(group.gameId)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-2">
                  <div className="grid gap-2">
                    {group.picks.map((pick, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          {pick.type === "over" ? (
                            <TrendingUp className="h-4 w-4 text-status-over" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-status-under" />
                          )}
                          <span className="text-sm font-medium">
                            {pick.type.toUpperCase()} {pick.line?.toFixed(1)}
                          </span>
                          {pick.odds && (
                            <span className="text-xs text-muted-foreground">
                              ({pick.odds >= 0 ? `+${pick.odds}` : pick.odds})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Edge: +{pick.edge.toFixed(1)}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "font-mono text-xs",
                              pick.hitProbability >= 80 ? "border-green-500/50 text-green-600" :
                              pick.hitProbability >= 60 ? "border-yellow-500/50 text-yellow-600" :
                              "border-muted"
                            )}
                          >
                            {pick.hitProbability.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => handleBuildSGP(group)}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Build This SGP
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
