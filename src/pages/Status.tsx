import { Helmet } from "react-helmet-async";
import { format, formatDistanceToNow } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, RefreshCw, BarChart3 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useJobStatus, useRecentJobs } from "@/hooks/useJobStatus";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { JobRun } from "@/types";

const ET_TIMEZONE = 'America/New_York';

function getTodayET(): string {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  return format(etDate, 'yyyy-MM-dd');
}

const jobLabels: Record<string, { name: string; description: string }> = {
  backfill: { name: "Backfill", description: "Historical data import" },
  ingest: { name: "Daily Ingest", description: "Today's games sync" },
  compute: { name: "Compute", description: "Percentile calculations" },
  odds_refresh: { name: "Odds Refresh", description: "DraftKings lines (strict match)" },
};

function JobStatusCard({ jobName, job }: { jobName: string; job: JobRun | null }) {
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
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                job.status === 'success' && "bg-status-live/10 text-status-live border-status-live/30",
                job.status === 'fail' && "bg-destructive/10 text-destructive border-destructive/30",
                job.status === 'running' && "bg-secondary"
              )}
            >
              {job.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(job.started_at), { addSuffix: true })}
          </p>
          {job.finished_at && (
            <p className="text-xs text-muted-foreground">
              Duration: {Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No runs yet</p>
      )}
    </div>
  );
}

export default function Status() {
  const { data: jobStatus, isLoading: statusLoading } = useJobStatus();
  const { data: recentJobs, isLoading: jobsLoading } = useRecentJobs();

  // Get today's odds stats (strict matching mode)
  const { data: oddsStats } = useQuery({
    queryKey: ['odds-stats-strict'],
    queryFn: async () => {
      const today = getTodayET();
      
      const { data: edges } = await supabase
        .from('daily_edges')
        .select('dk_offered')
        .eq('date_local', today);

      const total = edges?.length || 0;
      const withOdds = edges?.filter(e => e.dk_offered).length || 0;

      // Get recent unmatched reasons from job runs
      const { data: recentOddsJobs } = await supabase
        .from('job_runs')
        .select('details')
        .eq('job_name', 'odds_refresh')
        .eq('status', 'success')
        .order('finished_at', { ascending: false })
        .limit(5);

      const allUnmatchedReasons: string[] = [];
      for (const job of recentOddsJobs || []) {
        const reasons = (job.details as any)?.unmatched_reasons || [];
        allUnmatchedReasons.push(...reasons);
      }

      // Dedupe
      const uniqueReasons = [...new Set(allUnmatchedReasons)].slice(0, 10);

      return {
        total,
        withOdds,
        unmatched: total - withOdds,
        coverage: total > 0 ? (withOdds / total) * 100 : 0,
        unmatchedReasons: uniqueReasons,
      };
    },
  });

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
              Pipeline health & strict odds matching results
            </p>
          </div>

          {/* Today's Odds Coverage */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Today's DraftKings Coverage</h2>
              <Badge variant="secondary" className="text-xs">Strict Match</Badge>
            </div>
            
            {oddsStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-status-live">{oddsStats.withOdds}</p>
                    <p className="text-xs text-muted-foreground">Games with DK Lines</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground">{oddsStats.unmatched}</p>
                    <p className="text-xs text-muted-foreground">Unmatched (strict)</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{oddsStats.coverage.toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">Match Rate</p>
                  </div>
                </div>

                {/* Unmatched reasons */}
                {oddsStats.unmatchedReasons.length > 0 && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-2">
                      Unmatched due to strict matching (no action required):
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {oddsStats.unmatchedReasons.map((reason: string, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">
                          {reason}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground pt-2">
                  Using hardcoded normalization + alias dictionary. Games without exact name+time match show "DraftKings totals: unavailable".
                </p>
              </div>
            ) : (
              <Skeleton className="h-24" />
            )}
          </div>

          {/* Job status cards */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Pipeline Status</h2>
            {statusLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Object.keys(jobLabels).map((jobName) => (
                  <JobStatusCard
                    key={jobName}
                    jobName={jobName}
                    job={jobStatus?.[jobName] || null}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recent jobs table */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Recent Job Runs</h2>
            {jobsLoading ? (
              <Skeleton className="h-64" />
            ) : recentJobs && recentJobs.length > 0 ? (
              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Job</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Started</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((job) => (
                      <tr key={job.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <span className="font-medium">
                            {jobLabels[job.job_name]?.name || job.job_name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              job.status === 'success' && "bg-status-live/10 text-status-live border-status-live/30",
                              job.status === 'fail' && "bg-destructive/10 text-destructive border-destructive/30",
                              job.status === 'running' && "bg-secondary"
                            )}
                          >
                            {job.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {format(new Date(job.started_at), 'MMM d, h:mm a')}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {job.finished_at
                            ? `${Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground">No job runs yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Jobs are triggered automatically on schedule
                </p>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}
