-- Create partial unique indexes for teams that handle NULL league_id
CREATE UNIQUE INDEX IF NOT EXISTS teams_sport_provider_key_null_league 
ON teams (sport_id, provider_team_key) 
WHERE league_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS teams_sport_provider_key_with_league 
ON teams (sport_id, league_id, provider_team_key) 
WHERE league_id IS NOT NULL;

-- Fix matchup_games unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS matchup_games_unique_null_league
ON matchup_games (sport_id, team_low_id, team_high_id, game_id)
WHERE league_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS matchup_games_unique_with_league
ON matchup_games (sport_id, league_id, team_low_id, team_high_id, game_id)
WHERE league_id IS NOT NULL;

-- Fix matchup_stats unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS matchup_stats_unique_null_league
ON matchup_stats (sport_id, team_low_id, team_high_id)
WHERE league_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS matchup_stats_unique_with_league
ON matchup_stats (sport_id, league_id, team_low_id, team_high_id)
WHERE league_id IS NOT NULL;

-- Fix games unique constraint similarly
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_sport_id_league_id_provider_game_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS games_unique_null_league
ON games (sport_id, provider_game_key)
WHERE league_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS games_unique_with_league
ON games (sport_id, league_id, provider_game_key)
WHERE league_id IS NOT NULL;