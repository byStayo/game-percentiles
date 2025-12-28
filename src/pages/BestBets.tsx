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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
}

function formatOdds(odds: number): string {
  if (odds >= 0) return `+${odds}`;
  return odds.toString();
}

export default function BestBets() {
  const navigate = useNavigate();
  const [sportFilter, setSportFilter] = useState<SportId | "all">("all");
  const [edgeFilter, setEdgeFilter] = useState<EdgeFilter>("any-edge");
  const [sortBy, setSortBy] = useState<SortOption>("edge-strength");
  const [minConfidence, setMinConfidence] = useState(40);
  const [minSampleSize, setMinSampleSize] = useState(5);

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
  const rankedGames = useMemo(() => {
    const allGames: TodayGame[] = [
      ...(nflData?.games || []),
      ...(nbaData?.games || []),
      ...(mlbData?.games || []),
      ...(nhlData?.games || []),
    ];

    // Calculate confidence and edge type for each game
    const gamesWithEdges: RankedGame[] = allGames
      .filter(game => game.status !== "final") // Only upcoming/live games
      .map(game => {
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
        const distanceToP05 = Math.abs(dkLine - p05);
        const distanceToP95 = Math.abs(dkLine - p95);
        const dkDistanceFromPercentile = Math.min(distanceToP05, distanceToP95);
        
        // Check if DK line extends beyond historical extremes
        const isBeyondExtremes = dkLine < p05 || dkLine > p95;
        
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
        };
      })
      .filter(game => {
        // Apply filters
        if (game.confidence.score < minConfidence) return false;
        if (game.n_h2h < minSampleSize) return false;
        if (sportFilter !== "all" && game.sport_id !== sportFilter) return false;
        
        // Edge filter - also filter out zero/negative edges
        if (edgeFilter === "over" && game.edgeType !== "over" && game.edgeType !== "both") return false;
        if (edgeFilter === "under" && game.edgeType !== "under" && game.edgeType !== "both") return false;
        if (edgeFilter === "any-edge" && (game.edgeType === "none" || game.edgeStrength <= 0)) return false;
        
        return true;
      })
      // Sort based on selected option
      .sort((a, b) => {
        switch (sortBy) {
          case "edge-strength":
            if (b.edgeStrength !== a.edgeStrength) {
              return b.edgeStrength - a.edgeStrength;
            }
            return b.confidence.score - a.confidence.score;
          case "dk-distance":
            // Lower distance = closer to percentile = better
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
            return b.edgeStrength - a.edgeStrength;
        }
      });

    return gamesWithEdges;
  }, [nflData, nbaData, mlbData, nhlData, sportFilter, edgeFilter, sortBy, minConfidence, minSampleSize]);

  const topPicks = rankedGames.slice(0, 3);
  const otherPicks = rankedGames.slice(3);

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
                    {beyondExtremesCount > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className="bg-status-live text-white animate-pulse cursor-help">
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
            </CardContent>
          </Card>

          {/* Top Picks with Quick Parlay */}
          {topPicks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Top Edge Picks
                  <Badge variant="outline" className="ml-2 text-status-edge border-status-edge/30">
                    {combinedEdgeStrength.toFixed(1)} pts combined
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

          {/* Empty State */}
          {rankedGames.length === 0 && !isLoading && (
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
      {/* Rank Badge */}
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
        <EdgeTypeBadge edgeType={game.edgeType} />
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

      {/* Teams */}
      <div className="flex-1 min-w-0">
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

      {/* Edge Info */}
      <div className="flex items-center gap-2">
        <DkDistanceBadge 
          dkLine={game.dk_total_line} 
          p05={game.p05} 
          p95={game.p95}
          compact
        />
        <EdgeTypeBadge edgeType={game.edgeType} />
        <EdgeStrengthBadge edgeStrength={game.edgeStrength} />
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
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
