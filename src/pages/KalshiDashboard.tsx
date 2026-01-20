import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Settings, 
  Play, 
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Target,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface KalshiOrder {
  id: string;
  created_at: string;
  ticker: string;
  side: string;
  count: number;
  price: number | null;
  order_id: string | null;
  success: boolean;
  error: string | null;
  status: string | null;
  filled_count: number | null;
  fill_price: number | null;
  game_id: string | null;
  edge_percentile: number | null;
  signal_type: string | null;
  edge_strength: string | null;
  is_demo: boolean | null;
  result: string | null;
  pnl_cents: number | null;
  settled_at: string | null;
}

interface BettingConfig {
  id: string;
  name: string;
  enabled: boolean | null;
  strong_edge_threshold: number | null;
  moderate_edge_threshold: number | null;
  weak_edge_threshold: number | null;
  max_position_size_cents: number | null;
  strong_position_pct: number | null;
  moderate_position_pct: number | null;
  weak_position_pct: number | null;
  max_daily_loss_cents: number | null;
  max_open_positions: number | null;
  min_edge_confidence: number | null;
  max_limit_price: number | null;
  min_limit_price: number | null;
  enabled_sports: string[] | null;
}

interface DailyPnl {
  id: string;
  date_local: string;
  orders_placed: number | null;
  orders_filled: number | null;
  orders_won: number | null;
  orders_lost: number | null;
  gross_pnl_cents: number | null;
  fees_cents: number | null;
  net_pnl_cents: number | null;
  win_rate: number | null;
  avg_edge_percentile: number | null;
}

// Hooks
function useKalshiOrders() {
  return useQuery({
    queryKey: ['kalshi-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kalshi_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as KalshiOrder[];
    },
    refetchInterval: 30000,
  });
}

function useBettingConfig() {
  return useQuery({
    queryKey: ['betting-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('betting_config')
        .select('*')
        .eq('name', 'default')
        .single();
      if (error) throw error;
      return data as BettingConfig;
    },
  });
}

function useDailyPnl() {
  return useQuery({
    queryKey: ['daily-pnl'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_pnl')
        .select('*')
        .order('date_local', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as DailyPnl[];
    },
  });
}

// Components
function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  className 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "p-2 rounded-xl",
            trend === 'up' && "bg-emerald-500/10 text-emerald-500",
            trend === 'down' && "bg-red-500/10 text-red-500",
            (!trend || trend === 'neutral') && "bg-primary/10 text-primary"
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderStatusBadge({ status, success }: { status: string | null; success: boolean }) {
  if (!success) {
    return <Badge variant="destructive" className="text-xs">Failed</Badge>;
  }
  
  const statusConfig: Record<string, { variant: "default" | "secondary" | "outline"; icon: React.ElementType }> = {
    pending: { variant: "outline", icon: Clock },
    filled: { variant: "default", icon: CheckCircle2 },
    partial: { variant: "secondary", icon: Activity },
    cancelled: { variant: "outline", icon: XCircle },
    expired: { variant: "outline", icon: Clock },
  };
  
  const config = statusConfig[status || 'pending'] || statusConfig.pending;
  const StatusIcon = config.icon;
  
  return (
    <Badge variant={config.variant} className="text-xs gap-1">
      <StatusIcon className="h-3 w-3" />
      {status || 'pending'}
    </Badge>
  );
}

function ResultBadge({ result, pnl }: { result: string | null; pnl: number | null }) {
  if (!result || result === 'pending') {
    return <span className="text-muted-foreground text-sm">-</span>;
  }
  
  const isWin = result === 'win';
  const pnlDollars = pnl !== null ? (pnl / 100).toFixed(2) : '0.00';
  
  return (
    <div className="flex items-center gap-1">
      <Badge 
        variant={isWin ? "default" : "destructive"} 
        className={cn("text-xs", isWin && "bg-emerald-500")}
      >
        {isWin ? 'WIN' : 'LOSS'}
      </Badge>
      <span className={cn(
        "text-sm font-medium",
        isWin ? "text-emerald-500" : "text-red-500"
      )}>
        {isWin ? '+' : '-'}${Math.abs(parseFloat(pnlDollars))}
      </span>
    </div>
  );
}

function OrdersTable({ orders, isLoading }: { orders: KalshiOrder[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No orders placed yet</p>
        <p className="text-sm">Run auto-bet to start placing orders</p>
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Ticker</TableHead>
            <TableHead>Signal</TableHead>
            <TableHead>Side</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="text-sm">
                {format(new Date(order.created_at), 'MMM d, HH:mm')}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {order.ticker.length > 20 ? order.ticker.slice(0, 20) + '...' : order.ticker}
              </TableCell>
              <TableCell>
                {order.signal_type && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      order.signal_type === 'OVER' && "border-status-over text-status-over",
                      order.signal_type === 'UNDER' && "border-status-under text-status-under"
                    )}
                  >
                    {order.edge_strength?.slice(0, 1)}{order.signal_type?.slice(0, 1)}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <span className={cn(
                  "font-medium",
                  order.side === 'yes' ? "text-emerald-500" : "text-red-500"
                )}>
                  {order.side.toUpperCase()}
                </span>
              </TableCell>
              <TableCell>{order.count}</TableCell>
              <TableCell>
                {order.price ? `${order.price}¢` : '-'}
                {order.fill_price && order.fill_price !== order.price && (
                  <span className="text-muted-foreground text-xs ml-1">
                    (filled @ {order.fill_price}¢)
                  </span>
                )}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} success={order.success} />
              </TableCell>
              <TableCell>
                <ResultBadge result={order.result} pnl={order.pnl_cents} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PnlChart({ data }: { data: DailyPnl[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No P&L data yet</p>
      </div>
    );
  }
  
  // Reverse to show oldest first
  const sortedData = [...data].reverse();
  const maxPnl = Math.max(...sortedData.map(d => Math.abs(d.net_pnl_cents || 0)));
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        {sortedData.slice(-10).map((day) => {
          const pnl = day.net_pnl_cents || 0;
          const pnlDollars = (pnl / 100).toFixed(2);
          const barWidth = maxPnl > 0 ? (Math.abs(pnl) / maxPnl) * 100 : 0;
          const isPositive = pnl >= 0;
          
          return (
            <div key={day.id} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">
                {format(new Date(day.date_local), 'MMM d')}
              </span>
              <div className="flex-1 flex items-center gap-2">
                <div 
                  className={cn(
                    "h-6 rounded-sm transition-all",
                    isPositive ? "bg-emerald-500/80" : "bg-red-500/80"
                  )}
                  style={{ width: `${Math.max(barWidth, 2)}%` }}
                />
                <span className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  isPositive ? "text-emerald-500" : "text-red-500"
                )}>
                  {isPositive ? '+' : '-'}${Math.abs(parseFloat(pnlDollars))}
                </span>
              </div>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {day.orders_placed || 0} orders
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfigPanel({ config, isLoading }: { config: BettingConfig | undefined; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const [editedConfig, setEditedConfig] = useState<Partial<BettingConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<BettingConfig>) => {
      const { error } = await supabase
        .from('betting_config')
        .update(updates)
        .eq('name', 'default');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['betting-config'] });
      toast.success('Configuration saved');
      setEditedConfig({});
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error('Failed to save config: ' + error.message);
    },
  });
  
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }
  
  if (!config) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>No configuration found</p>
      </div>
    );
  }
  
  const handleToggleEnabled = () => {
    updateMutation.mutate({ enabled: !config.enabled });
  };
  
  const getValue = <K extends keyof BettingConfig>(key: K): BettingConfig[K] => {
    return (editedConfig[key] !== undefined ? editedConfig[key] : config[key]) as BettingConfig[K];
  };
  
  const handleChange = <K extends keyof BettingConfig>(key: K, value: BettingConfig[K]) => {
    setEditedConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const handleSave = () => {
    if (Object.keys(editedConfig).length > 0) {
      updateMutation.mutate(editedConfig);
    }
  };
  
  const handleReset = () => {
    setEditedConfig({});
    setHasChanges(false);
  };
  
  const EditableNumber = ({ 
    label, 
    configKey, 
    suffix = '',
    min = 0,
    max = 100,
    step = 1,
    transform = (v: number) => v,
    reverseTransform = (v: number) => v
  }: { 
    label: string; 
    configKey: keyof BettingConfig; 
    suffix?: string;
    min?: number;
    max?: number;
    step?: number;
    transform?: (v: number) => number;
    reverseTransform?: (v: number) => number;
  }) => {
    const rawValue = getValue(configKey);
    const displayValue = transform(typeof rawValue === 'number' ? rawValue : 0);
    
    return (
      <div className="flex items-center justify-between gap-4">
        <Label className="text-sm whitespace-nowrap">{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={displayValue}
            onChange={(e) => handleChange(configKey, reverseTransform(parseFloat(e.target.value) || 0) as any)}
            min={min}
            max={max}
            step={step}
            className="w-24 h-8 text-sm font-mono text-right"
          />
          {suffix && <span className="text-sm text-muted-foreground w-4">{suffix}</span>}
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Save/Reset Bar */}
      {hasChanges && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/50 bg-primary/5 animate-fade-in">
          <p className="text-sm text-primary font-medium">You have unsaved changes</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={updateMutation.isPending}>
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      )}
      
      {/* Master Enable/Disable */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          {config.enabled ? (
            <Play className="h-5 w-5 text-emerald-500" />
          ) : (
            <Pause className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium">Auto-Bet Status</p>
            <p className="text-sm text-muted-foreground">
              {config.enabled ? 'Active - placing orders automatically' : 'Paused - no orders will be placed'}
            </p>
          </div>
        </div>
        <Switch 
          checked={config.enabled || false} 
          onCheckedChange={handleToggleEnabled}
          disabled={updateMutation.isPending}
        />
      </div>
      
      {/* Thresholds */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Edge Thresholds</CardTitle>
            <CardDescription className="text-xs">Percentile triggers for signals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <EditableNumber 
              label="Strong (≤ X%)" 
              configKey="strong_edge_threshold" 
              suffix="%" 
              min={1} 
              max={20} 
              step={1}
            />
            <EditableNumber 
              label="Moderate (≤ X%)" 
              configKey="moderate_edge_threshold" 
              suffix="%" 
              min={1} 
              max={30} 
              step={1}
            />
            <EditableNumber 
              label="Weak (≤ X%)" 
              configKey="weak_edge_threshold" 
              suffix="%" 
              min={1} 
              max={40} 
              step={1}
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Position Sizing</CardTitle>
            <CardDescription className="text-xs">% of max position per strength</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <EditableNumber 
              label="Strong" 
              configKey="strong_position_pct" 
              suffix="%" 
              min={10} 
              max={100} 
              step={5}
            />
            <EditableNumber 
              label="Moderate" 
              configKey="moderate_position_pct" 
              suffix="%" 
              min={10} 
              max={100} 
              step={5}
            />
            <EditableNumber 
              label="Weak" 
              configKey="weak_position_pct" 
              suffix="%" 
              min={10} 
              max={100} 
              step={5}
            />
          </CardContent>
        </Card>
      </div>
      
      {/* Risk Limits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Risk Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Max Position ($)</Label>
              <Input
                type="number"
                value={getValue('max_position_size_cents') ? (getValue('max_position_size_cents') as number) / 100 : 0}
                onChange={(e) => handleChange('max_position_size_cents', Math.round(parseFloat(e.target.value || '0') * 100))}
                min={1}
                max={10000}
                step={1}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Max Daily Loss ($)</Label>
              <Input
                type="number"
                value={getValue('max_daily_loss_cents') ? (getValue('max_daily_loss_cents') as number) / 100 : 0}
                onChange={(e) => handleChange('max_daily_loss_cents', Math.round(parseFloat(e.target.value || '0') * 100))}
                min={1}
                max={10000}
                step={1}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Max Open Positions</Label>
              <Input
                type="number"
                value={getValue('max_open_positions') || 0}
                onChange={(e) => handleChange('max_open_positions', parseInt(e.target.value || '0'))}
                min={1}
                max={100}
                step={1}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Min Games Required</Label>
              <Input
                type="number"
                value={getValue('min_edge_confidence') || 0}
                onChange={(e) => handleChange('min_edge_confidence', parseInt(e.target.value || '0'))}
                min={1}
                max={50}
                step={1}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Price Limits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Limit Price Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min (¢)</Label>
              <Input
                type="number"
                value={getValue('min_limit_price') || 0}
                onChange={(e) => handleChange('min_limit_price', parseInt(e.target.value || '0'))}
                min={1}
                max={99}
                step={1}
                className="w-20 h-8 text-sm font-mono"
              />
            </div>
            <div className="flex-1 h-2 bg-muted rounded-full relative">
              <div 
                className="absolute h-full bg-primary rounded-full"
                style={{ 
                  left: `${getValue('min_limit_price') || 30}%`, 
                  width: `${((getValue('max_limit_price') as number) || 70) - ((getValue('min_limit_price') as number) || 30)}%` 
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max (¢)</Label>
              <Input
                type="number"
                value={getValue('max_limit_price') || 0}
                onChange={(e) => handleChange('max_limit_price', parseInt(e.target.value || '0'))}
                min={1}
                max={99}
                step={1}
                className="w-20 h-8 text-sm font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Enabled Sports */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Enabled Sports</CardTitle>
          <CardDescription className="text-xs">Click to toggle sports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['nba', 'nfl', 'mlb', 'nhl'].map((sport) => {
              const enabledSports = (getValue('enabled_sports') || []) as string[];
              const isEnabled = enabledSports.includes(sport);
              
              return (
                <Badge 
                  key={sport} 
                  variant={isEnabled ? "default" : "outline"}
                  className={cn(
                    "uppercase cursor-pointer transition-colors",
                    isEnabled ? "bg-primary" : "hover:bg-muted"
                  )}
                  onClick={() => {
                    const newSports = isEnabled 
                      ? enabledSports.filter(s => s !== sport)
                      : [...enabledSports, sport];
                    handleChange('enabled_sports', newSports);
                  }}
                >
                  {sport}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function KalshiDashboard() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading: ordersLoading } = useKalshiOrders();
  const { data: config, isLoading: configLoading } = useBettingConfig();
  const { data: pnlData = [], isLoading: pnlLoading } = useDailyPnl();
  const [isRunning, setIsRunning] = useState(false);
  
  // Calculate summary stats
  const todayOrders = orders.filter(o => 
    format(new Date(o.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );
  const totalPnl = pnlData.reduce((sum, d) => sum + (d.net_pnl_cents || 0), 0);
  const totalWins = orders.filter(o => o.result === 'win').length;
  const totalLosses = orders.filter(o => o.result === 'loss').length;
  const winRate = totalWins + totalLosses > 0 
    ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1) 
    : '0.0';
  
  const runAutoBet = async (dryRun: boolean) => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-bet', {
        body: { action: 'run', dry_run: dryRun }
      });
      
      if (error) throw error;
      
      const { counters } = data;
      if (dryRun) {
        toast.success(`Dry run: ${counters.signals_found} signals, ${counters.orders_attempted} would be placed`);
      } else {
        toast.success(`${counters.orders_placed} orders placed, ${counters.orders_skipped} skipped`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['kalshi-orders'] });
      queryClient.invalidateQueries({ queryKey: ['daily-pnl'] });
    } catch (error: any) {
      toast.error('Failed to run auto-bet: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };
  
  return (
    <>
      <Helmet>
        <title>Kalshi Trading | Dashboard</title>
        <meta name="description" content="Monitor and control automated Kalshi trading" />
      </Helmet>
      
      <Layout>
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Kalshi Trading</h1>
              <p className="text-muted-foreground">Automated prediction market trading</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAutoBet(true)}
                disabled={isRunning}
              >
                <Activity className="h-4 w-4 mr-2" />
                Dry Run
              </Button>
              <Button
                size="sm"
                onClick={() => runAutoBet(false)}
                disabled={isRunning || !config?.enabled}
              >
                {isRunning ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Run Now
              </Button>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Today's Orders"
              value={todayOrders.length}
              subtitle={`${orders.length} total`}
              icon={Activity}
            />
            <StatCard
              title="Total P&L"
              value={`${totalPnl >= 0 ? '+' : '-'}$${Math.abs(totalPnl / 100).toFixed(2)}`}
              subtitle="All time"
              icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
              trend={totalPnl >= 0 ? 'up' : 'down'}
            />
            <StatCard
              title="Win Rate"
              value={`${winRate}%`}
              subtitle={`${totalWins}W / ${totalLosses}L`}
              icon={Target}
              trend={parseFloat(winRate) >= 55 ? 'up' : parseFloat(winRate) < 45 ? 'down' : 'neutral'}
            />
            <StatCard
              title="Status"
              value={config?.enabled ? 'Active' : 'Paused'}
              subtitle={config?.enabled ? 'Placing orders' : 'Orders disabled'}
              icon={config?.enabled ? Play : Pause}
              trend={config?.enabled ? 'up' : 'neutral'}
            />
          </div>
          
          {/* Tabs */}
          <Tabs defaultValue="orders" className="space-y-4">
            <TabsList>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="pnl">P&L History</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>
            
            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Orders
                  </CardTitle>
                  <CardDescription>Last 100 orders placed on Kalshi</CardDescription>
                </CardHeader>
                <CardContent>
                  <OrdersTable orders={orders} isLoading={ordersLoading} />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="pnl">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Daily P&L
                  </CardTitle>
                  <CardDescription>Profit and loss by day</CardDescription>
                </CardHeader>
                <CardContent>
                  {pnlLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <PnlChart data={pnlData} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="config">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Algorithm Configuration
                  </CardTitle>
                  <CardDescription>Control thresholds, position sizing, and risk limits</CardDescription>
                </CardHeader>
                <CardContent>
                  <ConfigPanel config={config} isLoading={configLoading} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </>
  );
}
