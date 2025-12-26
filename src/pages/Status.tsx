import { Helmet } from "react-helmet-async";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, Clock, RefreshCw, BarChart3, Database, Activity } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useSystemStatus } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

export default function Status() {
  const { data, isLoading, error } = useSystemStatus();

  return (
    <>
      <Helmet>
        <title>System Status | Percentile Totals</title>
        <meta name="description" content="View data pipeline status and odds matching results." />
      </Helmet>

      <Layout>
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
            <p className="text-muted-foreground mt-1">
              Pipeline health & strict odds matching
            </p>
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
                    <p className="text-sm text-muted-foreground mb-2">
                      Sample unmatched (strict mode):
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {data.sample_unmatched.map((reason, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">
                          {reason}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Job Status */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Pipeline Jobs</h2>
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
