import { useState, useMemo } from "react";
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

// Generate all combinations of size k from array
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(combo => [first, ...combo]);
  const withoutFirst = combinations(rest, k);
  
  return [...withFirst, ...withoutFirst];
}

export default function ParlayMachine() {
  const [selectedDate, setSelectedDate] = useState(getTodayInET);
  const [selectedSports, setSelectedSports] = useState<Set<SportId>>(new Set(['nfl', 'nba', 'nhl']));
  const [minConfidence, setMinConfidence] = useState(70);
  const [parlaySize, setParlaySize] = useState<2 | 3 | 4 | 5>(3);
  
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

  return (
    <>
      <Helmet>
        <title>Parlay Machine | Build High-Confidence Parlays</title>
        <meta name="description" content="Build optimized parlays using historical H2H percentile data. Find the best combinations with highest expected value." />
      </Helmet>

      <Layout>
        <div className="space-y-8 animate-fade-in">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Parlay Machine</h1>
            <p className="text-muted-foreground">
              Build optimized parlays using 95th percentile confidence picks
            </p>
          </div>

          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuration</CardTitle>
              <CardDescription>Select your preferences for parlay generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date picker */}
              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <DatePickerInline date={selectedDate} onDateChange={setSelectedDate} />
              </div>
              
              {/* Sport selection */}
              <div>
                <label className="text-sm font-medium mb-3 block">Sports</label>
                <div className="flex flex-wrap gap-3">
                  {(['nfl', 'nba', 'nhl', 'mlb'] as SportId[]).map(sport => (
                    <label key={sport} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedSports.has(sport)}
                        onCheckedChange={() => toggleSport(sport)}
                      />
                      <span className="text-sm font-medium">{sport.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Min confidence */}
              <div>
                <label className="text-sm font-medium mb-3 block">
                  Minimum Confidence: {minConfidence}%
                </label>
                <div className="flex gap-2">
                  {[60, 70, 80, 90, 95].map(val => (
                    <Button
                      key={val}
                      variant={minConfidence === val ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMinConfidence(val)}
                    >
                      {val}%
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Parlay size */}
              <div>
                <label className="text-sm font-medium mb-3 block">Parlay Legs</label>
                <div className="flex gap-2">
                  {([2, 3, 4, 5] as const).map(size => (
                    <Button
                      key={size}
                      variant={parlaySize === size ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setParlaySize(size)}
                    >
                      {size}-Leg
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* High Confidence Picks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                High Confidence Picks
                <Badge variant="secondary">{highConfidencePicks.length}</Badge>
              </CardTitle>
              <CardDescription>
                Games where the DK line falls at the extreme of H2H distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : highConfidencePicks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No picks meet the {minConfidence}% confidence threshold for the selected date and sports.
                </p>
              ) : (
                <div className="space-y-2">
                  {highConfidencePicks.map((pick, i) => (
                    <div
                      key={pick.game.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        pick.confidence >= 90 ? "bg-status-under/5 border-status-under/20" :
                        pick.confidence >= 80 ? "bg-status-edge/5 border-status-edge/20" :
                        "bg-muted/30 border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-muted-foreground w-6">#{i + 1}</span>
                        <Badge variant="outline" className="text-2xs">
                          {pick.game.sport_id.toUpperCase()}
                        </Badge>
                        <div>
                          <div className="font-medium text-sm">
                            {getTeamDisplayName(pick.game.away_team, pick.game.sport_id)} @ {getTeamDisplayName(pick.game.home_team, pick.game.sport_id)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            DK Line: {pick.game.dk_total_line?.toFixed(1)} | H2H: n={pick.game.n_h2h}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={cn(
                          "text-xs",
                          pick.pick === 'under' ? "bg-status-under text-white" : "bg-status-over text-white"
                        )}>
                          {pick.pick.toUpperCase()}
                        </Badge>
                        <div className="text-right">
                          <div className="font-bold text-lg">{pick.confidence.toFixed(0)}%</div>
                          <div className="text-2xs text-muted-foreground">confidence</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
