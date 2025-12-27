import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay } from "date-fns";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { calculateConfidence } from "@/lib/confidenceScore";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Percent,
  Calendar,
  Filter,
  BarChart3,
  Activity,
  DollarSign,
  Trophy,
  Swords,
  Building,
  Flame,
} from "lucide-react";
import type { SportId } from "@/types";

const SPORTS: { id: SportId | "all"; label: string }[] = [
  { id: "all", label: "All Sports" },
  { id: "nfl", label: "NFL" },
  { id: "nba", label: "NBA" },
  { id: "mlb", label: "MLB" },
  { id: "nhl", label: "NHL" },
];

const TIME_RANGES = [
  { id: "7d", label: "Last 7 Days", days: 7 },
  { id: "30d", label: "Last 30 Days", days: 30 },
  { id: "90d", label: "Last 90 Days", days: 90 },
  { id: "all", label: "All Time", days: 365 },
];

interface PredictionResult {
  game_id: string;
  date_local: string;
  sport_id: SportId;
  dk_total_line: number;
  dk_line_percentile: number;
  final_total: number;
  n_h2h: number;
  segment_used: string | null;
  predicted_direction: "over" | "under" | "push";
  actual_direction: "over" | "under" | "push";
  is_correct: boolean;
  confidence_score: number;
  is_playoff: boolean;
  is_division: boolean;
  is_rivalry: boolean;
}

// Standard vig/juice for sports betting (-110 odds = 4.55% juice per side)
const STANDARD_VIG = -110;
const BET_AMOUNT = 100;

// Calculate profit from a winning bet at -110 odds
const calculateWinProfit = (betAmount: number, odds: number = STANDARD_VIG): number => {
  if (odds < 0) {
    return betAmount * (100 / Math.abs(odds));
  }
  return betAmount * (odds / 100);
};

// Calculate ROI percentage
const calculateROI = (totalProfit: number, totalWagered: number): number => {
  if (totalWagered === 0) return 0;
  return (totalProfit / totalWagered) * 100;
};

interface MatchupTypeStats {
  type: string;
  icon: typeof Trophy;
  total: number;
  correct: number;
  accuracy: number;
  profit: number;
  roi: number;
}

export default function AccuracyTracking() {
  const [sportFilter, setSportFilter] = useState<SportId | "all">("all");
  const [timeRange, setTimeRange] = useState("30d");
  const [minConfidence, setMinConfidence] = useState<number | "all">("all");

  const selectedRange = TIME_RANGES.find((r) => r.id === timeRange) || TIME_RANGES[1];
  const startDate = format(subDays(startOfDay(new Date()), selectedRange.days), "yyyy-MM-dd");

  // Fetch historical predictions with results
  const { data: predictions, isLoading } = useQuery({
    queryKey: ["accuracy-tracking", startDate, sportFilter],
    queryFn: async () => {
      let query = supabase
        .from("daily_edges")
        .select(`
          game_id,
          date_local,
          sport_id,
          dk_total_line,
          dk_line_percentile,
          n_h2h,
          segment_used,
          games!inner(final_total, status, is_playoff, home_team_id, away_team_id)
        `)
        .eq("dk_offered", true)
        .not("dk_line_percentile", "is", null)
        .gte("date_local", startDate)
        .order("date_local", { ascending: false });

      if (sportFilter !== "all") {
        query = query.eq("sport_id", sportFilter);
      }

      const { data, error } = await query.limit(1000);

      if (error) throw error;

      // Get team seasons for division info
      const gameIds = (data || []).map(d => d.game_id);
      const teamIds = new Set<string>();
      for (const edge of data || []) {
        const game = edge.games as unknown as { home_team_id: string; away_team_id: string };
        teamIds.add(game.home_team_id);
        teamIds.add(game.away_team_id);
      }

      // Fetch team seasons for division matchups
      const { data: teamSeasons } = await supabase
        .from("team_seasons")
        .select("team_id, division, conference")
        .in("team_id", Array.from(teamIds));

      const teamDivisionMap: Record<string, { division: string | null; conference: string | null }> = {};
      for (const ts of teamSeasons || []) {
        teamDivisionMap[ts.team_id] = { division: ts.division, conference: ts.conference };
      }

      // Process results
      const results: PredictionResult[] = [];

      for (const edge of data || []) {
        const game = edge.games as unknown as { 
          final_total: number | null; 
          status: string; 
          is_playoff: boolean | null;
          home_team_id: string;
          away_team_id: string;
        };
        if (game.status !== "final" || game.final_total === null) continue;

        const dkLine = edge.dk_total_line!;
        const finalTotal = game.final_total;
        const percentile = edge.dk_line_percentile!;

        // Determine matchup types
        const homeTeamInfo = teamDivisionMap[game.home_team_id];
        const awayTeamInfo = teamDivisionMap[game.away_team_id];
        
        const isDivision = !!(homeTeamInfo?.division && awayTeamInfo?.division && 
          homeTeamInfo.division === awayTeamInfo.division);
        
        // Rivalry detection: same division or historic matchups (n_h2h > 50)
        const isRivalry = isDivision || edge.n_h2h > 50;

        // Determine predicted direction based on percentile
        let predictedDirection: "over" | "under" | "push";
        if (percentile <= 20) {
          predictedDirection = "over"; // Line is low, expect over
        } else if (percentile >= 80) {
          predictedDirection = "under"; // Line is high, expect under
        } else {
          predictedDirection = "push"; // No strong prediction
        }

        // Determine actual outcome
        let actualDirection: "over" | "under" | "push";
        if (finalTotal > dkLine) {
          actualDirection = "over";
        } else if (finalTotal < dkLine) {
          actualDirection = "under";
        } else {
          actualDirection = "push";
        }

        // Calculate if prediction was correct
        const isCorrect =
          predictedDirection === "push" ||
          actualDirection === "push" ||
          predictedDirection === actualDirection;

        // Calculate confidence
        const confidence = calculateConfidence({
          nGames: edge.n_h2h,
          segment: edge.segment_used,
        });

        results.push({
          game_id: edge.game_id,
          date_local: edge.date_local,
          sport_id: edge.sport_id as SportId,
          dk_total_line: dkLine,
          dk_line_percentile: percentile,
          final_total: finalTotal,
          n_h2h: edge.n_h2h,
          segment_used: edge.segment_used,
          predicted_direction: predictedDirection,
          actual_direction: actualDirection,
          is_correct: isCorrect,
          confidence_score: confidence.score,
          is_playoff: game.is_playoff || false,
          is_division: isDivision,
          is_rivalry: isRivalry,
        });
      }

      return results;
    },
  });

  // Filter by confidence if selected
  const filteredPredictions = useMemo(() => {
    if (!predictions) return [];
    if (minConfidence === "all") return predictions;
    return predictions.filter((p) => p.confidence_score >= minConfidence);
  }, [predictions, minConfidence]);

  // Calculate overall accuracy stats with ROI
  const stats = useMemo(() => {
    const actionable = filteredPredictions.filter(
      (p) => p.predicted_direction !== "push"
    );
    const correct = actionable.filter((p) => p.is_correct);

    // Calculate ROI
    const totalWagered = actionable.length * BET_AMOUNT;
    let totalProfit = 0;
    actionable.forEach((p) => {
      if (p.actual_direction === "push") {
        // Push = money back, no profit/loss
        totalProfit += 0;
      } else if (p.is_correct) {
        totalProfit += calculateWinProfit(BET_AMOUNT);
      } else {
        totalProfit -= BET_AMOUNT;
      }
    });
    const roi = calculateROI(totalProfit, totalWagered);

    // Group by sport
    const bySport: Record<string, { total: number; correct: number; profit: number }> = {};
    actionable.forEach((p) => {
      if (!bySport[p.sport_id]) {
        bySport[p.sport_id] = { total: 0, correct: 0, profit: 0 };
      }
      bySport[p.sport_id].total++;
      if (p.actual_direction === "push") {
        // Push
      } else if (p.is_correct) {
        bySport[p.sport_id].correct++;
        bySport[p.sport_id].profit += calculateWinProfit(BET_AMOUNT);
      } else {
        bySport[p.sport_id].profit -= BET_AMOUNT;
      }
    });

    // Group by confidence tier
    const byConfidence: Record<string, { total: number; correct: number; profit: number }> = {
      "80+": { total: 0, correct: 0, profit: 0 },
      "60-79": { total: 0, correct: 0, profit: 0 },
      "40-59": { total: 0, correct: 0, profit: 0 },
      "<40": { total: 0, correct: 0, profit: 0 },
    };

    actionable.forEach((p) => {
      let tier: string;
      if (p.confidence_score >= 80) tier = "80+";
      else if (p.confidence_score >= 60) tier = "60-79";
      else if (p.confidence_score >= 40) tier = "40-59";
      else tier = "<40";

      byConfidence[tier].total++;
      if (p.actual_direction === "push") {
        // Push
      } else if (p.is_correct) {
        byConfidence[tier].correct++;
        byConfidence[tier].profit += calculateWinProfit(BET_AMOUNT);
      } else {
        byConfidence[tier].profit -= BET_AMOUNT;
      }
    });

    // Strong predictions (percentile <= 15 or >= 85)
    const strongPredictions = actionable.filter(
      (p) => p.dk_line_percentile <= 15 || p.dk_line_percentile >= 85
    );
    const strongCorrect = strongPredictions.filter((p) => p.is_correct);
    
    let strongProfit = 0;
    strongPredictions.forEach((p) => {
      if (p.actual_direction === "push") {
        // Push
      } else if (p.is_correct) {
        strongProfit += calculateWinProfit(BET_AMOUNT);
      } else {
        strongProfit -= BET_AMOUNT;
      }
    });

    return {
      total: filteredPredictions.length,
      actionable: actionable.length,
      correct: correct.length,
      accuracy: actionable.length > 0 ? (correct.length / actionable.length) * 100 : 0,
      totalWagered,
      totalProfit,
      roi,
      strongTotal: strongPredictions.length,
      strongCorrect: strongCorrect.length,
      strongAccuracy:
        strongPredictions.length > 0
          ? (strongCorrect.length / strongPredictions.length) * 100
          : 0,
      strongProfit,
      strongRoi: calculateROI(strongProfit, strongPredictions.length * BET_AMOUNT),
      bySport,
      byConfidence,
    };
  }, [filteredPredictions]);

  // Matchup type leaderboard
  const matchupTypeLeaderboard = useMemo((): MatchupTypeStats[] => {
    const actionable = filteredPredictions.filter(
      (p) => p.predicted_direction !== "push"
    );

    const calculateTypeStats = (
      type: string,
      icon: typeof Trophy,
      filterFn: (p: PredictionResult) => boolean
    ): MatchupTypeStats => {
      const filtered = actionable.filter(filterFn);
      const correct = filtered.filter((p) => p.is_correct);
      let profit = 0;
      filtered.forEach((p) => {
        if (p.actual_direction === "push") {
          // Push
        } else if (p.is_correct) {
          profit += calculateWinProfit(BET_AMOUNT);
        } else {
          profit -= BET_AMOUNT;
        }
      });
      
      return {
        type,
        icon,
        total: filtered.length,
        correct: correct.length,
        accuracy: filtered.length > 0 ? (correct.length / filtered.length) * 100 : 0,
        profit,
        roi: calculateROI(profit, filtered.length * BET_AMOUNT),
      };
    };

    const types: MatchupTypeStats[] = [
      calculateTypeStats("Playoff Games", Trophy, (p) => p.is_playoff),
      calculateTypeStats("Division Games", Building, (p) => p.is_division),
      calculateTypeStats("Rivalries", Flame, (p) => p.is_rivalry),
      calculateTypeStats("Regular Season", Swords, (p) => !p.is_playoff),
      calculateTypeStats("High Confidence", Target, (p) => p.confidence_score >= 70),
      calculateTypeStats("Strong Signal", TrendingUp, (p) => p.dk_line_percentile <= 15 || p.dk_line_percentile >= 85),
    ];

    // Sort by accuracy descending, filter out types with no data
    return types
      .filter((t) => t.total >= 5)
      .sort((a, b) => b.accuracy - a.accuracy);
  }, [filteredPredictions]);

  // Daily accuracy trend
  const dailyTrend = useMemo(() => {
    const byDate: Record<string, { total: number; correct: number }> = {};

    filteredPredictions
      .filter((p) => p.predicted_direction !== "push")
      .forEach((p) => {
        if (!byDate[p.date_local]) {
          byDate[p.date_local] = { total: 0, correct: 0 };
        }
        byDate[p.date_local].total++;
        if (p.is_correct) byDate[p.date_local].correct++;
      });

    return Object.entries(byDate)
      .map(([date, data]) => ({
        date,
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
        total: data.total,
        correct: data.correct,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredPredictions]);

  // Percentile accuracy buckets
  const percentileBuckets = useMemo(() => {
    const buckets: Record<string, { total: number; correct: number }> = {
      "0-10": { total: 0, correct: 0 },
      "10-20": { total: 0, correct: 0 },
      "20-30": { total: 0, correct: 0 },
      "30-40": { total: 0, correct: 0 },
      "40-50": { total: 0, correct: 0 },
      "50-60": { total: 0, correct: 0 },
      "60-70": { total: 0, correct: 0 },
      "70-80": { total: 0, correct: 0 },
      "80-90": { total: 0, correct: 0 },
      "90-100": { total: 0, correct: 0 },
    };

    filteredPredictions.forEach((p) => {
      const bucket = Math.floor(p.dk_line_percentile / 10) * 10;
      const key = `${bucket}-${bucket + 10}`;
      if (buckets[key]) {
        buckets[key].total++;
        // For low percentiles, "over" should win; for high, "under" should win
        const expectedOutcome = p.dk_line_percentile < 50 ? "over" : "under";
        if (p.actual_direction === expectedOutcome) {
          buckets[key].correct++;
        }
      }
    });

    return Object.entries(buckets).map(([range, data]) => ({
      range,
      accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      total: data.total,
    }));
  }, [filteredPredictions]);

  return (
    <>
      <Helmet>
        <title>Prediction Accuracy | Game Percentiles</title>
        <meta
          name="description"
          content="Track historical prediction accuracy and see how well our percentile-based picks perform against actual game results."
        />
      </Helmet>

      <Layout>
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in px-4 py-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Prediction Accuracy</h1>
                <p className="text-muted-foreground text-sm">
                  How well predictions match actual game results
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
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Time Range</label>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_RANGES.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Min Confidence</label>
                  <Select
                    value={String(minConfidence)}
                    onValueChange={(v) =>
                      setMinConfidence(v === "all" ? "all" : Number(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="60">60+</SelectItem>
                      <SelectItem value="70">70+</SelectItem>
                      <SelectItem value="80">80+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={BarChart3}
              label="Total Games"
              value={stats.total}
              subValue={`${stats.actionable} actionable`}
            />
            <StatCard
              icon={stats.accuracy >= 50 ? CheckCircle2 : XCircle}
              label="Overall Accuracy"
              value={`${stats.accuracy.toFixed(1)}%`}
              subValue={`${stats.correct}/${stats.actionable} correct`}
              highlight={stats.accuracy >= 55}
              warning={stats.accuracy < 50}
            />
            <StatCard
              icon={Target}
              label="Strong Picks"
              value={`${stats.strongAccuracy.toFixed(1)}%`}
              subValue={`${stats.strongCorrect}/${stats.strongTotal} (P≤15 or P≥85)`}
              highlight={stats.strongAccuracy >= 55}
            />
            <StatCard
              icon={Activity}
              label="Edge Rate"
              value={
                stats.total > 0
                  ? `${((stats.actionable / stats.total) * 100).toFixed(0)}%`
                  : "—"
              }
              subValue="Games with strong signals"
            />
          </div>

          {/* ROI Tracking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                ROI Tracking
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  $100/bet at -110 odds
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-secondary/30 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Total Wagered</div>
                  <div className="text-xl font-bold">${stats.totalWagered.toLocaleString()}</div>
                </div>
                <div className={cn(
                  "p-4 rounded-xl text-center",
                  stats.totalProfit >= 0 ? "bg-status-live/10" : "bg-status-over/10"
                )}>
                  <div className="text-xs text-muted-foreground mb-1">Net Profit/Loss</div>
                  <div className={cn(
                    "text-xl font-bold",
                    stats.totalProfit >= 0 ? "text-status-live" : "text-status-over"
                  )}>
                    {stats.totalProfit >= 0 ? "+" : ""}${stats.totalProfit.toFixed(2)}
                  </div>
                </div>
                <div className={cn(
                  "p-4 rounded-xl text-center",
                  stats.roi >= 0 ? "bg-status-live/10" : "bg-status-over/10"
                )}>
                  <div className="text-xs text-muted-foreground mb-1">Overall ROI</div>
                  <div className={cn(
                    "text-xl font-bold",
                    stats.roi >= 0 ? "text-status-live" : "text-status-over"
                  )}>
                    {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(2)}%
                  </div>
                </div>
                <div className={cn(
                  "p-4 rounded-xl text-center",
                  stats.strongRoi >= 0 ? "bg-status-live/10" : "bg-status-over/10"
                )}>
                  <div className="text-xs text-muted-foreground mb-1">Strong Picks ROI</div>
                  <div className={cn(
                    "text-xl font-bold",
                    stats.strongRoi >= 0 ? "text-status-live" : "text-status-over"
                  )}>
                    {stats.strongRoi >= 0 ? "+" : ""}{stats.strongRoi.toFixed(2)}%
                  </div>
                  <div className="text-2xs text-muted-foreground">
                    ${stats.strongProfit >= 0 ? "+" : ""}{stats.strongProfit.toFixed(0)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Standard -110 juice (4.55% vig per side). Win pays $90.91 per $100 bet.
              </p>
            </CardContent>
          </Card>

          {/* Matchup Type Leaderboard */}
          {matchupTypeLeaderboard.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Matchup Type Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {matchupTypeLeaderboard.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.type}
                        className={cn(
                          "flex items-center gap-4 p-3 rounded-xl",
                          index === 0 ? "bg-primary/10 border border-primary/20" : "bg-secondary/30"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                          index === 0 ? "bg-primary text-primary-foreground" :
                          index === 1 ? "bg-secondary text-secondary-foreground" :
                          index === 2 ? "bg-muted text-muted-foreground" :
                          "bg-muted/50 text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                        <Icon className={cn(
                          "h-5 w-5",
                          index === 0 ? "text-primary" : "text-muted-foreground"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{item.type}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.correct}/{item.total} games
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn(
                            "text-lg font-bold",
                            item.accuracy >= 55 ? "text-status-live" :
                            item.accuracy >= 50 ? "text-foreground" :
                            "text-status-over"
                          )}>
                            {item.accuracy.toFixed(1)}%
                          </div>
                          <div className={cn(
                            "text-xs",
                            item.roi >= 0 ? "text-status-live" : "text-status-over"
                          )}>
                            {item.roi >= 0 ? "+" : ""}{item.roi.toFixed(1)}% ROI
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Rankings based on prediction accuracy. Min 5 games required.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Accuracy by Confidence with ROI */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Accuracy & ROI by Confidence Tier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(stats.byConfidence).map(([tier, data]) => {
                  const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
                  const tierRoi = calculateROI(data.profit, data.total * BET_AMOUNT);
                  return (
                    <div
                      key={tier}
                      className={cn(
                        "p-4 rounded-xl text-center",
                        accuracy >= 55
                          ? "bg-status-live/10"
                          : accuracy >= 50
                          ? "bg-yellow-500/10"
                          : "bg-secondary/30"
                      )}
                    >
                      <div className="text-xs text-muted-foreground mb-1">
                        Confidence {tier}
                      </div>
                      <div
                        className={cn(
                          "text-2xl font-bold",
                          accuracy >= 55
                            ? "text-status-live"
                            : accuracy >= 50
                            ? "text-yellow-500"
                            : "text-muted-foreground"
                        )}
                      >
                        {accuracy.toFixed(1)}%
                      </div>
                      <div className="text-2xs text-muted-foreground">
                        {data.correct}/{data.total}
                      </div>
                      <div className={cn(
                        "text-xs mt-1",
                        tierRoi >= 0 ? "text-status-live" : "text-status-over"
                      )}>
                        {tierRoi >= 0 ? "+" : ""}{tierRoi.toFixed(1)}% ROI
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Daily Trend Chart */}
          {dailyTrend.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Daily Accuracy Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrend}>
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(v) => format(new Date(v), "M/d")}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border p-2 rounded-lg shadow-lg">
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(data.date), "MMM d, yyyy")}
                              </div>
                              <div className="font-medium">
                                {data.accuracy.toFixed(1)}% ({data.correct}/{data.total})
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine
                        y={50}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="4 4"
                      />
                      <Area
                        type="monotone"
                        dataKey="accuracy"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Percentile Bucket Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Accuracy by Percentile Range
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={percentileBuckets}>
                    <XAxis
                      dataKey="range"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border p-2 rounded-lg shadow-lg">
                            <div className="text-xs text-muted-foreground">
                              Percentile {data.range}
                            </div>
                            <div className="font-medium">
                              {data.accuracy.toFixed(1)}% ({data.total} games)
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine
                      y={50}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                    />
                    <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                      {percentileBuckets.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.accuracy >= 55
                              ? "hsl(var(--status-live))"
                              : entry.accuracy >= 50
                              ? "hsl(var(--primary))"
                              : "hsl(var(--muted))"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Low percentiles (0-20) predict OVER, high percentiles (80-100) predict UNDER
              </p>
            </CardContent>
          </Card>

          {/* Sport Breakdown with ROI */}
          {Object.keys(stats.bySport).length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Accuracy & ROI by Sport</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(stats.bySport).map(([sport, data]) => {
                    const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
                    const sportRoi = calculateROI(data.profit, data.total * BET_AMOUNT);
                    return (
                      <div
                        key={sport}
                        className="p-3 rounded-xl bg-secondary/30 text-center"
                      >
                        <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                          {sport}
                        </div>
                        <div
                          className={cn(
                            "text-xl font-bold",
                            accuracy >= 55 ? "text-status-live" : ""
                          )}
                        >
                          {accuracy.toFixed(1)}%
                        </div>
                        <div className="text-2xs text-muted-foreground">
                          {data.correct}/{data.total}
                        </div>
                        <div className={cn(
                          "text-xs mt-1",
                          sportRoi >= 0 ? "text-status-live" : "text-status-over"
                        )}>
                          {sportRoi >= 0 ? "+" : ""}{sportRoi.toFixed(1)}% ROI
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center pb-6">
            Past performance does not guarantee future results. For entertainment purposes only.
          </p>
        </div>
      </Layout>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  highlight = false,
  warning = false,
}: {
  icon: typeof Target;
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <Card
      className={cn(
        highlight && "border-status-live/30 bg-status-live/5",
        warning && "border-status-over/30 bg-status-over/5"
      )}
    >
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon
            className={cn(
              "h-4 w-4",
              highlight
                ? "text-status-live"
                : warning
                ? "text-status-over"
                : "text-muted-foreground"
            )}
          />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div
          className={cn(
            "text-2xl font-bold",
            highlight ? "text-status-live" : warning ? "text-status-over" : ""
          )}
        >
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-muted-foreground mt-1">{subValue}</div>
        )}
      </CardContent>
    </Card>
  );
}
