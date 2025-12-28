import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { SportId } from "@/types";

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const ET_TIMEZONE = 'America/New_York';

function getTodayET(): string {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  return format(etDate, 'yyyy-MM-dd');
}

// Types for API responses
export interface TodayGame {
  id: string;
  game_id: string;
  date_local: string;
  sport_id: SportId;
  start_time_utc: string;
  status: string;
  home_team: { id: string; name: string; city: string | null; abbrev: string | null } | null;
  away_team: { id: string; name: string; city: string | null; abbrev: string | null } | null;
  home_score: number | null;
  away_score: number | null;
  final_total: number | null;
  n_h2h: number;
  p05: number | null;
  p95: number | null;
  dk_offered: boolean;
  dk_total_line: number | null;
  dk_line_percentile: number | null;
  segment_used?: string;
  n_used?: number;
  updated_at: string;
  // Edge detection data
  p95_over_line?: number | null;
  p95_over_odds?: number | null;
  p05_under_line?: number | null;
  p05_under_odds?: number | null;
  best_over_edge?: number | null;
  best_under_edge?: number | null;
  // DK line range (extremes of what's offered)
  dk_highest_over?: { line: number; odds: number } | null;
  dk_lowest_under?: { line: number; odds: number } | null;
}

export interface TodayResponse {
  success: boolean;
  date: string;
  total: number;
  games: TodayGame[];
  by_sport: Record<string, TodayGame[]>;
  error?: string;
}

export interface GameDetailResponse {
  success: boolean;
  game: {
    id: string;
    sport_id: SportId;
    start_time_utc: string;
    status: string;
    home_team: { id: string; name: string; city: string | null; abbrev: string | null } | null;
    away_team: { id: string; name: string; city: string | null; abbrev: string | null } | null;
    home_score: number | null;
    away_score: number | null;
    final_total: number | null;
  };
  edge: {
    n_h2h: number;
    p05: number | null;
    p95: number | null;
    is_visible: boolean;
    dk_offered: boolean;
    dk_total_line: number | null;
    dk_line_percentile: number | null;
    segment_used?: string;
    n_used?: number;
    // Edge detection data
    p95_over_line?: number | null;
    p95_over_odds?: number | null;
    p05_under_line?: number | null;
    p05_under_odds?: number | null;
    best_over_edge?: number | null;
    best_under_edge?: number | null;
    alternate_lines?: Array<{ point: number; over_price: number; under_price: number }> | null;
  } | null;
  stats: {
    n_games: number;
    p05: number | null;
    p95: number | null;
    median: number | null;
    min_total: number | null;
    max_total: number | null;
  } | null;
  segment: string;
  history: Array<{
    id: number;
    played_at: string;
    total: number;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
  }>;
  error?: string;
}

export interface StatusResponse {
  success: boolean;
  timestamp: string;
  date_et: string;
  jobs: Record<string, {
    id: number;
    status: string;
    started_at: string;
    finished_at: string | null;
    duration_ms: number | null;
    counters: Record<string, number> | null;
  }>;
  today_coverage: {
    total_games: number;
    visible_games: number;
    with_dk_odds: number;
    unmatched: number;
    by_sport: Record<string, { total: number; with_odds: number }>;
  };
  sample_unmatched: Array<string | { internal: string; internal_normalized?: string; odds?: Array<{ raw: string; normalized: string; time_diff_hrs: string }> }>;
  database: {
    teams: number;
    games: number;
    matchup_games: number;
  };
  mode: string;
  error?: string;
}

export interface CronJob {
  id: number;
  name: string;
  function: string;
  schedule: string;
  schedule_human: string;
  active: boolean;
  next_run: string | null;
  last_run: {
    status: string;
    started_at: string;
    ended_at: string;
    duration_ms: number | null;
  } | null;
  stats_24h: {
    success: number;
    failed: number;
    total: number;
  };
}

export interface CronStatusResponse {
  success: boolean;
  timestamp: string;
  jobs: CronJob[];
  recent_runs: Array<{
    job_name: string;
    function: string;
    status: string;
    started_at: string;
    duration_ms: number | null;
  }>;
  summary: {
    total_jobs: number;
    active_jobs: number;
    runs_24h: number;
    success_rate: number;
  };
  error?: string;
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

export function useTodayGames(date: Date, sportId: SportId) {
  const dateString = format(date, 'yyyy-MM-dd');

  return useQuery<TodayResponse>({
    queryKey: ['api-today', dateString, sportId],
    queryFn: () => fetchApi<TodayResponse>(`api-today?date=${dateString}&sport_id=${sportId}`),
    staleTime: 30000,
    retry: 2,
  });
}

export function useGameDetail(gameId: string, segment: string = 'h2h_all') {
  return useQuery<GameDetailResponse>({
    queryKey: ['api-game', gameId, segment],
    queryFn: () => fetchApi<GameDetailResponse>(`api-game?id=${gameId}&segment=${segment}`),
    enabled: !!gameId,
    staleTime: 30000,
    retry: 2,
  });
}

export function useSystemStatus() {
  return useQuery<StatusResponse>({
    queryKey: ['api-status'],
    queryFn: () => fetchApi<StatusResponse>('api-status'),
    staleTime: 60000,
    refetchInterval: 60000,
    retry: 2,
  });
}

export function useCronStatus() {
  return useQuery<CronStatusResponse>({
    queryKey: ['api-cron-status'],
    queryFn: () => fetchApi<CronStatusResponse>('api-cron-status'),
    staleTime: 60000,
    refetchInterval: 60000,
    retry: 2,
  });
}
