import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, Clock, RefreshCw, BarChart3, Database, Activity, Play, Loader2, Timer, Calendar, Zap } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useSystemStatus, useCronStatus } from "@/hooks/useApi";
import type { CronJob } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const jobLabels: Record<string, { name: string; description: string }> = {
  backfill: { name: "Backfill", description: "Historical data import" },
  ingest: { name: "Daily Ingest", description: "Today's games sync" },
  compute: { name: "Compute", description: "Percentile calculations" },
  odds_refresh: { name: "Odds Refresh", description: "DraftKings lines" },
};

function JobCard({ jobName, job }: { jobName: string; job: any }) {
  const label = jobLabels[jobName] || { name: jobName, description: "" };

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold">{label.name}</h3>
          <p className="text-sm text-muted-foreground">{label.description}</p>
        </div>
        {job ? (
          job.status === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-status-live" />
          ) : job.status === 'fail' ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : (
            <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
          )
        ) : (
          <Clock className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {job ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              job.status === 'success' && "bg-status-live/10 text-status-live",
              job.status === 'fail' && "bg-destructive/10 text-destructive",
              job.status === 'running' && "bg-muted text-muted-foreground"
            )}>
              {job.status.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(job.started_at), { addSuffix: true })}
          </p>
          {job.duration_ms !== null && (
            <p className="text-xs text-muted-foreground">
              Duration: {(job.duration_ms / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No runs yet</p>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

// Cron job card component
function CronJobCard({ job }: { job: CronJob }) {
  const isSuccess = job.last_run?.status === 'succeeded';
  const isFailed = job.last_run?.status === 'failed';
  
  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-card">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{job.name}</h4>
          <p className="text-xs text-muted-foreground">{job.function}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {job.active ? (
            <span className="w-2 h-2 rounded-full bg-status-live animate-pulse" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Timer className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">{job.schedule_human}</span>
        </div>
        
        {job.next_run && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              Next: {formatDistanceToNow(new Date(job.next_run), { addSuffix: true })}
            </span>
          </div>
        )}
        
        {job.last_run && (
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-3 w-3 text-status-live" />
            ) : isFailed ? (
              <XCircle className="h-3 w-3 text-destructive" />
            ) : (
              <Clock className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={cn(
              "text-xs",
              isSuccess && "text-status-live",
              isFailed && "text-destructive",
              !isSuccess && !isFailed && "text-muted-foreground"
            )}>
              {formatDistanceToNow(new Date(job.last_run.started_at), { addSuffix: true })}
              {job.last_run.duration_ms !== null && ` (${job.last_run.duration_ms}ms)`}
            </span>
          </div>
        )}
        
        {job.stats_24h.total > 0 && (
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground">24h:</span>
            <span className="text-xs text-status-live">{job.stats_24h.success} ✓</span>
            {job.stats_24h.failed > 0 && (
              <span className="text-xs text-destructive">{job.stats_24h.failed} ✗</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Cron jobs section component
function CronJobsSection() {
  const { data, isLoading, error } = useCronStatus();
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center">
        <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Unable to load cron status</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Scheduled Jobs</h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-3xl font-bold">{data.summary.total_jobs}</p>
            <p className="text-xs text-muted-foreground">Total Jobs</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-status-live">{data.summary.active_jobs}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{data.summary.runs_24h}</p>
            <p className="text-xs text-muted-foreground">Runs (24h)</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{data.summary.success_rate}%</p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </div>
        </div>
        
        {/* Job cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.jobs.map((job) => (
            <CronJobCard key={job.id} job={job} />
          ))}
        </div>
      </div>
      
      {/* Recent runs */}
      {data.recent_runs.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="text-sm font-medium mb-3">Recent Activity</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.recent_runs.map((run, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  {run.status === 'succeeded' ? (
                    <CheckCircle2 className="h-3 w-3 text-status-live flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                  )}
                  <span className="font-medium truncate">{run.job_name}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground flex-shrink-0">
                  {run.duration_ms !== null && (
                    <span>{run.duration_ms}ms</span>
                  )}
                  <span>{formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function BackfillControls({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);

  const triggerBackfill = async (sportId: string) => {
    setLoading(sportId);
    try {
      const response = await fetch(`${API_BASE}/backfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport_id: sportId, seasons_override: 5 }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Backfill started for ${sportId.toUpperCase()}`, {
          description: `Job #${data.job_id} processing 5 seasons in background`,
        });
        onComplete();
      } else {
        toast.error(`Backfill failed: ${data.error}`);
      }
    } catch (error) {
      toast.error(`Backfill error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  };

  const triggerPipeline = async (endpoint: string, name: string) => {
    setLoading(endpoint);
    try {
      const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`${name} completed`, {
          description: JSON.stringify(data.counters || {}),
        });
        onComplete();
      } else {
        toast.error(`${name} failed: ${data.error}`);
      }
    } catch (error) {
      toast.error(`${name} error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  };

  const sports = ['nba', 'nfl', 'nhl', 'mlb'];

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Play className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Manual Controls</h2>
      </div>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Trigger Backfill (5 seasons)</p>
          <div className="flex flex-wrap gap-2">
            {sports.map((sport) => (
              <Button
                key={sport}
                variant="outline"
                size="sm"
                onClick={() => triggerBackfill(sport)}
                disabled={loading !== null}
                className="gap-2"
              >
                {loading === sport ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {sport.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted-foreground mb-2">Pipeline Actions</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerPipeline('ingest-games', 'Ingest Games')}
              disabled={loading !== null}
              className="gap-2"
            >
              {loading === 'ingest-games' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Ingest Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerPipeline('compute-percentiles', 'Compute Percentiles')}
              disabled={loading !== null}
              className="gap-2"
            >
              {loading === 'compute-percentiles' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Compute P05/P95
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerPipeline('refresh-odds', 'Refresh Odds')}
              disabled={loading !== null}
              className="gap-2"
            >
              {loading === 'refresh-odds' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Refresh DK Odds
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Status() {
  const { data, isLoading, error, refetch, isFetching } = useSystemStatus();

  return (
    <>
      <Helmet>
        <title>System Status | Percentile Totals</title>
        <meta name="description" content="View data pipeline status and odds matching results." />
      </Helmet>

      <Layout>
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
              <p className="text-muted-foreground mt-1">
                Pipeline health & strict odds matching
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ) : error ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Unable to load status</h2>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : data ? (
            <>
              {/* Today's Coverage */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Today's DraftKings Coverage</h2>
                  <span className="ml-auto text-xs text-muted-foreground">{data.date_et}</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div>
                    <p className="text-3xl font-bold">{data.today_coverage.visible_games}</p>
                    <p className="text-xs text-muted-foreground">Total Games</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-status-live">{data.today_coverage.with_dk_odds}</p>
                    <p className="text-xs text-muted-foreground">With DK Lines</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-muted-foreground">{data.today_coverage.unmatched}</p>
                    <p className="text-xs text-muted-foreground">Unmatched</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">
                      {data.today_coverage.visible_games > 0 
                        ? Math.round((data.today_coverage.with_dk_odds / data.today_coverage.visible_games) * 100)
                        : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Match Rate</p>
                  </div>
                </div>

                {/* Sport breakdown */}
                {Object.keys(data.today_coverage.by_sport).length > 0 && (
                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground mb-3">By Sport</p>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(data.today_coverage.by_sport).map(([sport, stats]) => (
                        <div key={sport} className="px-3 py-2 bg-secondary/30 rounded-lg">
                          <span className="text-xs font-medium uppercase">{sport}</span>
                          <span className="text-sm ml-2">
                            {stats.with_odds}/{stats.total}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmatched samples */}
                {data.sample_unmatched.length > 0 && (
                  <div className="border-t border-border pt-4 mt-4">
                    <p className="text-sm font-medium mb-3">
                      Unmatched Games (DK lines not found)
                    </p>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {data.sample_unmatched.map((item, i) => {
                        // Handle both string and object formats
                        if (typeof item === 'string') {
                          return (
                            <p key={i} className="text-xs text-muted-foreground font-mono">
                              {item}
                            </p>
                          );
                        }
                        // Object format with internal, internal_normalized, odds
                        const obj = item as { internal: string; internal_normalized?: string; odds?: Array<{ raw: string; normalized: string; time_diff_hrs: string }> };
                        return (
                          <div key={i} className="bg-secondary/20 p-3 rounded-lg space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Our game:</p>
                              <p className="text-sm font-medium">{obj.internal}</p>
                              {obj.internal_normalized && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  normalized: {obj.internal_normalized}
                                </p>
                              )}
                            </div>
                            {obj.odds && obj.odds.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">Closest DK events:</p>
                                <div className="space-y-1 mt-1">
                                  {obj.odds.map((odds, j) => (
                                    <div key={j} className="flex items-center justify-between text-xs bg-background/50 px-2 py-1 rounded">
                                      <span className="font-mono">{odds.raw}</span>
                                      <span className="text-muted-foreground">
                                        {odds.time_diff_hrs}h diff
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Cron Jobs */}
              <CronJobsSection />

              {/* Manual Controls */}
              <BackfillControls onComplete={() => refetch()} />

              {/* Pipeline Jobs (from job_runs table) */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Pipeline Jobs (Last Run)</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.keys(jobLabels).map((jobName) => (
                    <JobCard
                      key={jobName}
                      jobName={jobName}
                      job={data.jobs[jobName] || null}
                    />
                  ))}
                </div>
              </div>

              {/* Database Stats */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Database</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    label="Teams"
                    value={data.database.teams.toLocaleString()}
                    icon={Database}
                  />
                  <StatCard
                    label="Games"
                    value={data.database.games.toLocaleString()}
                    icon={Activity}
                  />
                  <StatCard
                    label="H2H Records"
                    value={data.database.matchup_games.toLocaleString()}
                    icon={BarChart3}
                  />
                </div>
              </div>

              {/* Footer */}
              <p className="text-xs text-muted-foreground text-center">
                Mode: {data.mode} • Updated {format(new Date(data.timestamp), 'h:mm a')}
              </p>
            </>
          ) : null}
        </div>
      </Layout>
    </>
  );
}
