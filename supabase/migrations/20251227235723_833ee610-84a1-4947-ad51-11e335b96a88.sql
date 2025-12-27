-- Add columns for edge detection based on alternate totals
ALTER TABLE public.daily_edges 
  ADD COLUMN IF NOT EXISTS p95_over_line numeric,
  ADD COLUMN IF NOT EXISTS p95_over_odds numeric,
  ADD COLUMN IF NOT EXISTS p05_under_line numeric,
  ADD COLUMN IF NOT EXISTS p05_under_odds numeric,
  ADD COLUMN IF NOT EXISTS best_over_edge numeric,
  ADD COLUMN IF NOT EXISTS best_under_edge numeric,
  ADD COLUMN IF NOT EXISTS alternate_lines jsonb;

-- Add comment explaining the new columns
COMMENT ON COLUMN public.daily_edges.p95_over_line IS 'Lowest over line that is >= historical p95';
COMMENT ON COLUMN public.daily_edges.p95_over_odds IS 'American odds for the p95 over bet';
COMMENT ON COLUMN public.daily_edges.p05_under_line IS 'Highest under line that is <= historical p05';
COMMENT ON COLUMN public.daily_edges.p05_under_odds IS 'American odds for the p05 under bet';
COMMENT ON COLUMN public.daily_edges.best_over_edge IS 'Points above DK line where historical p95 sits';
COMMENT ON COLUMN public.daily_edges.best_under_edge IS 'Points below DK line where historical p05 sits';
COMMENT ON COLUMN public.daily_edges.alternate_lines IS 'All alternate O/U lines with odds from DraftKings';