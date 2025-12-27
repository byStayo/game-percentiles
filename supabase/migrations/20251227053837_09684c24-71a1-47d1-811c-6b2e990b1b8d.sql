-- Fix the security definer view by recreating it with SECURITY INVOKER
DROP VIEW IF EXISTS public.franchise_matchups;

CREATE VIEW public.franchise_matchups 
WITH (security_invoker = true) AS
SELECT 
  mg.sport_id,
  mg.franchise_low_id,
  mg.franchise_high_id,
  fl.canonical_name as franchise_low_name,
  fh.canonical_name as franchise_high_name,
  COUNT(*) as total_games,
  COUNT(*) FILTER (WHERE mg.season_year >= EXTRACT(YEAR FROM CURRENT_DATE) - 10) as games_10y,
  COUNT(*) FILTER (WHERE mg.season_year >= EXTRACT(YEAR FROM CURRENT_DATE) - 20) as games_20y,
  MIN(mg.played_at_utc) as first_game,
  MAX(mg.played_at_utc) as last_game
FROM public.matchup_games mg
LEFT JOIN public.franchises fl ON mg.franchise_low_id = fl.id
LEFT JOIN public.franchises fh ON mg.franchise_high_id = fh.id
WHERE mg.franchise_low_id IS NOT NULL AND mg.franchise_high_id IS NOT NULL
GROUP BY mg.sport_id, mg.franchise_low_id, mg.franchise_high_id, fl.canonical_name, fh.canonical_name;