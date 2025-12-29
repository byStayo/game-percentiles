-- Add unique constraint on game_id to prevent duplicate matchup_games entries
ALTER TABLE public.matchup_games 
ADD CONSTRAINT matchup_games_game_id_unique UNIQUE (game_id);