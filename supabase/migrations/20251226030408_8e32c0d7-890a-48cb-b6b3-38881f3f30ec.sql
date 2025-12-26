-- Add new columns to provider_mappings
ALTER TABLE public.provider_mappings 
ADD COLUMN IF NOT EXISTS odds_sport_key text,
ADD COLUMN IF NOT EXISTS confidence numeric DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS method text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_provider_mappings_odds_sport_key ON public.provider_mappings(odds_sport_key);

-- Create odds_event_map table for event-level matching
CREATE TABLE public.odds_event_map (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  odds_sport_key text NOT NULL,
  odds_event_id text NOT NULL,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  confidence numeric NOT NULL DEFAULT 1.0,
  matched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(odds_sport_key, odds_event_id),
  UNIQUE(game_id)
);

-- Enable RLS
ALTER TABLE public.odds_event_map ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Public can read odds_event_map" 
ON public.odds_event_map 
FOR SELECT 
USING (true);

-- Service can manage
CREATE POLICY "Service can manage odds_event_map" 
ON public.odds_event_map 
FOR ALL 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_odds_event_map_odds_sport_key ON public.odds_event_map(odds_sport_key);
CREATE INDEX idx_odds_event_map_game_id ON public.odds_event_map(game_id);