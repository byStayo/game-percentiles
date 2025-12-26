-- Sports reference table
CREATE TABLE public.sports (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
);

-- Insert sports
INSERT INTO public.sports (id, display_name) VALUES
  ('nfl', 'NFL'),
  ('nba', 'NBA'),
  ('mlb', 'MLB'),
  ('nhl', 'NHL'),
  ('soccer', 'Soccer');

-- Leagues table (for soccer competitions and future subdivisions)
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  provider_league_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sport_id, provider_league_key)
);

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  league_id UUID REFERENCES public.leagues(id) ON DELETE SET NULL,
  provider_team_key TEXT NOT NULL,
  name TEXT NOT NULL,
  abbrev TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sport_id, league_id, provider_team_key)
);

-- Games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  league_id UUID REFERENCES public.leagues(id) ON DELETE SET NULL,
  provider_game_key TEXT NOT NULL,
  start_time_utc TIMESTAMPTZ NOT NULL,
  home_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  home_score NUMERIC,
  away_score NUMERIC,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'final')),
  final_total NUMERIC GENERATED ALWAYS AS (
    CASE WHEN status = 'final' AND home_score IS NOT NULL AND away_score IS NOT NULL 
    THEN home_score + away_score ELSE NULL END
  ) STORED,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sport_id, league_id, provider_game_key)
);

-- Matchup games (normalized H2H finals)
CREATE TABLE public.matchup_games (
  id BIGSERIAL PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  league_id UUID REFERENCES public.leagues(id) ON DELETE SET NULL,
  team_low_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_high_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  played_at_utc TIMESTAMPTZ NOT NULL,
  total NUMERIC NOT NULL,
  UNIQUE(sport_id, league_id, team_low_id, team_high_id, game_id)
);

CREATE INDEX idx_matchup_games_teams ON public.matchup_games(sport_id, league_id, team_low_id, team_high_id);
CREATE INDEX idx_matchup_games_game ON public.matchup_games(game_id);

-- Matchup stats (materialized cache)
CREATE TABLE public.matchup_stats (
  id BIGSERIAL PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  league_id UUID REFERENCES public.leagues(id) ON DELETE SET NULL,
  team_low_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_high_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  n_games INTEGER NOT NULL DEFAULT 0,
  p05 NUMERIC,
  p95 NUMERIC,
  median NUMERIC,
  min_total NUMERIC,
  max_total NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sport_id, league_id, team_low_id, team_high_id)
);

-- Daily edges (UI reads)
CREATE TABLE public.daily_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_local DATE NOT NULL,
  sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  league_id UUID REFERENCES public.leagues(id) ON DELETE SET NULL,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  n_h2h INTEGER NOT NULL DEFAULT 0,
  p05 NUMERIC,
  p95 NUMERIC,
  dk_offered BOOLEAN NOT NULL DEFAULT false,
  dk_total_line NUMERIC,
  dk_line_percentile NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date_local, game_id)
);

CREATE INDEX idx_daily_edges_date_sport ON public.daily_edges(date_local, sport_id);

-- Provider mappings (for odds matching)
CREATE TABLE public.provider_mappings (
  id BIGSERIAL PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  league_id UUID REFERENCES public.leagues(id) ON DELETE SET NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  odds_api_team_name TEXT NOT NULL,
  last_verified_at TIMESTAMPTZ,
  UNIQUE(sport_id, league_id, team_id)
);

-- Odds snapshots
CREATE TABLE public.odds_snapshots (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  bookmaker TEXT NOT NULL DEFAULT 'draftkings',
  market TEXT NOT NULL DEFAULT 'totals',
  total_line NUMERIC,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB
);

CREATE INDEX idx_odds_snapshots_game ON public.odds_snapshots(game_id, fetched_at DESC);

-- Job runs (observability)
CREATE TABLE public.job_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'fail')),
  details JSONB
);

CREATE INDEX idx_job_runs_name_time ON public.job_runs(job_name, started_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchup_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchup_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odds_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public can read sports" ON public.sports FOR SELECT USING (true);
CREATE POLICY "Public can read enabled leagues" ON public.leagues FOR SELECT USING (is_enabled = true);
CREATE POLICY "Public can read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Public can read games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Public can read matchup_stats" ON public.matchup_stats FOR SELECT USING (true);
CREATE POLICY "Public can read daily_edges" ON public.daily_edges FOR SELECT USING (true);
CREATE POLICY "Public can read job_runs" ON public.job_runs FOR SELECT USING (true);

-- Service role write policies (for edge functions)
CREATE POLICY "Service can insert sports" ON public.sports FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update sports" ON public.sports FOR UPDATE USING (true);
CREATE POLICY "Service can insert leagues" ON public.leagues FOR ALL USING (true);
CREATE POLICY "Service can manage teams" ON public.teams FOR ALL USING (true);
CREATE POLICY "Service can manage games" ON public.games FOR ALL USING (true);
CREATE POLICY "Service can manage matchup_games" ON public.matchup_games FOR ALL USING (true);
CREATE POLICY "Service can manage matchup_stats" ON public.matchup_stats FOR ALL USING (true);
CREATE POLICY "Service can manage daily_edges" ON public.daily_edges FOR ALL USING (true);
CREATE POLICY "Service can manage provider_mappings" ON public.provider_mappings FOR ALL USING (true);
CREATE POLICY "Service can manage odds_snapshots" ON public.odds_snapshots FOR ALL USING (true);
CREATE POLICY "Service can manage job_runs" ON public.job_runs FOR ALL USING (true);