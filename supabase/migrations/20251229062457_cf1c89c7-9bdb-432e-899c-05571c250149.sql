-- =========================================================
-- New tables for maximizing BallDontLie GOAT tier features
-- =========================================================

-- Player injuries table (BDL GOAT exclusive endpoint)
CREATE TABLE public.player_injuries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES public.sports(id),
  team_id UUID REFERENCES public.teams(id),
  player_external_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT,
  injury_status TEXT NOT NULL, -- 'Out', 'Doubtful', 'Questionable', 'Probable'
  injury_type TEXT,
  injury_details TEXT,
  report_date DATE,
  game_date DATE,
  season_year INTEGER,
  week_round INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sport_id, player_external_id, game_date)
);

-- Player props table (BDL GOAT exclusive endpoint)
CREATE TABLE public.player_props (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES public.sports(id),
  game_id UUID REFERENCES public.games(id),
  player_external_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team_abbrev TEXT,
  market_type TEXT NOT NULL, -- 'pass_yds', 'rush_yds', 'rec_yds', 'points', 'rebounds', etc.
  line NUMERIC NOT NULL,
  over_odds INTEGER,
  under_odds INTEGER,
  bookmaker TEXT DEFAULT 'draftkings',
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Team standings table
CREATE TABLE public.team_standings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES public.sports(id),
  team_id UUID REFERENCES public.teams(id),
  team_abbrev TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  conference TEXT,
  division TEXT,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  ties INTEGER DEFAULT 0,
  win_pct NUMERIC,
  games_back NUMERIC,
  conf_wins INTEGER DEFAULT 0,
  conf_losses INTEGER DEFAULT 0,
  div_wins INTEGER DEFAULT 0,
  div_losses INTEGER DEFAULT 0,
  home_wins INTEGER DEFAULT 0,
  home_losses INTEGER DEFAULT 0,
  away_wins INTEGER DEFAULT 0,
  away_losses INTEGER DEFAULT 0,
  streak TEXT,
  last_10 TEXT,
  points_for NUMERIC,
  points_against NUMERIC,
  point_diff NUMERIC,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sport_id, team_abbrev, season_year)
);

-- Enable RLS on all new tables
ALTER TABLE public.player_injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_standings ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public can read player_injuries" 
  ON public.player_injuries FOR SELECT 
  USING (true);

CREATE POLICY "Public can read player_props" 
  ON public.player_props FOR SELECT 
  USING (true);

CREATE POLICY "Public can read team_standings" 
  ON public.team_standings FOR SELECT 
  USING (true);

-- Service manage policies  
CREATE POLICY "Service can manage player_injuries" 
  ON public.player_injuries FOR ALL 
  USING (true);

CREATE POLICY "Service can manage player_props" 
  ON public.player_props FOR ALL 
  USING (true);

CREATE POLICY "Service can manage team_standings" 
  ON public.team_standings FOR ALL 
  USING (true);

-- Indexes for performance
CREATE INDEX idx_player_injuries_sport_date ON public.player_injuries(sport_id, game_date);
CREATE INDEX idx_player_injuries_team ON public.player_injuries(team_id);
CREATE INDEX idx_player_props_game ON public.player_props(game_id);
CREATE INDEX idx_player_props_market ON public.player_props(market_type);
CREATE INDEX idx_team_standings_sport_season ON public.team_standings(sport_id, season_year);