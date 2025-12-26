-- Add missing columns to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS city text;

-- Add is_visible column to daily_edges
ALTER TABLE public.daily_edges 
ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT false;

-- Add counters column to job_runs (rename details to be more specific)
-- Actually keep details but ensure counters is documented in usage

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_matchup_games_matchup 
ON public.matchup_games(sport_id, league_id, team_low_id, team_high_id);

CREATE INDEX IF NOT EXISTS idx_matchup_games_game 
ON public.matchup_games(game_id);

CREATE INDEX IF NOT EXISTS idx_matchup_stats_matchup 
ON public.matchup_stats(sport_id, league_id, team_low_id, team_high_id);

CREATE INDEX IF NOT EXISTS idx_daily_edges_date_sport 
ON public.daily_edges(date_local, sport_id);

CREATE INDEX IF NOT EXISTS idx_odds_snapshots_game_fetched 
ON public.odds_snapshots(game_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_games_sport_date 
ON public.games(sport_id, start_time_utc);

CREATE INDEX IF NOT EXISTS idx_games_status 
ON public.games(status);

-- Add unique constraint on daily_edges if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_edges_date_game_unique'
  ) THEN
    ALTER TABLE public.daily_edges 
    ADD CONSTRAINT daily_edges_date_game_unique UNIQUE (date_local, game_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add unique constraint on matchup_games if not exists  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matchup_games_matchup_game_unique'
  ) THEN
    ALTER TABLE public.matchup_games 
    ADD CONSTRAINT matchup_games_matchup_game_unique 
    UNIQUE (sport_id, league_id, team_low_id, team_high_id, game_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add unique constraint on matchup_stats if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matchup_stats_matchup_unique'
  ) THEN
    ALTER TABLE public.matchup_stats 
    ADD CONSTRAINT matchup_stats_matchup_unique 
    UNIQUE (sport_id, league_id, team_low_id, team_high_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;