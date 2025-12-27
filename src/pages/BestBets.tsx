import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Layout } from "@/components/layout/Layout";
import { useTodayGames } from "@/hooks/useApi";
import { calculateConfidence, type ConfidenceResult } from "@/lib/confidenceScore";
import { getTeamDisplayName, formatTimeET } from "@/lib/teamNames";
import { ConfidenceBadge } from "@/components/game/ConfidenceBadge";
import { RecencyIndicator } from "@/components/game/RecencyIndicator";
import { PickPill } from "@/components/game/PickPill";
import { SegmentBadge } from "@/components/game/SegmentBadge";
import { PercentileBar } from "@/components/ui/percentile-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
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
  Filter,
  ChevronRight,
  Star,
  Zap,
} from "lucide-react";
import type { SportId } from "@/types";
import type { TodayGame } from "@/hooks/useApi";

const SPORTS: { id: SportId | "all"; label: string }[] = [
  { id: "all", label: "All Sports" },
  { id: "nfl", label: "NFL" },
  { id: "nba", label: "NBA" },
  { id: "mlb", label: "MLB" },
  { id: "nhl", label: "NHL" },
];

interface RankedGame extends TodayGame {
  confidence: ConfidenceResult;
}

export default function BestBets() {
  const [sportFilter, setSportFilter] = useState<SportId | "all">("all");
  const [minConfidence, setMinConfidence] = useState(50);
  const [minSampleSize, setMinSampleSize] = useState(5);

  // Get today's date in ET
  const today = useMemo(() => {
    const now = new Date();
    const etDate = toZonedTime(now, 'America/New_York');
    return etDate;
  }, []);

  // Fetch games for each sport
  const { data: nflData } = useTodayGames(today, "nfl");
  const { data: nbaData } = useTodayGames(today, "nba");
  const { data: mlbData } = useTodayGames(today, "mlb");
  const { data: nhlData } = useTodayGames(today, "nhl");

  // Combine and rank all games
  const rankedGames = useMemo(() => {
    const allGames: TodayGame[] = [
      ...(nflData?.games || []),
      ...(nbaData?.games || []),
      ...(mlbData?.games || []),
      ...(nhlData?.games || []),
    ];

    // Calculate confidence for each game and filter
    const gamesWithConfidence: RankedGame[] = allGames
      .filter(game => game.status !== "final") // Only upcoming/live games
      .map(game => ({
        ...game,
        confidence: calculateConfidence({
          nGames: game.n_h2h,
          segment: game.segment_used,
        }),
      }))
      .filter(game => 
        game.confidence.score >= minConfidence &&
        game.n_h2h >= minSampleSize &&
        (sportFilter === "all" || game.sport_id === sportFilter)
      )
      .sort((a, b) => b.confidence.score - a.confidence.score);

    return gamesWithConfidence;
  }, [nflData, nbaData, mlbData, nhlData, sportFilter, minConfidence, minSampleSize]);

  const topPicks = rankedGames.slice(0, 3);
  const otherPicks = rankedGames.slice(3);

  return (
    <>
      <Helmet>
        <title>Best Bets | Game Percentiles</title>
        <meta
          name="description"
          content="Today's most reliable predictions ranked by data confidence. Find the best value bets based on sample size, recency, and historical accuracy."
        />
      </Helmet>

      <Layout>
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in px-4 py-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Best Bets</h1>
                <p className="text-muted-foreground text-sm">
                  Games ranked by prediction reliability
                </p>
              </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    Min Sample Size: {minSampleSize} games
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

          {/* Top Picks */}
          {topPicks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Top Picks
              </h2>
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
                <Zap className="h-5 w-5 text-muted-foreground" />
                More Picks ({otherPicks.length})
              </h2>
              <div className="space-y-2">
                {otherPicks.map((game, idx) => (
                  <RankedGameRow key={game.game_id} game={game} rank={idx + 4} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {rankedGames.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-medium mb-1">No games match your filters</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try lowering the minimum confidence or sample size
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMinConfidence(40);
                    setMinSampleSize(3);
                  }}
                >
                  Reset Filters
                </Button>
              </CardContent>
            </Card>
          )}
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
        </div>
        <div className={cn(
          "text-2xl font-bold",
          game.confidence.color
        )}>
          {game.confidence.score}
        </div>
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

      {/* Pick Pill */}
      <PickPill
        nH2H={game.n_h2h}
        dkOffered={game.dk_offered}
        dkTotalLine={game.dk_total_line}
        dkLinePercentile={game.dk_line_percentile}
        isFinal={false}
        className="text-xs"
      />

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-muted-foreground">n={game.n_h2h}</span>
          {game.segment_used && (
            <SegmentBadge segment={game.segment_used} showTooltip={false} />
          )}
        </div>
        <span className={cn("text-xs font-medium", game.confidence.color)}>
          {game.confidence.label}
        </span>
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
      className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border/60 hover:border-border transition-colors group"
    >
      {/* Rank */}
      <div className="text-lg font-bold text-muted-foreground w-8 text-center">
        #{rank}
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

      {/* Confidence */}
      <div className="flex items-center gap-3">
        <ConfidenceBadge
          nGames={game.n_h2h}
          segment={game.segment_used}
          showDetails={false}
        />
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
      </div>
    </Link>
  );
}
