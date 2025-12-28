import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Layout } from "@/components/layout/Layout";
import { useTodayGames, TodayGame } from "@/hooks/useApi";
import { getTeamDisplayName, formatTimeET } from "@/lib/teamNames";
import { DkDistanceBadge, isDkBeyondExtremes } from "@/components/game/DkDistanceBadge";
import { SegmentBadge } from "@/components/game/SegmentBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Zap,
  Copy,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  CheckCircle,
  Plus,
  Minus,
} from "lucide-react";
import type { SportId } from "@/types";

interface AlternateLine {
  point: number;
  over_price: number;
  under_price: number;
}

interface OptimizedPick {
  game: TodayGame;
  pick: 'over' | 'under';
  matchingLine: number;
  matchingOdds: number;
  matchedPercentile: 'p05' | 'p95';
  distanceFromPercentile: number;
  edgePoints: number;
  confidence: number;
}

const ET_TIMEZONE = 'America/New_York';

function getTodayInET(): Date {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  return new Date(etDate.getFullYear(), etDate.getMonth(), etDate.getDate());
}

const SPORTS: { id: SportId | "all"; label: string }[] = [
  { id: "all", label: "All Sports" },
  { id: "nfl", label: "NFL" },
  { id: "nba", label: "NBA" },
  { id: "mlb", label: "MLB" },
  { id: "nhl", label: "NHL" },
];

const TOLERANCE_OPTIONS = [
  { value: 0, label: "Exact match" },
  { value: 0.5, label: "±0.5 pts" },
  { value: 1, label: "±1 pt" },
  { value: 2, label: "±2 pts" },
  { value: 3, label: "±3 pts" },
];

export default function ParlayOptimizer() {
  const today = useMemo(() => getTodayInET(), []);
  const [sportFilter, setSportFilter] = useState<SportId | "all">("all");
  const [tolerance, setTolerance] = useState(1);
  const [selectedPicks, setSelectedPicks] = useState<Set<string>>(new Set());
  const [minSampleSize, setMinSampleSize] = useState(5);

  // Fetch games for all sports
  const { data: nflData, isLoading: nflLoading } = useTodayGames(today, "nfl");
  const { data: nbaData, isLoading: nbaLoading } = useTodayGames(today, "nba");
  const { data: mlbData, isLoading: mlbLoading } = useTodayGames(today, "mlb");
  const { data: nhlData, isLoading: nhlLoading } = useTodayGames(today, "nhl");

  const isLoading = nflLoading || nbaLoading || mlbLoading || nhlLoading;

  // Find games where DK alternate lines match historical percentiles
  const optimizedPicks = useMemo(() => {
    const allGames: TodayGame[] = [
      ...(nflData?.games || []),
      ...(nbaData?.games || []),
      ...(mlbData?.games || []),
      ...(nhlData?.games || []),
    ];

    const picks: OptimizedPick[] = [];

    allGames
      .filter(game => {
        if (game.status === "final") return false;
        if (sportFilter !== "all" && game.sport_id !== sportFilter) return false;
        if (game.n_h2h < minSampleSize) return false;
        if (!game.alternate_lines || !Array.isArray(game.alternate_lines)) return false;
        if (game.p05 === null || game.p95 === null) return false;
        return true;
      })
      .forEach(game => {
        const alternateLines = game.alternate_lines as AlternateLine[];
        const p05 = game.p05!;
        const p95 = game.p95!;

        // Find lines matching p95 (for over bets)
        alternateLines.forEach(line => {
          const distanceToP95 = Math.abs(line.point - p95);
          const distanceToP05 = Math.abs(line.point - p05);

          // Check for p95 match (over bet)
          if (distanceToP95 <= tolerance) {
            const edgePoints = p95 - (game.dk_total_line ?? line.point);
            picks.push({
              game,
              pick: 'over',
              matchingLine: line.point,
              matchingOdds: line.over_price,
              matchedPercentile: 'p95',
              distanceFromPercentile: distanceToP95,
              edgePoints: Math.max(0, edgePoints),
              confidence: Math.max(0, 100 - (distanceToP95 * 20)),
            });
          }

          // Check for p05 match (under bet)
          if (distanceToP05 <= tolerance) {
            const edgePoints = (game.dk_total_line ?? line.point) - p05;
            picks.push({
              game,
              pick: 'under',
              matchingLine: line.point,
              matchingOdds: line.under_price,
              matchedPercentile: 'p05',
              distanceFromPercentile: distanceToP05,
              edgePoints: Math.max(0, edgePoints),
              confidence: Math.max(0, 100 - (distanceToP05 * 20)),
            });
          }
        });
      });

    // Sort by edge points (highest first) then by confidence
    return picks.sort((a, b) => {
      if (b.edgePoints !== a.edgePoints) return b.edgePoints - a.edgePoints;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.distanceFromPercentile - b.distanceFromPercentile;
    });
  }, [nflData, nbaData, mlbData, nhlData, sportFilter, tolerance, minSampleSize]);

  // Group by game to show best pick per game
  const bestPicksPerGame = useMemo(() => {
    const seen = new Set<string>();
    return optimizedPicks.filter(pick => {
      const key = `${pick.game.game_id}-${pick.pick}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [optimizedPicks]);

  const togglePick = (pickKey: string) => {
    setSelectedPicks(prev => {
      const next = new Set(prev);
      if (next.has(pickKey)) {
        next.delete(pickKey);
      } else {
        next.add(pickKey);
      }
      return next;
    });
  };

  const selectedPicksList = useMemo(() => {
    return bestPicksPerGame.filter(pick => 
      selectedPicks.has(`${pick.game.game_id}-${pick.pick}`)
    );
  }, [bestPicksPerGame, selectedPicks]);

  const combinedEdge = useMemo(() => {
    return selectedPicksList.reduce((sum, p) => sum + p.edgePoints, 0);
  }, [selectedPicksList]);

  const copyParlay = () => {
    if (selectedPicksList.length === 0) {
      toast.error("No picks selected");
      return;
    }

    const lines = [
      `🎯 OPTIMIZED PARLAY - ${format(today, 'MMM d, yyyy')}`,
      `═══════════════════════════════════════`,
      ``,
      ...selectedPicksList.map((pick, i) => {
        const homeTeam = getTeamDisplayName(pick.game.home_team, pick.game.sport_id);
        const awayTeam = getTeamDisplayName(pick.game.away_team, pick.game.sport_id);
        return [
          `${i + 1}. [${pick.game.sport_id.toUpperCase()}] ${awayTeam} @ ${homeTeam}`,
          `   ${pick.pick.toUpperCase()} ${pick.matchingLine} (${formatOdds(pick.matchingOdds)})`,
          `   Matches P${pick.matchedPercentile === 'p95' ? '95' : '05'} | +${pick.edgePoints.toFixed(1)} edge`,
        ].join('\n');
      }),
      ``,
      `═══════════════════════════════════════`,
      `Total Edge: +${combinedEdge.toFixed(1)} pts`,
      `Legs: ${selectedPicksList.length}`,
      ``,
      `Generated by Parlay Optimizer`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success("Parlay copied to clipboard!");
  };

  const autoSelectBest = (count: number) => {
    const newSelected = new Set<string>();
    const seen = new Set<string>();
    
    for (const pick of bestPicksPerGame) {
      if (newSelected.size >= count) break;
      const gameKey = pick.game.game_id;
      if (seen.has(gameKey)) continue; // Only one pick per game
      seen.add(gameKey);
      newSelected.add(`${pick.game.game_id}-${pick.pick}`);
    }
    
    setSelectedPicks(newSelected);
    toast.success(`Selected top ${newSelected.size} picks`);
  };

  return (
    <>
      <Helmet>
        <title>Parlay Optimizer | Edge Detection</title>
        <meta
          name="description"
          content="Build optimized parlays by matching DraftKings alternate lines with historical percentiles for maximum edge."
        />
      </Helmet>

      <Layout>
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in px-4 py-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-status-edge/10">
                <Target className="h-6 w-6 text-status-edge" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Parlay Optimizer</h1>
                <p className="text-muted-foreground text-sm">
                  Find DK alternate lines that match historical p05/p95 percentiles
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Sport Filter */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Sport</label>
                  <Select
                    value={sportFilter}
                    onValueChange={(v) => setSportFilter(v as SportId | "all")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPORTS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tolerance */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Match Tolerance</label>
                  <Select
                    value={tolerance.toString()}
                    onValueChange={(v) => setTolerance(parseFloat(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOLERANCE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value.toString()}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Min Sample Size */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Min H2H Games</label>
                  <Select
                    value={minSampleSize.toString()}
                    onValueChange={(v) => setMinSampleSize(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 5, 8, 10, 15].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n}+ games
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quick Select */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Quick Select</label>
                  <div className="flex gap-1">
                    {[2, 3, 4, 5].map(n => (
                      <Button
                        key={n}
                        variant="outline"
                        size="sm"
                        onClick={() => autoSelectBest(n)}
                        className="flex-1"
                      >
                        Top {n}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Parlay Summary */}
          {selectedPicksList.length > 0 && (
            <Card className="border-status-edge/30 bg-status-edge/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-status-edge" />
                    Your Parlay
                    <Badge className="bg-status-edge text-white ml-2">
                      {selectedPicksList.length} legs
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-status-edge border-status-edge/30">
                      +{combinedEdge.toFixed(1)} pts edge
                    </Badge>
                    <Button
                      size="sm"
                      onClick={copyParlay}
                      className="bg-status-edge hover:bg-status-edge/90"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedPicksList.map((pick, i) => (
                    <div
                      key={`${pick.game.game_id}-${pick.pick}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-background/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                        <Badge variant="outline" className="text-2xs">{pick.game.sport_id.toUpperCase()}</Badge>
                        <span className="text-sm font-medium">
                          {getTeamDisplayName(pick.game.away_team, pick.game.sport_id)} @{" "}
                          {getTeamDisplayName(pick.game.home_team, pick.game.sport_id)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold",
                          pick.pick === 'over' ? "bg-status-over/20 text-status-over" : "bg-status-under/20 text-status-under"
                        )}>
                          {pick.pick === 'over' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {pick.pick.toUpperCase()} {pick.matchingLine}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatOdds(pick.matchingOdds)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => togglePick(`${pick.game.game_id}-${pick.pick}`)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-muted-foreground"
                  onClick={() => setSelectedPicks(new Set())}
                >
                  Clear all
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Available Picks */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-status-edge" />
              Matching Picks ({bestPicksPerGame.length})
            </h2>

            {isLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="animate-pulse text-muted-foreground">
                    Loading games...
                  </div>
                </CardContent>
              </Card>
            ) : bestPicksPerGame.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="font-medium mb-1">No matching picks found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Try increasing tolerance or decreasing minimum sample size
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {bestPicksPerGame.map((pick) => (
                  <OptimizedPickRow
                    key={`${pick.game.game_id}-${pick.pick}`}
                    pick={pick}
                    isSelected={selectedPicks.has(`${pick.game.game_id}-${pick.pick}`)}
                    onToggle={() => togglePick(`${pick.game.game_id}-${pick.pick}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Explanation */}
          <Card className="bg-muted/30">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">
                <strong>Parlay Optimizer</strong> finds DraftKings alternate lines that closely match 
                historical p05/p95 percentiles. When a DK line equals or approaches these extremes, 
                history suggests strong value. Select picks to build your optimized parlay.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </>
  );
}

function OptimizedPickRow({
  pick,
  isSelected,
  onToggle,
}: {
  pick: OptimizedPick;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const homeTeamName = getTeamDisplayName(pick.game.home_team, pick.game.sport_id);
  const awayTeamName = getTeamDisplayName(pick.game.away_team, pick.game.sport_id);
  const startTime = new Date(pick.game.start_time_utc);
  const isBeyondExtremes = isDkBeyondExtremes(pick.game.dk_total_line, pick.game.p05, pick.game.p95);

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-3 rounded-xl border transition-colors",
        isSelected 
          ? "bg-status-edge/10 border-status-edge/30" 
          : "bg-card border-border/60 hover:border-border",
        isBeyondExtremes && "border-status-live/30"
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-status-edge data-[state=checked]:border-status-edge"
      />

      {/* Game Info */}
      <Link to={`/game/${pick.game.game_id}`} className="flex-1 min-w-0 group">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate group-hover:text-status-edge transition-colors">
            {awayTeamName} @ {homeTeamName}
          </span>
          {isBeyondExtremes && (
            <AlertTriangle className="h-3.5 w-3.5 text-status-live animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase">{pick.game.sport_id}</span>
          <span>•</span>
          <span>{formatTimeET(startTime)} ET</span>
          <span>•</span>
          <span>n={pick.game.n_h2h}</span>
        </div>
      </Link>

      {/* Matched Line */}
      <div className="flex flex-col items-end gap-1">
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-bold",
          pick.pick === 'over' ? "bg-status-over/15 text-status-over" : "bg-status-under/15 text-status-under"
        )}>
          {pick.pick === 'over' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {pick.pick.toUpperCase()} {pick.matchingLine}
          <span className="text-xs font-normal opacity-70">
            ({formatOdds(pick.matchingOdds)})
          </span>
        </div>
        <div className="text-2xs text-muted-foreground">
          Matches P{pick.matchedPercentile === 'p95' ? '95' : '05'} ({pick.game[pick.matchedPercentile]})
        </div>
      </div>

      {/* Edge */}
      <Badge 
        variant="outline" 
        className={cn(
          "text-xs",
          pick.edgePoints >= 3 ? "text-status-live bg-status-live/10 border-status-live/30" :
          pick.edgePoints >= 1 ? "text-status-edge bg-status-edge/10 border-status-edge/30" :
          "text-muted-foreground"
        )}
      >
        +{pick.edgePoints.toFixed(1)} edge
      </Badge>

      {/* Arrow */}
      <Link to={`/game/${pick.game.game_id}`}>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
      </Link>
    </div>
  );
}

function formatOdds(odds: number): string {
  if (odds >= 0) return `+${odds}`;
  return odds.toString();
}
