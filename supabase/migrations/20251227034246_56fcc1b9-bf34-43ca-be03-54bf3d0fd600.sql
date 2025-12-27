-- Create game_eras table for categorizing historical periods
CREATE TABLE public.game_eras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id text NOT NULL REFERENCES public.sports(id),
  era_name text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create team_seasons table for yearly team stats
CREATE TABLE public.team_seasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  sport_id text NOT NULL REFERENCES public.sports(id),
  season_year integer NOT NULL,
  conference text,
  division text,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  ppg_avg numeric,
  opp_ppg_avg numeric,
  playoff_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, season_year)
);

-- Create roster_snapshots table for tracking team continuity
CREATE TABLE public.roster_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  sport_id text NOT NULL REFERENCES public.sports(id),
  season_year integer NOT NULL,
  key_players jsonb DEFAULT '[]'::jsonb,
  continuity_score numeric,
  era_tag text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, season_year)
);

-- Enable RLS on all tables
ALTER TABLE public.game_eras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read policies (these are reference data)
CREATE POLICY "Public can read game_eras"
  ON public.game_eras FOR SELECT
  USING (true);

CREATE POLICY "Public can read team_seasons"
  ON public.team_seasons FOR SELECT
  USING (true);

CREATE POLICY "Public can read roster_snapshots"
  ON public.roster_snapshots FOR SELECT
  USING (true);

-- Service write policies
CREATE POLICY "Service can manage game_eras"
  ON public.game_eras FOR ALL
  USING (true);

CREATE POLICY "Service can manage team_seasons"
  ON public.team_seasons FOR ALL
  USING (true);

CREATE POLICY "Service can manage roster_snapshots"
  ON public.roster_snapshots FOR ALL
  USING (true);

-- Indexes for performance
CREATE INDEX idx_team_seasons_team_year ON public.team_seasons(team_id, season_year);
CREATE INDEX idx_team_seasons_sport_year ON public.team_seasons(sport_id, season_year);
CREATE INDEX idx_roster_snapshots_team_year ON public.roster_snapshots(team_id, season_year);
CREATE INDEX idx_game_eras_sport ON public.game_eras(sport_id);