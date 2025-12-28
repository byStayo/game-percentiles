import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Layout } from "@/components/layout/Layout";
import { useTodayGames } from "@/hooks/useApi";
import { calculateConfidence, type ConfidenceResult } from "@/lib/confidenceScore";
import { getTeamDisplayName, formatTimeET } from "@/lib/teamNames";
import { ConfidenceBadge } from "@/components/game/ConfidenceBadge";
import { PickPill } from "@/components/game/PickPill";
import { SegmentBadge } from "@/components/game/SegmentBadge";
import { DkDistanceBadge, isDkBeyondExtremes, BeyondExtremesWarning } from "@/components/game/DkDistanceBadge";
import { MiniPercentileChart } from "@/components/game/MiniPercentileChart";
import { EdgeAccuracyCard } from "@/components/game/EdgeAccuracyCard";
import { GameResultBadge } from "@/components/game/GameResultBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  Trophy,
  Shield,
  TrendingUp,
  TrendingDown,
  Filter,
  ChevronRight,
  Star,
  Zap,
  Target,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  History,
} from "lucide-react";
import type { SportId } from "@/types";
import type { TodayGame } from "@/hooks/useApi";

// Key for storing edge picks in localStorage for parlay
const EDGE_PARLAY_KEY = 'edge-parlay-picks';

const SPORTS: { id: SportId | "all"; label: string }[] = [
  { id: "all", label: "All Sports" },
  { id: "nfl", label: "NFL" },
  { id: "nba", label: "NBA" },
  { id: "mlb", label: "MLB" },
  { id: "nhl", label: "NHL" },
];

const EDGE_FILTERS = [
  { id: "all", label: "All Games" },
  { id: "over", label: "Over Edges" },
  { id: "under", label: "Under Edges" },
  { id: "any-edge", label: "Any Edge" },
] as const;

const SORT_OPTIONS = [
  { id: "hit-probability", label: "Hit Probability" },
  { id: "edge-strength", label: "Edge Strength" },
  { id: "dk-distance", label: "DK Distance from P5/P95" },
  { id: "confidence", label: "Confidence" },
  { id: "time", label: "Game Time" },
] as const;

type EdgeFilter = typeof EDGE_FILTERS[number]["id"];
type SortOption = typeof SORT_OPTIONS[number]["id"];

interface RankedGame extends TodayGame {
  confidence: ConfidenceResult;
  edgeType: "over" | "under" | "both" | "none";
  edgeStrength: number;
  dkDistanceFromPercentile: number; // How close DK line is to p05 or p95
  isBeyondExtremes: boolean; // Whether DK line extends beyond p05/p95
  hitProbability: number; // Estimated statistical probability of hitting (0-100)
  bestPick: "over" | "under" | null; // Which side has better probability
}

function formatOdds(odds: number): string {
  if (odds >= 0) return `+${odds}`;
  return odds.toString();
}

export default function BestBets() {
  const navigate = useNavigate();
  const [sportFilter, setSportFilter] = useState<SportId | "all">("all");
  const [edgeFilter, setEdgeFilter] = useState<EdgeFilter>("any-edge");
  const [sortBy, setSortBy] = useState<SortOption>("hit-probability");
  const [beyondExtremesOnly, setBeyondExtremesOnly] = useState(false);
  const [showFinalGames, setShowFinalGames] = useState(true);
  const [minConfidence, setMinConfidence] = useState(40);
  const [minSampleSize, setMinSampleSize] = useState(5);
  const [minHitProbability, setMinHitProbability] = useState(0);

  // Get today's date in ET
  const today = useMemo(() => {
    const now = new Date();
    const etDate = toZonedTime(now, 'America/New_York');
    return etDate;
  }, []);

  // Fetch games for each sport
  const { data: nflData, isLoading: nflLoading } = useTodayGames(today, "nfl");
  const { data: nbaData, isLoading: nbaLoading } = useTodayGames(today, "nba");
  const { data: mlbData, isLoading: mlbLoading } = useTodayGames(today, "mlb");
  const { data: nhlData, isLoading: nhlLoading } = useTodayGames(today, "nhl");

  const isLoading = nflLoading || nbaLoading || mlbLoading || nhlLoading;

  // Combine and rank all games by edge strength
  const { rankedGames, finalGames } = useMemo(() => {
    const allGames: TodayGame[] = [
      ...(nflData?.games || []),
      ...(nbaData?.games || []),
      ...(mlbData?.games || []),
      ...(nhlData?.games || []),
    ];

    // Helper function to process a game into RankedGame
    const processGame = (game: TodayGame): RankedGame => {
      const hasOverEdge = game.p95_over_line !== null && game.p95_over_line !== undefined;
      const hasUnderEdge = game.p05_under_line !== null && game.p05_under_line !== undefined;
      
      let edgeType: RankedGame["edgeType"] = "none";
      if (hasOverEdge && hasUnderEdge) edgeType = "both";
      else if (hasOverEdge) edgeType = "over";
      else if (hasUnderEdge) edgeType = "under";
      
      // Calculate edge strength (higher is better) - only use positive edges
      const overEdge = Math.max(0, game.best_over_edge ?? 0);
      const underEdge = Math.max(0, game.best_under_edge ?? 0);
      const edgeStrength = Math.max(overEdge, underEdge);
      
      // Calculate DK distance from percentile (how close DK line is to p05 or p95)
      // Lower distance = closer to extreme = more value
      const dkLine = game.dk_total_line ?? 0;
      const p05 = game.p05 ?? 0;
      const p95 = game.p95 ?? 0;
      const range = p95 - p05;
      const distanceToP05 = Math.abs(dkLine - p05);
      const distanceToP95 = Math.abs(dkLine - p95);
      const dkDistanceFromPercentile = Math.min(distanceToP05, distanceToP95);
      
      // Check if DK line extends beyond historical extremes
      const isBeyondExtremes = dkLine < p05 || dkLine > p95;
      
      // Calculate hit probability based on DK line position relative to percentiles
      // The closer DK is to an extreme (or beyond), the higher the probability
      // For UNDER: DK line at/below p05 = ~95%+ hit rate
      // For OVER: DK line at/above p95 = ~95%+ hit rate
      let overHitProb = 50; // Default: 50% if DK is at median
      let underHitProb = 50;
      
      if (range > 0 && dkLine > 0) {
        // Position from 0 (at p05) to 1 (at p95)
        const positionInRange = (dkLine - p05) / range;
        
        // UNDER probability: higher when DK is closer to/below p05
        // If DK < p05 (beyond low extreme), under has >95% hit rate
        // If DK = p05, under has ~95% hit rate
        // If DK = median, under has ~50% hit rate
        // If DK = p95, under has ~5% hit rate
        if (dkLine <= p05) {
          // Beyond the low extreme - very high under probability
          const beyondAmount = (p05 - dkLine) / (range || 1);
          underHitProb = Math.min(99, 95 + beyondAmount * 4);
        } else if (dkLine >= p95) {
          // Beyond the high extreme - very low under probability
          underHitProb = 5;
        } else {
          // Within range - linear interpolation
          underHitProb = 95 - (positionInRange * 90); // 95 at p05, 5 at p95
        }
        
        // OVER probability is inverse of under
        if (dkLine >= p95) {
          // Beyond the high extreme - very high over probability
          const beyondAmount = (dkLine - p95) / (range || 1);
          overHitProb = Math.min(99, 95 + beyondAmount * 4);
        } else if (dkLine <= p05) {
          // Beyond the low extreme - very low over probability
          overHitProb = 5;
        } else {
          // Within range - linear interpolation
          overHitProb = 5 + (positionInRange * 90); // 5 at p05, 95 at p95
        }
      }
      
      // Determine best pick and its probability
      let bestPick: "over" | "under" | null = null;
      let hitProbability = 0;
      
      if (hasOverEdge && hasUnderEdge) {
        // Both edges exist - pick the higher probability
        if (overHitProb >= underHitProb) {
          bestPick = "over";
          hitProbability = overHitProb;
        } else {
          bestPick = "under";
          hitProbability = underHitProb;
        }
      } else if (hasOverEdge) {
        bestPick = "over";
        hitProbability = overHitProb;
      } else if (hasUnderEdge) {
        bestPick = "under";
        hitProbability = underHitProb;
      }
      
      return {
        ...game,
        confidence: calculateConfidence({
          nGames: game.n_h2h,
          segment: game.segment_used,
        }),
        edgeType,
        edgeStrength,
        dkDistanceFromPercentile,
        isBeyondExtremes,
        hitProbability,
        bestPick,
      };
    };

    // Filter function for edge criteria
    const applyFilters = (game: RankedGame): boolean => {
      if (game.confidence.score < minConfidence) return false;
      if (game.n_h2h < minSampleSize) return false;
      if (sportFilter !== "all" && game.sport_id !== sportFilter) return false;
      
      // Hit probability filter
      if (minHitProbability > 0 && game.hitProbability < minHitProbability) return false;
      
      // Edge filter - also filter out zero/negative edges
      if (edgeFilter === "over" && game.edgeType !== "over" && game.edgeType !== "both") return false;
      if (edgeFilter === "under" && game.edgeType !== "under" && game.edgeType !== "both") return false;
      if (edgeFilter === "any-edge" && (game.edgeType === "none" || game.edgeStrength <= 0)) return false;
      
      // Beyond extremes filter
      if (beyondExtremesOnly && !game.isBeyondExtremes) return false;
      
      return true;
    };

    // Sort function
    const sortGames = (a: RankedGame, b: RankedGame): number => {
      switch (sortBy) {
        case "hit-probability":
          if (b.hitProbability !== a.hitProbability) {
            return b.hitProbability - a.hitProbability;
          }
          // Secondary sort by confidence for same probability
          return b.confidence.score - a.confidence.score;
        case "edge-strength":
          if (b.edgeStrength !== a.edgeStrength) {
            return b.edgeStrength - a.edgeStrength;
          }
          return b.confidence.score - a.confidence.score;
        case "dk-distance":
          if (a.dkDistanceFromPercentile !== b.dkDistanceFromPercentile) {
            return a.dkDistanceFromPercentile - b.dkDistanceFromPercentile;
          }
          return b.edgeStrength - a.edgeStrength;
        case "confidence":
          if (b.confidence.score !== a.confidence.score) {
            return b.confidence.score - a.confidence.score;
          }
          return b.edgeStrength - a.edgeStrength;
        case "time":
          return new Date(a.start_time_utc).getTime() - new Date(b.start_time_utc).getTime();
        default:
          return b.hitProbability - a.hitProbability;
      }
    };

    // Process upcoming/live games
    const upcomingGames = allGames
      .filter(game => game.status !== "final")
      .map(processGame)
      .filter(applyFilters)
      .sort(sortGames);

    // Process final games with edges
    const completedGames = allGames
      .filter(game => game.status === "final" && game.final_total !== null)
      .map(processGame)
      .filter(game => game.edgeType !== "none" && game.edgeStrength > 0)
      .filter(game => {
        // Apply sport filter to final games too
        if (sportFilter !== "all" && game.sport_id !== sportFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.start_time_utc).getTime() - new Date(a.start_time_utc).getTime());

    return { rankedGames: upcomingGames, finalGames: completedGames };
  }, [nflData, nbaData, mlbData, nhlData, sportFilter, edgeFilter, sortBy, minConfidence, minSampleSize, minHitProbability, beyondExtremesOnly]);

  const topPicks = rankedGames.slice(0, 3);
  const otherPicks = rankedGames.slice(3);

  // Games with 95%+ hit probability for "Lock Parlay" section
  const lockPicks = useMemo(() => {
    return rankedGames.filter(game => game.hitProbability >= 95);
  }, [rankedGames]);

  // Count games with DK lines beyond historical extremes
  const beyondExtremesCount = useMemo(() => {
    return rankedGames.filter(game => game.isBeyondExtremes).length;
  }, [rankedGames]);

  // Calculate combined edge strength for top 3
  const combinedEdgeStrength = useMemo(() => {
    return topPicks.reduce((sum, game) => sum + game.edgeStrength, 0);
  }, [topPicks]);

  // Quick parlay handler - saves top edge picks to localStorage and navigates to parlay
  const handleQuickParlay = () => {
    if (topPicks.length === 0) {
      toast.error("No edge picks available for parlay");
      return;
    }

    // Store edge picks for parlay page to consume
    // Always pick the strongest edge (over or under) for each game
    const edgePicks = topPicks.map(game => {
      const overEdge = Math.max(0, game.best_over_edge ?? 0);
      const underEdge = Math.max(0, game.best_under_edge ?? 0);
      const useUnder = underEdge > overEdge;
      
      return {
        gameId: game.game_id,
        sportId: game.sport_id,
        pick: useUnder ? "under" : "over",
        edgeStrength: game.edgeStrength,
        line: useUnder ? game.p05_under_line : game.p95_over_line,
        odds: useUnder ? game.p05_under_odds : game.p95_over_odds,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
      };
    });

    localStorage.setItem(EDGE_PARLAY_KEY, JSON.stringify(edgePicks));
    toast.success(`Added ${topPicks.length} edge picks to parlay`);
    navigate("/parlay");
  };

  // Lock parlay handler - only 95%+ probability picks
  const handleLockParlay = () => {
    if (lockPicks.length === 0) {
      toast.error("No 95%+ probability picks available");
      return;
    }

    const edgePicks = lockPicks.map(game => ({
      gameId: game.game_id,
      sportId: game.sport_id,
      pick: game.bestPick || "over",
      edgeStrength: game.edgeStrength,
      hitProbability: game.hitProbability,
      line: game.bestPick === "under" ? game.p05_under_line : game.p95_over_line,
      odds: game.bestPick === "under" ? game.p05_under_odds : game.p95_over_odds,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
    }));

    localStorage.setItem(EDGE_PARLAY_KEY, JSON.stringify(edgePicks));
    toast.success(`Added ${lockPicks.length} lock picks to parlay`);
    navigate("/parlay");
  };

  return (
    <>
      <Helmet>
        <title>Best Bets | Edge Detection</title>
        <meta
          name="description"
          content="Find the best value bets where DraftKings lines approach historical extremes. Edge detection identifies games with statistical advantages."
        />
      </Helmet>

      <Layout>
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in px-4 py-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-status-live/10">
                  <Zap className="h-6 w-6 text-status-live" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">Best Bets</h1>
                    {lockPicks.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className="bg-yellow-500 text-yellow-950 animate-pulse cursor-help font-bold">
                            <Trophy className="h-3 w-3 mr-1" />
                            {lockPicks.length} Lock{lockPicks.length !== 1 ? 's' : ''}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">
                            <strong>Lock Picks:</strong> {lockPicks.length} game{lockPicks.length !== 1 ? 's' : ''} with 95%+ hit probability based on DK lines beyond historical extremes.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {beyondExtremesCount > 0 && beyondExtremesCount !== lockPicks.length && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className="bg-status-live text-white cursor-help">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {beyondExtremesCount} beyond extremes
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">
                            <strong>Beyond Extremes:</strong> These games have DraftKings lines set outside the historical p05/p95 range — meaning the line is lower than the 5th percentile or higher than the 95th percentile of past matchup totals. This is rare and may indicate significant value.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Games with DraftKings lines near historical p05/p95 extremes
                  </p>
                </div>
              </div>
              <Link to="/parlay-optimizer">
                <Button variant="outline" size="sm" className="gap-2">
                  <Target className="h-4 w-4" />
                  Parlay Optimizer
                </Button>
              </Link>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

                {/* Edge Type Filter */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Edge Type</label>
                  <Select
                    value={edgeFilter}
                    onValueChange={(v) => setEdgeFilter(v as EdgeFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDGE_FILTERS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Sort By</label>
                  <Select
                    value={sortBy}
                    onValueChange={(v) => setSortBy(v as SortOption)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Min Confidence */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Min Confidence: {minConfidence}%
                  </label>
                  <Slider
                    value={[minConfidence]}
                    onValueChange={([v]) => setMinConfidence(v)}
                    min={20}
                    max={90}
                    step={5}
                    className="mt-2"
                  />
                </div>

                {/* Min Sample Size */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Min Sample: {minSampleSize} games
                  </label>
                  <Slider
                    value={[minSampleSize]}
                    onValueChange={([v]) => setMinSampleSize(v)}
                    min={3}
                    max={20}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </div>
              
              {/* Hit Probability Filter */}
              <div className="space-y-2 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    Min Hit Probability
                  </label>
                  <span className="text-xs font-medium">
                    {minHitProbability === 0 ? "Any" : `${minHitProbability}%+`}
                  </span>
                </div>
                <div className="flex gap-2">
                  {[0, 60, 70, 80, 90].map((threshold) => (
                    <Button
                      key={threshold}
                      variant={minHitProbability === threshold ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMinHitProbability(threshold)}
                      className={cn(
                        "flex-1 text-xs h-8",
                        minHitProbability === threshold && "bg-primary"
                      )}
                    >
                      {threshold === 0 ? "Any" : `${threshold}%+`}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Beyond Extremes Filter */}
              <div className="flex items-center gap-3 pt-2 border-t">
                <Switch
                  id="beyond-extremes"
                  checked={beyondExtremesOnly}
                  onCheckedChange={setBeyondExtremesOnly}
                />
                <Label htmlFor="beyond-extremes" className="flex items-center gap-2 cursor-pointer">
                  <AlertTriangle className="h-4 w-4 text-status-live" />
                  <span className="text-sm">Show only games beyond historical extremes</span>
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Lock Parlay - 95%+ Hit Probability */}
          {lockPicks.length > 0 && (
            <Card className="border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-1.5 rounded-lg bg-yellow-500/20 animate-pulse">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                    </div>
                    Lock Parlay
                    <Badge className="bg-yellow-500 text-yellow-950 hover:bg-yellow-500">
                      95%+ Hits Only
                    </Badge>
                  </CardTitle>
                  <Button
                    onClick={handleLockParlay}
                    className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-semibold"
                    size="sm"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Build Lock Parlay ({lockPicks.length})
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Games where the DK line is beyond historical extremes — statistically 95%+ likely to hit
                </p>
                
                {/* Combined Probability Display */}
                {lockPicks.length >= 2 && (
                  <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium">Combined Parlay Probability</span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className="bg-yellow-600 text-white font-bold text-sm cursor-help">
                            {(lockPicks.reduce((acc, g) => acc * (g.hitProbability / 100), 1) * 100).toFixed(1)}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3">
                          <div className="text-xs space-y-2">
                            <p className="font-semibold">How it's calculated:</p>
                            <p className="text-muted-foreground">
                              Combined probability = multiply each leg's probability together.
                            </p>
                            <div className="space-y-1 pt-1 border-t border-border/40">
                              {lockPicks.map((g, i) => (
                                <div key={g.game_id} className="flex justify-between">
                                  <span>Leg {i + 1}:</span>
                                  <span className="font-mono">{g.hitProbability.toFixed(1)}%</span>
                                </div>
                              ))}
                              <div className="flex justify-between pt-1 border-t font-semibold">
                                <span>Combined:</span>
                                <span className="font-mono">
                                  {(lockPicks.reduce((acc, g) => acc * (g.hitProbability / 100), 1) * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {lockPicks.length} legs × avg {(lockPicks.reduce((sum, g) => sum + g.hitProbability, 0) / lockPicks.length).toFixed(0)}% per leg
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {lockPicks.map((game, idx) => (
                    <LockPickRow key={game.game_id} game={game} rank={idx + 1} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Picks with Quick Parlay */}
          {topPicks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Top Picks by Hit Probability
                  <Badge variant="outline" className="ml-2 text-status-over border-status-over/30">
                    avg {(topPicks.reduce((sum, g) => sum + g.hitProbability, 0) / topPicks.length).toFixed(0)}% hit rate
                  </Badge>
                </h2>
                <Button
                  onClick={handleQuickParlay}
                  className="bg-status-edge hover:bg-status-edge/90 text-white"
                  size="sm"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Quick Parlay ({topPicks.length})
                </Button>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {topPicks.map((game, idx) => (
                  <TopPickCard key={game.game_id} game={game} rank={idx + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Other Ranked Games */}
          {otherPicks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                More Edges ({otherPicks.length})
              </h2>
              <div className="space-y-2">
                {otherPicks.map((game, idx) => (
                  <RankedGameRow key={game.game_id} game={game} rank={idx + 4} />
                ))}
              </div>
            </div>
          )}

          {/* Today's Final Games with Results */}
          {showFinalGames && finalGames.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  Today's Results ({finalGames.length})
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFinalGames(false)}
                  className="text-xs text-muted-foreground"
                >
                  Hide
                </Button>
              </div>
              <div className="space-y-2">
                {finalGames.map((game) => (
                  <FinalGameRow key={game.game_id} game={game} />
                ))}
              </div>
            </div>
          )}

          {/* Historical Accuracy Tracker */}
          <EdgeAccuracyCard />

          {/* Empty State */}
          {rankedGames.length === 0 && finalGames.length === 0 && !isLoading && (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-medium mb-1">No games with edges found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try adjusting filters or check back later for more games
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEdgeFilter("all");
                    setMinConfidence(30);
                    setMinSampleSize(3);
                  }}
                >
                  Show All Games
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && rankedGames.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-muted-foreground">
                  Loading games...
                </div>
              </CardContent>
            </Card>
          )}

          {/* Explanation */}
          <Card className="bg-muted/30">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">
                <strong>Edge Detection</strong> identifies games where DraftKings alternate lines approach 
                historical p05/p95 extremes. A "3.5 pts edge" means the DK line is 3.5 points beyond 
                the historical percentile — potentially offering value if history repeats.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </>
  );
}

function TopPickCard({ game, rank }: { game: RankedGame; rank: number }) {
  const homeTeamName = getTeamDisplayName(game.home_team, game.sport_id);
  const awayTeamName = getTeamDisplayName(game.away_team, game.sport_id);
  const startTime = new Date(game.start_time_utc);

  const rankColors = {
    1: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
    2: "from-slate-400/20 to-slate-400/5 border-slate-400/30",
    3: "from-amber-600/20 to-amber-600/5 border-amber-600/30",
  };

  return (
    <Link
      to={`/game/${game.game_id}`}
      className={cn(
        "block p-4 rounded-2xl border bg-gradient-to-br transition-all hover:shadow-md hover:-translate-y-0.5",
        rankColors[rank as 1 | 2 | 3] || "from-muted/20 to-muted/5 border-border"
      )}
    >
      {/* Rank & Probability Badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-2xl font-bold",
            rank === 1 ? "text-yellow-500" : 
            rank === 2 ? "text-slate-400" : "text-amber-600"
          )}>
            #{rank}
          </span>
          <span className="text-2xs uppercase font-semibold text-muted-foreground">
            {game.sport_id}
          </span>
          {game.isBeyondExtremes && (
            <Badge variant="outline" className="px-1.5 py-0 text-2xs bg-status-live/10 text-status-live border-status-live/30 animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
              Beyond
            </Badge>
          )}
        </div>
        <HitProbabilityBadge 
          probability={game.hitProbability} 
          bestPick={game.bestPick}
          dkLine={game.dk_total_line}
          p05={game.p05}
          p95={game.p95}
        />
      </div>

      {/* Teams */}
      <div className="space-y-1 mb-3">
        <div className="font-medium truncate">{awayTeamName}</div>
        <div className="font-medium truncate">@ {homeTeamName}</div>
      </div>

      {/* Time */}
      <div className="text-xs text-muted-foreground mb-3">
        {formatTimeET(startTime)} ET
      </div>

      {/* Percentile Chart */}
      <MiniPercentileChart
        p05={game.p05}
        p95={game.p95}
        dkLine={game.dk_total_line}
        className="mb-3"
      />

      {/* Edge Info */}
      <div className="space-y-2 mb-3">
        {game.p95_over_line !== null && game.p95_over_odds !== null && (
          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-status-over/10">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-status-over" />
              <span className="text-sm font-medium">O{game.p95_over_line}</span>
            </div>
            <span className="text-sm font-bold text-status-over">{formatOdds(game.p95_over_odds)}</span>
          </div>
        )}
        {game.p05_under_line !== null && game.p05_under_odds !== null && (
          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-status-under/10">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-status-under" />
              <span className="text-sm font-medium">U{game.p05_under_line}</span>
            </div>
            <span className="text-sm font-bold text-status-under">{formatOdds(game.p05_under_odds)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-muted-foreground">n={game.n_h2h}</span>
          {game.segment_used && (
            <SegmentBadge segment={game.segment_used} showTooltip={false} />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <DkDistanceBadge 
            dkLine={game.dk_total_line} 
            p05={game.p05} 
            p95={game.p95}
            compact
          />
          <EdgeStrengthBadge edgeStrength={game.edgeStrength} />
        </div>
      </div>
    </Link>
  );
}

function RankedGameRow({ game, rank }: { game: RankedGame; rank: number }) {
  const homeTeamName = getTeamDisplayName(game.home_team, game.sport_id);
  const awayTeamName = getTeamDisplayName(game.away_team, game.sport_id);
  const startTime = new Date(game.start_time_utc);

  return (
    <Link
      to={`/game/${game.game_id}`}
      className={cn(
        "flex items-center gap-4 p-3 rounded-xl bg-card border border-border/60 hover:border-border transition-colors group",
        game.isBeyondExtremes && "border-status-live/30 bg-status-live/5"
      )}
    >
      {/* Rank */}
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-muted-foreground w-8 text-center">
          #{rank}
        </span>
        {game.isBeyondExtremes && (
          <AlertTriangle className="h-4 w-4 text-status-live animate-pulse" />
        )}
      </div>

      {/* Teams & Chart */}
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <div className="text-sm font-medium truncate">
            {awayTeamName} @ {homeTeamName}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="uppercase">{game.sport_id}</span>
            <span>•</span>
            <span>{formatTimeET(startTime)} ET</span>
            <span>•</span>
            <span>n={game.n_h2h}</span>
          </div>
        </div>
        {/* Mini Chart */}
        <MiniPercentileChart
          p05={game.p05}
          p95={game.p95}
          dkLine={game.dk_total_line}
        />
      </div>

      {/* Hit Probability & Edge Info */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <HitProbabilityBadge 
          probability={game.hitProbability} 
          bestPick={game.bestPick}
          dkLine={game.dk_total_line}
          p05={game.p05}
          p95={game.p95}
          compact 
        />
        <EdgeStrengthBadge edgeStrength={game.edgeStrength} />
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
    </Link>
  );
}

function EdgeTypeBadge({ edgeType }: { edgeType: RankedGame["edgeType"] }) {
  if (edgeType === "none") return null;
  
  if (edgeType === "both") {
    return (
      <div className="flex items-center gap-0.5">
        <Badge variant="outline" className="px-1.5 py-0 text-2xs bg-status-over/10 text-status-over border-status-over/20">
          O
        </Badge>
        <Badge variant="outline" className="px-1.5 py-0 text-2xs bg-status-under/10 text-status-under border-status-under/20">
          U
        </Badge>
      </div>
    );
  }
  
  if (edgeType === "over") {
    return (
      <Badge variant="outline" className="px-1.5 py-0.5 text-2xs bg-status-over/10 text-status-over border-status-over/20">
        <TrendingUp className="h-3 w-3 mr-0.5" />
        Over
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="px-1.5 py-0.5 text-2xs bg-status-under/10 text-status-under border-status-under/20">
      <TrendingDown className="h-3 w-3 mr-0.5" />
      Under
    </Badge>
  );
}

// Hit probability badge showing likelihood of pick hitting with color-coded direction
function HitProbabilityBadge({ 
  probability, 
  bestPick, 
  compact = false,
  dkLine,
  p05,
  p95,
}: { 
  probability: number; 
  bestPick: "over" | "under" | null; 
  compact?: boolean;
  dkLine?: number | null;
  p05?: number | null;
  p95?: number | null;
}) {
  // Color based on pick direction - OVER = green, UNDER = blue
  const getPickColor = () => {
    if (bestPick === "over") {
      if (probability >= 80) return "text-status-over bg-status-over/20 border-status-over/50";
      if (probability >= 60) return "text-status-over bg-status-over/10 border-status-over/30";
      return "text-status-over/70 bg-status-over/5 border-status-over/20";
    }
    if (bestPick === "under") {
      if (probability >= 80) return "text-status-under bg-status-under/20 border-status-under/50";
      if (probability >= 60) return "text-status-under bg-status-under/10 border-status-under/30";
      return "text-status-under/70 bg-status-under/5 border-status-under/20";
    }
    return "text-muted-foreground bg-muted/30 border-muted-foreground/30";
  };
  
  const pickLabel = bestPick === "over" ? "OVER" : bestPick === "under" ? "UNDER" : "";
  const pickIcon = bestPick === "over" ? <TrendingUp className="h-3 w-3" /> : bestPick === "under" ? <TrendingDown className="h-3 w-3" /> : null;
  
  // Calculate position info for tooltip
  const getTooltipContent = () => {
    const lineInfo = dkLine && p05 && p95 ? (
      <div className="space-y-1.5 mt-2 pt-2 border-t border-border/40">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">DK Line:</span>
          <span className="font-mono">{dkLine}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">P5 (Low):</span>
          <span className="font-mono">{p05}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">P95 (High):</span>
          <span className="font-mono">{p95}</span>
        </div>
        {dkLine < p05 && (
          <div className="text-xs text-status-under font-medium">
            Line is {(p05 - dkLine).toFixed(1)} pts below historical low
          </div>
        )}
        {dkLine > p95 && (
          <div className="text-xs text-status-over font-medium">
            Line is {(dkLine - p95).toFixed(1)} pts above historical high
          </div>
        )}
      </div>
    ) : null;

    return (
      <div className="text-xs max-w-[280px]">
        <div className="font-semibold mb-1.5">Hit Probability: {probability.toFixed(0)}%</div>
        <div className="text-muted-foreground leading-relaxed">
          Based on where the DK line sits relative to historical p05/p95:
        </div>
        <ul className="mt-1.5 space-y-0.5 text-muted-foreground text-2xs">
          <li>• <strong>Near p05:</strong> High UNDER probability (~95%)</li>
          <li>• <strong>Near p95:</strong> High OVER probability (~95%)</li>
          <li>• <strong>At median:</strong> ~50% either way</li>
          <li>• <strong>Beyond extremes:</strong> Up to 99%</li>
        </ul>
        {lineInfo}
      </div>
    );
  };
  
  const badge = (
    <Badge 
      variant="outline" 
      className={cn(
        "font-bold tabular-nums cursor-help gap-1", 
        getPickColor(), 
        compact ? "px-1.5 py-0 text-2xs" : "px-2 py-0.5 text-xs"
      )}
    >
      {pickIcon}
      {!compact && pickLabel && <span>{pickLabel}</span>}
      <span>{probability.toFixed(0)}%</span>
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" className="p-3">
        {getTooltipContent()}
      </TooltipContent>
    </Tooltip>
  );
}

// Edge strength visual indicator with color coding
function EdgeStrengthBadge({ edgeStrength }: { edgeStrength: number }) {
  const getEdgeInfo = (edge: number) => {
    if (edge > 2) return { label: "Strong", color: "text-status-live bg-status-live/10 border-status-live/30" };
    if (edge >= 1) return { label: "Moderate", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" };
    return { label: "Weak", color: "text-muted-foreground bg-muted/30 border-muted-foreground/30" };
  };
  
  const { label, color } = getEdgeInfo(edgeStrength);
  
  return (
    <Badge variant="outline" className={cn("px-1.5 py-0.5 text-2xs", color)}>
      {edgeStrength.toFixed(1)} pts • {label}
    </Badge>
  );
}

// Component for displaying final games with results
function FinalGameRow({ game }: { game: RankedGame }) {
  const homeTeamName = getTeamDisplayName(game.home_team, game.sport_id);
  const awayTeamName = getTeamDisplayName(game.away_team, game.sport_id);
  
  const finalTotal = game.final_total;
  const dkLine = game.dk_total_line;
  const isOver = finalTotal !== null && dkLine !== null && finalTotal > dkLine;
  const isPush = finalTotal !== null && dkLine !== null && finalTotal === dkLine;
  
  // Determine if the edge pick hit
  const overEdge = game.best_over_edge ?? 0;
  const underEdge = game.best_under_edge ?? 0;
  const predictedOver = overEdge > underEdge;
  
  let result: "hit" | "miss" | "push" = "push";
  if (finalTotal !== null && dkLine !== null) {
    if (isPush) {
      result = "push";
    } else if (predictedOver && isOver) {
      result = "hit";
    } else if (!predictedOver && !isOver) {
      result = "hit";
    } else {
      result = "miss";
    }
  }

  const ResultIcon = result === "hit" ? CheckCircle2 : result === "miss" ? AlertTriangle : Target;

  return (
    <Link
      to={`/game/${game.game_id}`}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border transition-colors group",
        result === "hit" && "bg-status-over/5 border-status-over/30",
        result === "miss" && "bg-status-live/5 border-status-live/30",
        result === "push" && "bg-muted/30 border-border"
      )}
    >
      {/* Result Icon */}
      <ResultIcon className={cn(
        "h-5 w-5 flex-shrink-0",
        result === "hit" && "text-status-over",
        result === "miss" && "text-status-live",
        result === "push" && "text-muted-foreground"
      )} />

      {/* Teams & Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {awayTeamName} @ {homeTeamName}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase">{game.sport_id}</span>
          <span>•</span>
          <span>Edge: {predictedOver ? "OVER" : "UNDER"}</span>
          {game.isBeyondExtremes && (
            <>
              <span>•</span>
              <AlertTriangle className="h-3 w-3 text-status-live" />
            </>
          )}
        </div>
      </div>

      {/* Result Display */}
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-2">
          {finalTotal !== null && dkLine !== null && (
            <div className="text-right">
              <div className="text-sm font-bold tabular-nums">
                {finalTotal}
              </div>
              <div className="text-2xs text-muted-foreground tabular-nums">
                vs {dkLine}
              </div>
            </div>
          )}
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs px-2 py-0.5",
              result === "hit" && "bg-status-over/10 text-status-over border-status-over/30",
              result === "miss" && "bg-status-live/10 text-status-live border-status-live/30",
              result === "push" && "bg-muted text-muted-foreground border-border"
            )}
          >
            {result === "hit" ? "HIT" : result === "miss" ? "MISS" : "PUSH"}
          </Badge>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
    </Link>
  );
}

// Lock Pick Row for 95%+ probability games
function LockPickRow({ game, rank }: { game: RankedGame; rank: number }) {
  const homeTeamName = getTeamDisplayName(game.home_team, game.sport_id);
  const awayTeamName = getTeamDisplayName(game.away_team, game.sport_id);
  const startTime = new Date(game.start_time_utc);
  
  const pickLabel = game.bestPick === "over" ? "OVER" : "UNDER";
  const pickLine = game.bestPick === "under" ? game.p05_under_line : game.p95_over_line;
  const pickOdds = game.bestPick === "under" ? game.p05_under_odds : game.p95_over_odds;

  return (
    <Link
      to={`/game/${game.game_id}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/30 hover:border-yellow-500/50 transition-colors group"
    >
      {/* Rank */}
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 font-bold text-sm">
        {rank}
      </div>

      {/* Teams & Time */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {awayTeamName} @ {homeTeamName}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase font-medium">{game.sport_id}</span>
          <span>•</span>
          <span>{formatTimeET(startTime)} ET</span>
        </div>
      </div>

      {/* Pick Info */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge 
          className={cn(
            "font-bold gap-1",
            game.bestPick === "over" 
              ? "bg-status-over text-white hover:bg-status-over" 
              : "bg-status-under text-white hover:bg-status-under"
          )}
        >
          {game.bestPick === "over" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {pickLabel} {pickLine}
        </Badge>
        <Badge className="bg-yellow-500 text-yellow-950 font-bold hover:bg-yellow-500">
          {game.hitProbability.toFixed(0)}%
        </Badge>
        {pickOdds && (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {pickOdds >= 0 ? `+${pickOdds}` : pickOdds}
          </span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-yellow-500 transition-colors flex-shrink-0" />
    </Link>
  );
}
