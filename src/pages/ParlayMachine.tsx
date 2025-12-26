import { useState, useMemo, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Layout } from "@/components/layout/Layout";
import { DatePickerInline } from "@/components/ui/date-picker-inline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useTodayGames, TodayGame } from "@/hooks/useApi";
import { getTeamDisplayName } from "@/lib/teamNames";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Heart, Copy, Download, Trash2 } from "lucide-react";
import type { SportId } from "@/types";

const ET_TIMEZONE = 'America/New_York';

function getTodayInET(): Date {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  return new Date(etDate.getFullYear(), etDate.getMonth(), etDate.getDate());
}

interface ParlayPick {
  game: TodayGame;
  pick: 'over' | 'under';
  confidence: number; // 0-100 based on percentile position
  edge: number; // distance from 50th percentile
}

interface ParlayCombo {
  picks: ParlayPick[];
  combinedConfidence: number;
  expectedValue: number;
  legs: number;
}

interface SavedParlay {
  id: string;
  date: string;
  picks: Array<{
    matchup: string;
    line: number;
    pick: 'over' | 'under';
    confidence: number;
    sport: string;
  }>;
  combinedConfidence: number;
  expectedValue: number;
  savedAt: string;
}

const SAVED_PARLAYS_KEY = 'percentile-totals-saved-parlays';

// Generate all combinations of size k from array
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(combo => [first, ...combo]);
  const withoutFirst = combinations(rest, k);
  
  return [...withFirst, ...withoutFirst];
}

function generateParlayId(combo: ParlayCombo, date: string): string {
  return `${date}-${combo.picks.map(p => p.game.id).sort().join('-')}`;
}

export default function ParlayMachine() {
  const [selectedDate, setSelectedDate] = useState(getTodayInET);
  const [selectedSports, setSelectedSports] = useState<Set<SportId>>(new Set(['nfl', 'nba', 'nhl']));
  const [minConfidence, setMinConfidence] = useState(70);
  const [parlaySize, setParlaySize] = useState<2 | 3 | 4 | 5>(3);
  const [savedParlays, setSavedParlays] = useState<SavedParlay[]>([]);
  
  // Load saved parlays from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_PARLAYS_KEY);
      if (stored) {
        setSavedParlays(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load saved parlays:', e);
    }
  }, []);
  
  // Save to localStorage when parlays change
  const saveParlaysToStorage = (parlays: SavedParlay[]) => {
    try {
      localStorage.setItem(SAVED_PARLAYS_KEY, JSON.stringify(parlays));
      setSavedParlays(parlays);
    } catch (e) {
      console.error('Failed to save parlays:', e);
    }
  };
  
  // Fetch games for all selected sports
  const nflQuery = useTodayGames(selectedDate, 'nfl');
  const nbaQuery = useTodayGames(selectedDate, 'nba');
  const nhlQuery = useTodayGames(selectedDate, 'nhl');
  const mlbQuery = useTodayGames(selectedDate, 'mlb');
  
  const isLoading = nflQuery.isLoading || nbaQuery.isLoading || nhlQuery.isLoading || mlbQuery.isLoading;
  
  // Combine all games from selected sports
  const allGames = useMemo(() => {
    const games: TodayGame[] = [];
    if (selectedSports.has('nfl')) games.push(...(nflQuery.data?.games || []));
    if (selectedSports.has('nba')) games.push(...(nbaQuery.data?.games || []));
    if (selectedSports.has('nhl')) games.push(...(nhlQuery.data?.games || []));
    if (selectedSports.has('mlb')) games.push(...(mlbQuery.data?.games || []));
    return games;
  }, [selectedSports, nflQuery.data, nbaQuery.data, nhlQuery.data, mlbQuery.data]);
  
  // Find high-confidence picks (games where DK line is at extremes of percentile range)
  const highConfidencePicks = useMemo((): ParlayPick[] => {
    return allGames
      .filter(game => 
        game.dk_offered && 
        game.dk_line_percentile !== null && 
        game.n_h2h >= 2 &&
        game.p05 !== null &&
        game.p95 !== null
      )
      .map(game => {
        const percentile = game.dk_line_percentile!;
        const isUnder = percentile >= 50; // DK line above median = lean under
        const confidence = isUnder ? percentile : (100 - percentile);
        const edge = Math.abs(50 - percentile);
        
        return {
          game,
          pick: (isUnder ? 'under' : 'over') as 'over' | 'under',
          confidence,
          edge,
        };
      })
      .filter(pick => pick.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);
  }, [allGames, minConfidence]);
  
  // Generate parlay combinations
  const parlayOptions = useMemo((): ParlayCombo[] => {
    if (highConfidencePicks.length < parlaySize) return [];
    
    const combos = combinations(highConfidencePicks, parlaySize);
    
    return combos
      .map(picks => {
        // Combined probability = product of individual probabilities
        const combinedConfidence = picks.reduce((acc, p) => acc * (p.confidence / 100), 1) * 100;
        
        // Expected value approximation (simplified)
        // Assumes ~-110 odds per leg, so parlay pays roughly 2.5x for 2-leg, 6x for 3-leg, etc.
        const payoutMultiplier = Math.pow(1.9, picks.length);
        const expectedValue = (combinedConfidence / 100) * payoutMultiplier;
        
        return {
          picks,
          combinedConfidence,
          expectedValue,
          legs: picks.length,
        };
      })
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, 20); // Top 20 combinations
  }, [highConfidencePicks, parlaySize]);
  
  const toggleSport = (sport: SportId) => {
    const newSet = new Set(selectedSports);
    if (newSet.has(sport)) {
      newSet.delete(sport);
    } else {
      newSet.add(sport);
    }
    setSelectedSports(newSet);
  };
  
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  const saveParlay = (combo: ParlayCombo) => {
    const parlayId = generateParlayId(combo, dateStr);
    const isAlreadySaved = savedParlays.some(p => p.id === parlayId);
    
    if (isAlreadySaved) {
      // Remove from saved
      const updated = savedParlays.filter(p => p.id !== parlayId);
      saveParlaysToStorage(updated);
      toast.success("Parlay removed from favorites");
    } else {
      // Add to saved
      const newParlay: SavedParlay = {
        id: parlayId,
        date: dateStr,
        picks: combo.picks.map(p => ({
          matchup: `${getTeamDisplayName(p.game.away_team, p.game.sport_id)} @ ${getTeamDisplayName(p.game.home_team, p.game.sport_id)}`,
          line: p.game.dk_total_line || 0,
          pick: p.pick,
          confidence: p.confidence,
          sport: p.game.sport_id.toUpperCase(),
        })),
        combinedConfidence: combo.combinedConfidence,
        expectedValue: combo.expectedValue,
        savedAt: new Date().toISOString(),
      };
      saveParlaysToStorage([newParlay, ...savedParlays]);
      toast.success("Parlay saved to favorites!");
    }
  };
  
  const isParlayFavorited = (combo: ParlayCombo): boolean => {
    const parlayId = generateParlayId(combo, dateStr);
    return savedParlays.some(p => p.id === parlayId);
  };
  
  const removeSavedParlay = (id: string) => {
    const updated = savedParlays.filter(p => p.id !== id);
    saveParlaysToStorage(updated);
    toast.success("Parlay removed");
  };
  
  const exportParlayToClipboard = (combo: ParlayCombo) => {
    const lines = [
      `📊 PARLAY PICKS - ${format(selectedDate, 'MMM d, yyyy')}`,
      `═══════════════════════════`,
      '',
      ...combo.picks.map((pick, i) => 
        `${i + 1}. [${pick.game.sport_id.toUpperCase()}] ${getTeamDisplayName(pick.game.away_team, pick.game.sport_id)} @ ${getTeamDisplayName(pick.game.home_team, pick.game.sport_id)}\n   Line: ${pick.game.dk_total_line?.toFixed(1)} → ${pick.pick.toUpperCase()} (${pick.confidence.toFixed(0)}% conf)`
      ),
      '',
      `═══════════════════════════`,
      `Combined Confidence: ${combo.combinedConfidence.toFixed(1)}%`,
      `Expected Value: ${combo.expectedValue.toFixed(2)}x`,
      '',
      `Generated by Percentile Totals`
    ];
    
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success("Parlay copied to clipboard!");
  };
  
  const exportSavedParlay = (parlay: SavedParlay) => {
    const lines = [
      `📊 PARLAY PICKS - ${format(new Date(parlay.date), 'MMM d, yyyy')}`,
      `═══════════════════════════`,
      '',
      ...parlay.picks.map((pick, i) => 
        `${i + 1}. [${pick.sport}] ${pick.matchup}\n   Line: ${pick.line.toFixed(1)} → ${pick.pick.toUpperCase()} (${pick.confidence.toFixed(0)}% conf)`
      ),
      '',
      `═══════════════════════════`,
      `Combined Confidence: ${parlay.combinedConfidence.toFixed(1)}%`,
      `Expected Value: ${parlay.expectedValue.toFixed(2)}x`,
      '',
      `Generated by Percentile Totals`
    ];
    
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success("Parlay copied to clipboard!");
  };

  return (
    <>
      <Helmet>
        <title>Parlay Machine | Build High-Confidence Parlays</title>
        <meta name="description" content="Build optimized parlays using historical H2H percentile data. Find the best combinations with highest expected value." />
      </Helmet>

      <Layout>
        <div className="space-y-10 animate-fade-in">
          {/* Hero */}
          <div className="text-center space-y-4 py-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Parlay Machine
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Build optimized parlays using extreme percentile picks
            </p>
          </div>

          {/* Configuration */}
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Date */}
            <div className="flex justify-center">
              <DatePickerInline date={selectedDate} onDateChange={setSelectedDate} />
            </div>
            
            {/* Sport toggles */}
            <div className="flex flex-wrap justify-center gap-2">
              {(['nfl', 'nba', 'nhl', 'mlb'] as SportId[]).map(sport => (
                <button
                  key={sport}
                  onClick={() => toggleSport(sport)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                    selectedSports.has(sport)
                      ? "bg-foreground text-background shadow-md"
                      : "bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  {sport.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Confidence & Legs */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-card border border-border/60">
                <label className="text-sm font-medium text-muted-foreground mb-4 block">
                  Minimum Confidence
                </label>
                <div className="flex flex-wrap gap-2">
                  {[60, 70, 80, 90, 95].map(val => (
                    <button
                      key={val}
                      onClick={() => setMinConfidence(val)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                        minConfidence === val
                          ? "bg-foreground text-background shadow-sm"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-card border border-border/60">
                <label className="text-sm font-medium text-muted-foreground mb-4 block">
                  Parlay Legs
                </label>
                <div className="flex flex-wrap gap-2">
                  {([2, 3, 4, 5] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => setParlaySize(size)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                        parlaySize === size
                          ? "bg-foreground text-background shadow-sm"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {size}-Leg
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* High Confidence Picks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                High Confidence Picks
                <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary text-sm font-medium">
                  {highConfidencePicks.length}
                </span>
              </h2>
            </div>
            
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            ) : highConfidencePicks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No picks meet the {minConfidence}% threshold
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {highConfidencePicks.map((pick, i) => (
                  <div
                    key={pick.game.id}
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-200",
                      pick.confidence >= 90 ? "bg-status-under/5 border-status-under/20" :
                      pick.confidence >= 80 ? "bg-status-edge/5 border-status-edge/20" :
                      "bg-card border-border/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xs font-semibold text-muted-foreground">#{i + 1}</span>
                          <span className="px-1.5 py-0.5 rounded-md text-2xs font-semibold bg-secondary">
                            {pick.game.sport_id.toUpperCase()}
                          </span>
                        </div>
                        <div className="font-medium text-sm truncate">
                          {getTeamDisplayName(pick.game.away_team, pick.game.sport_id)} @ {getTeamDisplayName(pick.game.home_team, pick.game.sport_id)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Line: {pick.game.dk_total_line?.toFixed(1)} · n={pick.game.n_h2h}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={cn(
                          "inline-block px-2.5 py-1 rounded-lg text-xs font-bold",
                          pick.pick === 'under' ? "bg-status-under text-white" : "bg-status-over text-white"
                        )}>
                          {pick.pick.toUpperCase()}
                        </span>
                        <div className="text-xl font-bold mt-1">{pick.confidence.toFixed(0)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parlay Combinations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Top Parlay Combinations
                <Badge variant="secondary">{parlayOptions.length}</Badge>
              </CardTitle>
              <CardDescription>
                Ranked by expected value (combined probability × payout multiplier)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : parlayOptions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Not enough high-confidence picks to build {parlaySize}-leg parlays. 
                  Try lowering the minimum confidence or selecting more sports.
                </p>
              ) : (
                <div className="space-y-4">
                  {parlayOptions.slice(0, 10).map((combo, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-4 rounded-lg border",
                        i === 0 ? "bg-gradient-to-r from-status-under/10 to-transparent border-status-under/30" :
                        i < 3 ? "bg-muted/30 border-border" :
                        "border-border"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-lg font-bold",
                            i === 0 ? "text-status-under" : "text-muted-foreground"
                          )}>
                            #{i + 1}
                          </span>
                          <Badge variant={i === 0 ? "default" : "secondary"}>
                            {combo.legs}-Leg Parlay
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm">
                              <span className="text-muted-foreground">Combined: </span>
                              <span className="font-bold">{combo.combinedConfidence.toFixed(1)}%</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">EV: </span>
                              <span className={cn(
                                "font-bold",
                                combo.expectedValue >= 1 ? "text-status-under" : "text-status-over"
                              )}>
                                {combo.expectedValue.toFixed(2)}x
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => saveParlay(combo)}
                              title={isParlayFavorited(combo) ? "Remove from favorites" : "Save to favorites"}
                            >
                              <Heart className={cn(
                                "h-4 w-4",
                                isParlayFavorited(combo) ? "fill-red-500 text-red-500" : ""
                              )} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => exportParlayToClipboard(combo)}
                              title="Copy to clipboard"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {combo.picks.map((pick, j) => (
                          <div key={j} className="flex items-center justify-between text-sm py-1 border-t border-border/50 first:border-t-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-2xs">
                                {pick.game.sport_id.toUpperCase()}
                              </Badge>
                              <span>
                                {getTeamDisplayName(pick.game.away_team, pick.game.sport_id)} @ {getTeamDisplayName(pick.game.home_team, pick.game.sport_id)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {pick.game.dk_total_line?.toFixed(1)}
                              </span>
                              <Badge className={cn(
                                "text-2xs",
                                pick.pick === 'under' ? "bg-status-under" : "bg-status-over"
                              )}>
                                {pick.pick.toUpperCase()}
                              </Badge>
                              <span className="font-medium w-12 text-right">{pick.confidence.toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved Parlays */}
          {savedParlays.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                  Saved Parlays
                  <Badge variant="secondary">{savedParlays.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Your favorited parlay combinations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {savedParlays.map((parlay) => (
                    <div
                      key={parlay.id}
                      className="p-4 rounded-lg border bg-muted/20"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {format(new Date(parlay.date), 'MMM d, yyyy')}
                          </Badge>
                          <Badge variant="secondary">
                            {parlay.picks.length}-Leg
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm">
                              <span className="text-muted-foreground">Combined: </span>
                              <span className="font-bold">{parlay.combinedConfidence.toFixed(1)}%</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">EV: </span>
                              <span className={cn(
                                "font-bold",
                                parlay.expectedValue >= 1 ? "text-status-under" : "text-status-over"
                              )}>
                                {parlay.expectedValue.toFixed(2)}x
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => exportSavedParlay(parlay)}
                              title="Copy to clipboard"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeSavedParlay(parlay.id)}
                              title="Remove from saved"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {parlay.picks.map((pick, j) => (
                          <div key={j} className="flex items-center justify-between text-sm py-1 border-t border-border/50 first:border-t-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-2xs">
                                {pick.sport}
                              </Badge>
                              <span>{pick.matchup}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {pick.line.toFixed(1)}
                              </span>
                              <Badge className={cn(
                                "text-2xs",
                                pick.pick === 'under' ? "bg-status-under" : "bg-status-over"
                              )}>
                                {pick.pick.toUpperCase()}
                              </Badge>
                              <span className="font-medium w-12 text-right">{pick.confidence.toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center">
            ⚠️ This tool is for entertainment purposes only. Historical performance does not guarantee future results. 
            Always gamble responsibly.
          </p>
        </div>
      </Layout>
    </>
  );
}
