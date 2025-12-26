-- Fix security issue: Restrict job_runs to service role only
DROP POLICY IF EXISTS "Public can read job_runs" ON public.job_runs;

-- Create restrictive policy (only service role via RLS bypass)
CREATE POLICY "Service can read job_runs" 
ON public.job_runs 
FOR SELECT 
USING (false);

-- Note: Service role bypasses RLS, so this effectively makes it service-only