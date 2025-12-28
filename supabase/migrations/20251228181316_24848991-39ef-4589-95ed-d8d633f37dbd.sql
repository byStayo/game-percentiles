-- Create table to track lock parlay history
CREATE TABLE public.lock_parlay_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  num_legs integer NOT NULL,
  legs_hit integer DEFAULT 0,
  legs_pending integer DEFAULT 0,
  is_complete boolean DEFAULT false,
  is_win boolean DEFAULT false,
  combined_probability numeric,
  legs jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE public.lock_parlay_history ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth in this app)
CREATE POLICY "Public can read lock_parlay_history"
ON public.lock_parlay_history
FOR SELECT
USING (true);

-- Service can manage
CREATE POLICY "Service can manage lock_parlay_history"
ON public.lock_parlay_history
FOR ALL
USING (true);

-- Create index for querying recent parlays
CREATE INDEX idx_lock_parlay_history_created_at ON public.lock_parlay_history(created_at DESC);