import { useState, useEffect } from "react";
import { Activity, Loader2, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Progress } from "@/components/ui/progress";

interface JobDetails {
  sport?: string;
  counters?: {
    fetched?: number;
    inserted?: number;
    errors?: number;
    nba?: number;
    nfl?: number;
    nhl?: number;
    mlb?: number;
  };
  sports?: string[];
  seasons_processed?: number;
  total_seasons?: number;
}

interface RunningJob {
  id: number;
  job_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  details: JobDetails | null;
}

export function LiveJobProgress() {
  const [runningJobs, setRunningJobs] = useState<RunningJob[]>([]);
  const [recentJobs, setRecentJobs] = useState<RunningJob[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  const fetchJobs = async () => {
    // Fetch running jobs
    const { data: running } = await supabase
      .from("job_runs")
      .select("*")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(5);

    // Fetch recent completed jobs (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("job_runs")
      .select("*")
      .neq("status", "running")
      .gte("finished_at", oneHourAgo)
      .order("finished_at", { ascending: false })
      .limit(5);

    setRunningJobs((running as RunningJob[]) || []);
    setRecentJobs((recent as RunningJob[]) || []);
    setIsPolling((running?.length ?? 0) > 0);
  };

  useEffect(() => {
    fetchJobs();
    
    // Poll every 3 seconds if there are running jobs, otherwise every 30 seconds
    const interval = setInterval(() => {
      fetchJobs();
    }, isPolling ? 3000 : 30000);

    return () => clearInterval(interval);
  }, [isPolling]);

  const getSportCounts = (details: JobDetails | null) => {
    if (!details?.counters) return null;
    const { nba, nfl, nhl, mlb } = details.counters;
    if (!nba && !nfl && !nhl && !mlb) return null;
    return { nba: nba || 0, nfl: nfl || 0, nhl: nhl || 0, mlb: mlb || 0 };
  };

  const getTotalGames = (details: JobDetails | null) => {
    const counts = getSportCounts(details);
    if (!counts) return details?.counters?.inserted || details?.counters?.fetched || 0;
    return counts.nba + counts.nfl + counts.nhl + counts.mlb;
  };

  const getProgress = (details: JobDetails | null) => {
    if (!details?.seasons_processed || !details?.total_seasons) return null;
    return Math.round((details.seasons_processed / details.total_seasons) * 100);
  };

  if (runningJobs.length === 0 && recentJobs.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Live Job Progress</h2>
        {isPolling && (
          <span className="flex items-center gap-1 text-xs text-status-live ml-auto">
            <span className="w-2 h-2 rounded-full bg-status-live animate-pulse" />
            Live
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Running Jobs */}
        {runningJobs.map((job) => {
          const sportCounts = getSportCounts(job.details);
          const totalGames = getTotalGames(job.details);
          const progress = getProgress(job.details);
          const errors = job.details?.counters?.errors || 0;

          return (
            <div
              key={job.id}
              className="p-4 bg-secondary/30 rounded-lg border border-status-live/30 animate-pulse-subtle"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-status-live animate-spin" />
                  <span className="font-medium">{job.job_name}</span>
                  <span className="text-xs bg-status-live/20 text-status-live px-2 py-0.5 rounded-full">
                    RUNNING
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Started {formatDistanceToNow(new Date(job.started_at), { addSuffix: true })}
                </span>
              </div>

              {/* Progress bar */}
              {progress !== null && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Sport counts grid */}
              {sportCounts && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {Object.entries(sportCounts).map(([sport, count]) => (
                    <div
                      key={sport}
                      className="bg-background/50 rounded-lg p-2 text-center"
                    >
                      <p className="text-lg font-bold">{count.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground uppercase">{sport}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-status-live" />
                  <span className="font-medium">{totalGames.toLocaleString()}</span>
                  <span className="text-muted-foreground">games</span>
                </div>
                {errors > 0 && (
                  <div className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-3 w-3" />
                    <span>{errors.toLocaleString()} errors</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Recent completed jobs */}
        {recentJobs.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground mb-3">Recently Completed</p>
            <div className="space-y-2">
              {recentJobs.map((job) => {
                const totalGames = getTotalGames(job.details);
                const sportCounts = getSportCounts(job.details);
                const isSuccess = job.status === "success";
                const errors = job.details?.counters?.errors || 0;

                return (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {isSuccess ? (
                        <CheckCircle2 className="h-4 w-4 text-status-live" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-medium text-sm">{job.job_name}</span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          isSuccess
                            ? "bg-status-live/20 text-status-live"
                            : "bg-destructive/20 text-destructive"
                        )}
                      >
                        {job.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {sportCounts ? (
                        <div className="flex gap-2">
                          {Object.entries(sportCounts).map(([sport, count]) =>
                            count > 0 ? (
                              <span key={sport} className="uppercase">
                                {sport}: {count.toLocaleString()}
                              </span>
                            ) : null
                          )}
                        </div>
                      ) : totalGames > 0 ? (
                        <span>{totalGames.toLocaleString()} games</span>
                      ) : null}
                      {errors > 0 && (
                        <span className="text-destructive">{errors} errors</span>
                      )}
                      <span>
                        {job.finished_at &&
                          formatDistanceToNow(new Date(job.finished_at), {
                            addSuffix: true,
                          })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
