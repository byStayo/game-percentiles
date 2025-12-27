-- ============================================================
-- FULL HISTORICAL WAREHOUSE + SEGMENTATION SCHEMA
-- ============================================================

-- 1. Seasons table - track all seasons per sport/league
CREATE TABLE public.seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES public.sports(id),
  league_id UUID REFERENCES public.leagues(id),
  season_year INTEGER NOT NULL,
  provider_season_key TEXT,
  start_date DATE,
  end_date DATE,
  games_count INTEGER DEFAULT 0,
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sport_id, league_id, season_year)
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read seasons" ON public.seasons FOR SELECT USING (true);
CREATE POLICY "Service can manage seasons" ON public.seasons FOR ALL USING (true);

-- 2. Provider raw payloads - data lake for audit/re-derive
CREATE TABLE public.provider_raw (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'espn',
  endpoint TEXT NOT NULL,
  params_hash TEXT NOT NULL,
  sport_id TEXT NOT NULL,
  season_year INTEGER,
  payload_json JSONB NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(provider, endpoint, params_hash, fetched_at)
);

ALTER TABLE public.provider_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage provider_raw" ON public.provider_raw FOR ALL USING (true);

-- Create index for lookups
CREATE INDEX idx_provider_raw_sport_season ON public.provider_raw(sport_id, season_year);

-- 3. Franchises - stable entity across rebrands/relocations
CREATE TABLE public.franchises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES public.sports(id),
  league_id UUID REFERENCES public.leagues(id),
  canonical_name TEXT NOT NULL,
  founded_year INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sport_id, canonical_name)
);

ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read franchises" ON public.franchises FOR SELECT USING (true);
CREATE POLICY "Service can manage franchises" ON public.franchises FOR ALL USING (true);

-- 4. Team versions - identity over time (rebrands, relocations)
CREATE TABLE public.team_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES public.sports(id),
  league_id UUID REFERENCES public.leagues(id),
  franchise_id UUID NOT NULL REFERENCES public.franchises(id),
  display_name TEXT NOT NULL,
  city TEXT,
  abbrev TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.team_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read team_versions" ON public.team_versions FOR SELECT USING (true);
CREATE POLICY "Service can manage team_versions" ON public.team_versions FOR ALL USING (true);

CREATE INDEX idx_team_versions_franchise ON public.team_versions(franchise_id);
CREATE INDEX idx_team_versions_dates ON public.team_versions(effective_from, effective_to);

-- 5. Team version map - maps provider keys to our identity
CREATE TABLE public.team_version_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES public.sports(id),
  league_id UUID REFERENCES public.leagues(id),
  provider TEXT NOT NULL DEFAULT 'espn',
  provider_team_key TEXT NOT NULL,
  team_version_id UUID NOT NULL REFERENCES public.team_versions(id),
  franchise_id UUID NOT NULL REFERENCES public.franchises(id),
  team_id UUID REFERENCES public.teams(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sport_id, provider, provider_team_key)
);

ALTER TABLE public.team_version_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read team_version_map" ON public.team_version_map FOR SELECT USING (true);
CREATE POLICY "Service can manage team_version_map" ON public.team_version_map FOR ALL USING (true);

CREATE INDEX idx_team_version_map_lookup ON public.team_version_map(sport_id, provider, provider_team_key);

-- 6. Add columns to games table
ALTER TABLE public.games 
  ADD COLUMN IF NOT EXISTS season_year INTEGER,
  ADD COLUMN IF NOT EXISTS decade TEXT,
  ADD COLUMN IF NOT EXISTS is_playoff BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS week_round INTEGER,
  ADD COLUMN IF NOT EXISTS home_franchise_id UUID REFERENCES public.franchises(id),
  ADD COLUMN IF NOT EXISTS away_franchise_id UUID REFERENCES public.franchises(id);

CREATE INDEX idx_games_season ON public.games(sport_id, season_year);
CREATE INDEX idx_games_decade ON public.games(sport_id, decade);
CREATE INDEX idx_games_franchises ON public.games(home_franchise_id, away_franchise_id);

-- 7. Add columns to matchup_games table
ALTER TABLE public.matchup_games 
  ADD COLUMN IF NOT EXISTS franchise_low_id UUID REFERENCES public.franchises(id),
  ADD COLUMN IF NOT EXISTS franchise_high_id UUID REFERENCES public.franchises(id),
  ADD COLUMN IF NOT EXISTS team_version_low_id UUID REFERENCES public.team_versions(id),
  ADD COLUMN IF NOT EXISTS team_version_high_id UUID REFERENCES public.team_versions(id),
  ADD COLUMN IF NOT EXISTS season_year INTEGER,
  ADD COLUMN IF NOT EXISTS decade TEXT;

CREATE INDEX idx_matchup_games_franchises ON public.matchup_games(franchise_low_id, franchise_high_id);
CREATE INDEX idx_matchup_games_season ON public.matchup_games(sport_id, season_year);

-- 8. Add segment_key to matchup_stats
ALTER TABLE public.matchup_stats 
  ADD COLUMN IF NOT EXISTS segment_key TEXT DEFAULT 'h2h_all',
  ADD COLUMN IF NOT EXISTS franchise_low_id UUID REFERENCES public.franchises(id),
  ADD COLUMN IF NOT EXISTS franchise_high_id UUID REFERENCES public.franchises(id);

-- Drop old unique constraint if exists and create new one with segment_key
DROP INDEX IF EXISTS matchup_stats_sport_id_team_low_id_team_high_id_key;

-- Create unique constraint including segment_key
CREATE UNIQUE INDEX idx_matchup_stats_unique 
  ON public.matchup_stats(sport_id, COALESCE(franchise_low_id, team_low_id), COALESCE(franchise_high_id, team_high_id), segment_key);

-- 9. Add segment fields to daily_edges
ALTER TABLE public.daily_edges 
  ADD COLUMN IF NOT EXISTS segment_used TEXT DEFAULT 'h2h_all',
  ADD COLUMN IF NOT EXISTS n_used INTEGER,
  ADD COLUMN IF NOT EXISTS franchise_matchup_id TEXT;

-- 10. Create franchise_matchups view for easy querying
CREATE OR REPLACE VIEW public.franchise_matchups AS
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