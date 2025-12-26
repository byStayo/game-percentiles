export type SportId = 'nfl' | 'nba' | 'mlb' | 'nhl';

export interface Sport {
  id: SportId;
  display_name: string;
}

export interface League {
  id: string;
  sport_id: SportId;
  provider_league_key: string;
  display_name: string;
  is_enabled: boolean;
}

export interface Team {
  id: string;
  sport_id: SportId;
  league_id: string | null;
  provider_team_key: string;
  name: string;
  abbrev: string | null;
}

export interface Game {
  id: string;
  sport_id: SportId;
  league_id: string | null;
  provider_game_key: string;
  start_time_utc: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'live' | 'final';
  final_total: number | null;
  home_team?: Team;
  away_team?: Team;
}

export interface MatchupGame {
  id: number;
  sport_id: SportId;
  league_id: string | null;
  team_low_id: string;
  team_high_id: string;
  game_id: string;
  played_at_utc: string;
  total: number;
  game?: Game;
}

export interface MatchupStats {
  id: number;
  sport_id: SportId;
  league_id: string | null;
  team_low_id: string;
  team_high_id: string;
  n_games: number;
  p05: number | null;
  p95: number | null;
  median: number | null;
  min_total: number | null;
  max_total: number | null;
  updated_at: string;
}

export interface DailyEdge {
  id: string;
  date_local: string;
  sport_id: SportId;
  league_id: string | null;
  game_id: string;
  n_h2h: number;
  p05: number | null;
  p95: number | null;
  dk_offered: boolean;
  dk_total_line: number | null;
  dk_line_percentile: number | null;
  updated_at: string;
  game?: Game;
}

export interface JobRun {
  id: number;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'fail';
  details: Record<string, unknown> | null;
}

export interface ProviderMapping {
  id: number;
  sport_id: SportId;
  league_id: string | null;
  team_id: string;
  odds_api_team_name: string;
  last_verified_at: string | null;
  team?: Team;
}
