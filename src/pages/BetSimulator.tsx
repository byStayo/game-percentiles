import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Play, 
  RotateCcw,
  Target,
  Percent,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

type SportId = 'nba' | 'nfl' | 'mlb' | 'nhl';

const SPORT_CONFIG: Record<SportId, { label: string }> = {
  nba: { label: 'NBA' },
  nfl: { label: 'NFL' },
  mlb: { label: 'MLB' },
  nhl: { label: 'NHL' },
};

interface SimulationResult {
  gameNumber: number;
  bankroll: number;
  profit: number;
  won: boolean;
  betAmount: number;
  margin: number;
}

type Strategy = 'always-over' | 'always-under' | 'percentile-edge' | 'fade-public';

const STRATEGIES: { id: Strategy; label: string; description: string }[] = [
  { 
    id: 'always-over', 
    label: 'Always Over', 
    description: 'Bet the over on every game' 
  },
  { 
    id: 'always-under', 
    label: 'Always Under', 
    description: 'Bet the under on every game' 
  },
  { 
    id: 'percentile-edge', 
    label: 'Percentile Edge', 
    description: 'Bet over when line < P5, under when line > P95' 
  },
  { 
    id: 'fade-public', 
    label: 'Contrarian', 
    description: 'Bet opposite of high-scoring matchups (fade overs on 60%+ games)' 
  },
];

export default function BetSimulator() {
  const [sport, setSport] = useState<SportId>('nba');
  const [strategy, setStrategy] = useState<Strategy>('percentile-edge');
  const [startingBankroll, setStartingBankroll] = useState(1000);
  const [betSize, setBetSize] = useState(5); // percentage of bankroll
  const [useKellyCriterion, setUseKellyCriterion] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SimulationResult[] | null>(null);

  // Fetch historical game data with odds
  const { data: gameData, isLoading } = useQuery({
    queryKey: ['simulator-data', sport],
    queryFn: async () => {
      // Get games with final totals
      const { data: games } = await supabase
        .from('games')
        .select('id, final_total, start_time_utc')
        .eq('sport_id', sport)
        .eq('status', 'final')
        .not('final_total', 'is', null)
        .order('start_time_utc', { ascending: true })
        .limit(1000);

      // Get odds for these games
      const gameIds = games?.map(g => g.id) || [];
      const { data: odds } = await supabase
        .from('odds_snapshots')
        .select('game_id, total_line')
        .in('game_id', gameIds)
        .not('total_line', 'is', null);

      // Get daily edges for percentile data
      const { data: edges } = await supabase
        .from('daily_edges')
        .select('game_id, p05, p95, dk_total_line')
        .in('game_id', gameIds);

      const oddsMap = new Map<string, number>();
      odds?.forEach(o => {
        if (!oddsMap.has(o.game_id)) oddsMap.set(o.game_id, Number(o.total_line));
      });

      const edgesMap = new Map<string, { p05: number; p95: number; line: number }>();
      edges?.forEach(e => {
        if (e.p05 && e.p95 && e.dk_total_line) {
          edgesMap.set(e.game_id, {
            p05: Number(e.p05),
            p95: Number(e.p95),
            line: Number(e.dk_total_line),
          });
        }
      });

      return games?.filter(g => oddsMap.has(g.id)).map(g => ({
        id: g.id,
        final_total: Number(g.final_total),
        line: oddsMap.get(g.id)!,
        edge: edgesMap.get(g.id),
        date: g.start_time_utc,
      })) || [];
    },
  });

  const runSimulation = () => {
    if (!gameData?.length) return;

    setIsRunning(true);
    const results: SimulationResult[] = [];
    let bankroll = startingBankroll;

    gameData.forEach((game, i) => {
      let shouldBet = false;
      let betOver = true;

      // Determine bet based on strategy
      switch (strategy) {
        case 'always-over':
          shouldBet = true;
          betOver = true;
          break;
        case 'always-under':
          shouldBet = true;
          betOver = false;
          break;
        case 'percentile-edge':
          if (game.edge) {
            if (game.line < game.edge.p05) {
              shouldBet = true;
              betOver = true;
            } else if (game.line > game.edge.p95) {
              shouldBet = true;
              betOver = false;
            }
          }
          break;
        case 'fade-public':
          // Fade high-total games (assume public loves overs)
          const avgTotal = sport === 'nba' ? 220 : sport === 'nfl' ? 45 : sport === 'mlb' ? 8 : 5.5;
          if (game.line > avgTotal * 1.05) {
            shouldBet = true;
            betOver = false;
          }
          break;
      }

      if (shouldBet && bankroll > 0) {
        const betAmount = useKellyCriterion 
          ? Math.min(bankroll * 0.1, bankroll * (betSize / 100))
          : bankroll * (betSize / 100);

        const margin = game.final_total - game.line;
        const hitOver = margin > 0;
        const won = betOver ? hitOver : !hitOver;

        // Standard -110 odds (win $91 on $100 bet)
        const profit = won ? betAmount * 0.91 : -betAmount;
        bankroll += profit;

        results.push({
          gameNumber: results.length + 1,
          bankroll: Math.round(bankroll * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          won,
          betAmount: Math.round(betAmount * 100) / 100,
          margin: Math.round(margin * 10) / 10,
        });
      }
    });

    setResults(results);
    setIsRunning(false);
  };

  const stats = useMemo(() => {
    if (!results?.length) return null;

    const wins = results.filter(r => r.won).length;
    const totalBets = results.length;
    const finalBankroll = results[results.length - 1].bankroll;
    const totalProfit = finalBankroll - startingBankroll;
    const roi = (totalProfit / startingBankroll) * 100;
    const maxDrawdown = results.reduce((max, r, i) => {
      const peak = Math.max(...results.slice(0, i + 1).map(x => x.bankroll));
      const drawdown = ((peak - r.bankroll) / peak) * 100;
      return Math.max(max, drawdown);
    }, 0);

    const longestWinStreak = results.reduce((max, r, i) => {
      if (!r.won) return max;
      let streak = 1;
      for (let j = i + 1; j < results.length && results[j].won; j++) streak++;
      return Math.max(max, streak);
    }, 0);

    const longestLossStreak = results.reduce((max, r, i) => {
      if (r.won) return max;
      let streak = 1;
      for (let j = i + 1; j < results.length && !results[j].won; j++) streak++;
      return Math.max(max, streak);
    }, 0);

    return {
      wins,
      losses: totalBets - wins,
      winRate: (wins / totalBets) * 100,
      totalBets,
      finalBankroll,
      totalProfit,
      roi,
      maxDrawdown,
      longestWinStreak,
      longestLossStreak,
    };
  }, [results, startingBankroll]);

  return (
    <Layout>
      <Helmet>
        <title>Betting Simulator | Test Strategies</title>
        <meta
          name="description"
          content="Test betting strategies against historical sports data. Simulate over/under betting with various strategies and bankroll management."
        />
      </Helmet>

      <div className="container mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Betting Simulator
          </h1>
          <p className="text-muted-foreground">
            Test strategies against historical data
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Configuration */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Set up your simulation parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sport Selection */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Sport</Label>
                <Tabs value={sport} onValueChange={(v) => { setSport(v as SportId); setResults(null); }}>
                  <TabsList className="grid w-full grid-cols-4">
                    {(['nba', 'nfl', 'mlb', 'nhl'] as SportId[]).map((s) => (
                      <TabsTrigger key={s} value={s}>
                        {SPORT_CONFIG[s].label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {/* Strategy Selection */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Strategy</Label>
                <div className="space-y-2">
                  {STRATEGIES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setStrategy(s.id); setResults(null); }}
                      className={cn(
                        "w-full p-3 rounded-lg border text-left transition-colors",
                        strategy === s.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground"
                      )}
                    >
                      <div className="font-medium">{s.label}</div>
                      <div className="text-xs text-muted-foreground">{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bankroll */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Starting Bankroll: ${startingBankroll}
                </Label>
                <Slider
                  value={[startingBankroll]}
                  onValueChange={([v]) => { setStartingBankroll(v); setResults(null); }}
                  min={100}
                  max={10000}
                  step={100}
                />
              </div>

              {/* Bet Size */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Bet Size: {betSize}% of bankroll
                </Label>
                <Slider
                  value={[betSize]}
                  onValueChange={([v]) => { setBetSize(v); setResults(null); }}
                  min={1}
                  max={25}
                  step={1}
                />
              </div>

              {/* Kelly Criterion */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Use Kelly Criterion</Label>
                <Switch
                  checked={useKellyCriterion}
                  onCheckedChange={(v) => { setUseKellyCriterion(v); setResults(null); }}
                />
              </div>

              {/* Run Button */}
              <div className="flex gap-2">
                <Button 
                  onClick={runSimulation} 
                  disabled={isLoading || isRunning}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Run Simulation
                </Button>
                {results && (
                  <Button variant="outline" onClick={() => setResults(null)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {isLoading && (
                <p className="text-sm text-muted-foreground text-center">
                  Loading historical games...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Simulation Results</CardTitle>
              {stats && (
                <CardDescription>
                  {stats.totalBets} bets placed over historical data
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!results ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Configure your strategy and click "Run Simulation"</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Final Bankroll</div>
                      <div className={cn(
                        "text-2xl font-bold",
                        stats!.totalProfit >= 0 ? "text-status-over" : "text-status-under"
                      )}>
                        ${stats!.finalBankroll.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">ROI</div>
                      <div className={cn(
                        "text-2xl font-bold",
                        stats!.roi >= 0 ? "text-status-over" : "text-status-under"
                      )}>
                        {stats!.roi >= 0 ? '+' : ''}{stats!.roi.toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Win Rate</div>
                      <div className="text-2xl font-bold">
                        {stats!.winRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats!.wins}W - {stats!.losses}L
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Max Drawdown
                      </div>
                      <div className="text-2xl font-bold text-status-under">
                        -{stats!.maxDrawdown.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Bankroll Chart */}
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={results}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="gameNumber" 
                          className="text-xs"
                          label={{ value: 'Bets', position: 'insideBottom', offset: -5 }}
                        />
                        <YAxis 
                          className="text-xs"
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`$${value}`, 'Bankroll']}
                        />
                        <ReferenceLine 
                          y={startingBankroll} 
                          stroke="hsl(var(--muted-foreground))" 
                          strokeDasharray="5 5"
                          label={{ value: 'Start', position: 'right' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="bankroll"
                          stroke={stats!.totalProfit >= 0 ? 'hsl(var(--status-over))' : 'hsl(var(--status-under))'}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Additional Stats */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <Badge variant="outline" className="gap-1">
                      <TrendingUp className="h-3 w-3 text-status-over" />
                      Best Streak: {stats!.longestWinStreak}W
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <TrendingDown className="h-3 w-3 text-status-under" />
                      Worst Streak: {stats!.longestLossStreak}L
                    </Badge>
                    <Badge variant="outline">
                      Total Bets: {stats!.totalBets}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Disclaimer */}
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong>Disclaimer:</strong> This simulator uses historical data and does not account for 
                juice/vig variability, line movement, or market efficiency. Past performance does not 
                guarantee future results. Gambling involves risk. Please bet responsibly.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
