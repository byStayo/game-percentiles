import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { JobRun } from "@/types";

export function useJobStatus() {
  return useQuery({
    queryKey: ['job-status'],
    queryFn: async () => {
      const jobNames = ['backfill', 'ingest', 'compute', 'odds_refresh'];
      
      const results: Record<string, JobRun | null> = {};
      
      for (const jobName of jobNames) {
        const { data } = await supabase
          .from('job_runs')
          .select('*')
          .eq('job_name', jobName)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        results[jobName] = data as JobRun | null;
      }
      
      return results;
    },
    refetchInterval: 30000,
  });
}

export function useRecentJobs(limit = 20) {
  return useQuery({
    queryKey: ['recent-jobs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as JobRun[];
    },
    refetchInterval: 30000,
  });
}
