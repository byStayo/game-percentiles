import { Helmet } from "react-helmet-async";
import { format, formatDistanceToNow } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, Play } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useJobStatus, useRecentJobs } from "@/hooks/useJobStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { JobRun, SportId } from "@/types";

const ET_TIMEZONE = 'America/New_York';

// Get today's date in ET timezone as YYYY-MM-DD
function getTodayET(): string {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  return format(etDate, 'yyyy-MM-dd');
}

const jobLabels: Record<string, { name: string; description: string }> = {
  backfill: { name: "Backfill", description: "Historical data import" },
  ingest: { name: "Daily Ingest", description: "Today's games sync" },
  compute: { name: "Compute", description: "Percentile calculations" },
  odds_refresh: { name: "Odds Refresh", description: "DraftKings lines sync" },
};

const sports: SportId[] = ['nfl', 'nba', 'mlb', 'nhl', 'soccer'];

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

function TriggerJobButton({ jobName, sportId }: { jobName: string; sportId?: SportId }) {
  const triggerJob = async () => {
    try {
      const functionName = jobName === 'ingest' ? 'ingest-games' :
                          jobName === 'compute' ? 'compute-percentiles' :
                          jobName === 'odds_refresh' ? 'refresh-odds' :
                          jobName;

      const body: Record<string, unknown> = {};
      if (sportId) body.sport_id = sportId;
      // Use ET timezone for date
      if (jobName !== 'backfill') body.date = getTodayET();

      const { error } = await supabase.functions.invoke(functionName, { body });

      if (error) throw error;
      toast.success(`${jobLabels[jobName]?.name || jobName} job triggered`);
    } catch (error) {
      toast.error(`Failed to trigger job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={triggerJob} className="gap-1">
      <Play className="h-3 w-3" />
      Run {sportId?.toUpperCase() || ''}
    </Button>
  );
}

export default function Status() {
  const { data: jobStatus, isLoading: statusLoading } = useJobStatus();
  const { data: recentJobs, isLoading: jobsLoading } = useRecentJobs();

  // Get mapping stats
  const { data: mappingStats } = useQuery({
    queryKey: ['mapping-stats'],
    queryFn: async () => {
      const { data: teams } = await supabase.from('teams').select('id, sport_id');
      const { data: mappings } = await supabase.from('provider_mappings').select('team_id, sport_id');

      const mappedTeamIds = new Set((mappings || []).map(m => m.team_id));
      const unmappedBySport: Record<string, number> = {};

      (teams || []).forEach(team => {
        if (!mappedTeamIds.has(team.id)) {
          unmappedBySport[team.sport_id] = (unmappedBySport[team.sport_id] || 0) + 1;
        }
      });

      return {
        totalTeams: teams?.length || 0,
        mappedTeams: mappings?.length || 0,
        unmappedBySport,
      };
    },
  });

  // Get unmatched odds events (games without DK line) - use ET timezone
  const { data: unmatchedCount } = useQuery({
    queryKey: ['unmatched-odds'],
    queryFn: async () => {
      const today = getTodayET();
      const { data } = await supabase
        .from('daily_edges')
        .select('id')
        .eq('date_local', today)
        .eq('dk_offered', false);

      return data?.length || 0;
    },
  });

  return (
    <>
      <Helmet>
        <title>System Status | Percentile Totals</title>
        <meta name="description" content="View data pipeline status and job history for Percentile Totals system." />
      </Helmet>

      <Layout>
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
            <p className="text-muted-foreground mt-1">
              Data pipeline health and job history
            </p>
          </div>

          {/* Quick actions */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-card">
            <h2 className="text-lg font-semibold mb-4">Trigger Jobs</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Backfill historical data:</p>
                <div className="flex flex-wrap gap-2">
                  {sports.map(sport => (
                    <TriggerJobButton key={sport} jobName="backfill" sportId={sport} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Ingest today's games:</p>
                <div className="flex flex-wrap gap-2">
                  {sports.map(sport => (
                    <TriggerJobButton key={sport} jobName="ingest" sportId={sport} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Refresh odds:</p>
                <div className="flex flex-wrap gap-2">
                  {sports.map(sport => (
                    <TriggerJobButton key={sport} jobName="odds_refresh" sportId={sport} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mapping health */}
          {mappingStats && (
            <div className="bg-card rounded-xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Mapping Health</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-bold">{mappingStats.totalTeams}</p>
                  <p className="text-xs text-muted-foreground">Total Teams</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-status-live">{mappingStats.mappedTeams}</p>
                  <p className="text-xs text-muted-foreground">Mapped</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-percentile-mid">
                    {mappingStats.totalTeams - mappingStats.mappedTeams}
                  </p>
                  <p className="text-xs text-muted-foreground">Unmapped</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{unmatchedCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Missing Odds Today</p>
                </div>
              </div>
              {Object.keys(mappingStats.unmappedBySport).length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Unmapped by sport:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(mappingStats.unmappedBySport).map(([sport, count]) => (
                      <Badge key={sport} variant="outline" className="bg-percentile-mid/10 text-percentile-mid border-percentile-mid/30">
                        {sport.toUpperCase()}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Job status cards */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Pipeline Status</h2>
            {statusLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
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
                  Use the buttons above to trigger jobs manually
                </p>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}
