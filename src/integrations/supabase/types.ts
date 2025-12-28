export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      daily_edges: {
        Row: {
          alternate_lines: Json | null
          best_over_edge: number | null
          best_under_edge: number | null
          date_local: string
          dk_line_percentile: number | null
          dk_offered: boolean
          dk_total_line: number | null
          franchise_matchup_id: string | null
          game_id: string
          id: string
          is_visible: boolean
          league_id: string | null
          n_h2h: number
          n_used: number | null
          p05: number | null
          p05_under_line: number | null
          p05_under_odds: number | null
          p95: number | null
          p95_over_line: number | null
          p95_over_odds: number | null
          segment_used: string | null
          sport_id: string
          updated_at: string
        }
        Insert: {
          alternate_lines?: Json | null
          best_over_edge?: number | null
          best_under_edge?: number | null
          date_local: string
          dk_line_percentile?: number | null
          dk_offered?: boolean
          dk_total_line?: number | null
          franchise_matchup_id?: string | null
          game_id: string
          id?: string
          is_visible?: boolean
          league_id?: string | null
          n_h2h?: number
          n_used?: number | null
          p05?: number | null
          p05_under_line?: number | null
          p05_under_odds?: number | null
          p95?: number | null
          p95_over_line?: number | null
          p95_over_odds?: number | null
          segment_used?: string | null
          sport_id: string
          updated_at?: string
        }
        Update: {
          alternate_lines?: Json | null
          best_over_edge?: number | null
          best_under_edge?: number | null
          date_local?: string
          dk_line_percentile?: number | null
          dk_offered?: boolean
          dk_total_line?: number | null
          franchise_matchup_id?: string | null
          game_id?: string
          id?: string
          is_visible?: boolean
          league_id?: string | null
          n_h2h?: number
          n_used?: number | null
          p05?: number | null
          p05_under_line?: number | null
          p05_under_odds?: number | null
          p95?: number | null
          p95_over_line?: number | null
          p95_over_odds?: number | null
          segment_used?: string | null
          sport_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_edges_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_edges_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_edges_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      franchises: {
        Row: {
          canonical_name: string
          created_at: string
          founded_year: number | null
          id: string
          league_id: string | null
          notes: string | null
          sport_id: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          founded_year?: number | null
          id?: string
          league_id?: string | null
          notes?: string | null
          sport_id: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          founded_year?: number | null
          id?: string
          league_id?: string | null
          notes?: string | null
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchises_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "franchises_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      game_eras: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          era_name: string
          id: string
          sport_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          era_name: string
          id?: string
          sport_id: string
          start_date: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          era_name?: string
          id?: string
          sport_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_eras_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          away_franchise_id: string | null
          away_score: number | null
          away_team_id: string
          decade: string | null
          final_total: number | null
          home_franchise_id: string | null
          home_score: number | null
          home_team_id: string
          id: string
          is_playoff: boolean | null
          last_seen_at: string
          league_id: string | null
          provider_game_key: string
          season_year: number | null
          sport_id: string
          start_time_utc: string
          status: string
          week_round: number | null
        }
        Insert: {
          away_franchise_id?: string | null
          away_score?: number | null
          away_team_id: string
          decade?: string | null
          final_total?: number | null
          home_franchise_id?: string | null
          home_score?: number | null
          home_team_id: string
          id?: string
          is_playoff?: boolean | null
          last_seen_at?: string
          league_id?: string | null
          provider_game_key: string
          season_year?: number | null
          sport_id: string
          start_time_utc: string
          status?: string
          week_round?: number | null
        }
        Update: {
          away_franchise_id?: string | null
          away_score?: number | null
          away_team_id?: string
          decade?: string | null
          final_total?: number | null
          home_franchise_id?: string | null
          home_score?: number | null
          home_team_id?: string
          id?: string
          is_playoff?: boolean | null
          last_seen_at?: string
          league_id?: string | null
          provider_game_key?: string
          season_year?: number | null
          sport_id?: string
          start_time_utc?: string
          status?: string
          week_round?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_away_franchise_id_fkey"
            columns: ["away_franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_home_franchise_id_fkey"
            columns: ["home_franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          details: Json | null
          finished_at: string | null
          id: number
          job_name: string
          started_at: string
          status: string
        }
        Insert: {
          details?: Json | null
          finished_at?: string | null
          id?: number
          job_name: string
          started_at?: string
          status?: string
        }
        Update: {
          details?: Json | null
          finished_at?: string | null
          id?: number
          job_name?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      leagues: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_enabled: boolean
          provider_league_key: string
          sport_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_enabled?: boolean
          provider_league_key: string
          sport_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_enabled?: boolean
          provider_league_key?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      lock_parlay_history: {
        Row: {
          combined_probability: number | null
          created_at: string
          id: string
          is_complete: boolean | null
          is_win: boolean | null
          legs: Json
          legs_hit: number | null
          legs_pending: number | null
          num_legs: number
        }
        Insert: {
          combined_probability?: number | null
          created_at?: string
          id?: string
          is_complete?: boolean | null
          is_win?: boolean | null
          legs?: Json
          legs_hit?: number | null
          legs_pending?: number | null
          num_legs: number
        }
        Update: {
          combined_probability?: number | null
          created_at?: string
          id?: string
          is_complete?: boolean | null
          is_win?: boolean | null
          legs?: Json
          legs_hit?: number | null
          legs_pending?: number | null
          num_legs?: number
        }
        Relationships: []
      }
      matchup_games: {
        Row: {
          decade: string | null
          franchise_high_id: string | null
          franchise_low_id: string | null
          game_id: string
          id: number
          league_id: string | null
          played_at_utc: string
          season_year: number | null
          sport_id: string
          team_high_id: string
          team_low_id: string
          team_version_high_id: string | null
          team_version_low_id: string | null
          total: number
        }
        Insert: {
          decade?: string | null
          franchise_high_id?: string | null
          franchise_low_id?: string | null
          game_id: string
          id?: number
          league_id?: string | null
          played_at_utc: string
          season_year?: number | null
          sport_id: string
          team_high_id: string
          team_low_id: string
          team_version_high_id?: string | null
          team_version_low_id?: string | null
          total: number
        }
        Update: {
          decade?: string | null
          franchise_high_id?: string | null
          franchise_low_id?: string | null
          game_id?: string
          id?: number
          league_id?: string | null
          played_at_utc?: string
          season_year?: number | null
          sport_id?: string
          team_high_id?: string
          team_low_id?: string
          team_version_high_id?: string | null
          team_version_low_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "matchup_games_franchise_high_id_fkey"
            columns: ["franchise_high_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_games_franchise_low_id_fkey"
            columns: ["franchise_low_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_games_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_games_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_games_team_high_id_fkey"
            columns: ["team_high_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_games_team_low_id_fkey"
            columns: ["team_low_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_games_team_version_high_id_fkey"
            columns: ["team_version_high_id"]
            isOneToOne: false
            referencedRelation: "team_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_games_team_version_low_id_fkey"
            columns: ["team_version_low_id"]
            isOneToOne: false
            referencedRelation: "team_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      matchup_stats: {
        Row: {
          franchise_high_id: string | null
          franchise_low_id: string | null
          id: number
          league_id: string | null
          max_total: number | null
          median: number | null
          min_total: number | null
          n_games: number
          p05: number | null
          p95: number | null
          segment_key: string | null
          sport_id: string
          team_high_id: string
          team_low_id: string
          updated_at: string
        }
        Insert: {
          franchise_high_id?: string | null
          franchise_low_id?: string | null
          id?: number
          league_id?: string | null
          max_total?: number | null
          median?: number | null
          min_total?: number | null
          n_games?: number
          p05?: number | null
          p95?: number | null
          segment_key?: string | null
          sport_id: string
          team_high_id: string
          team_low_id: string
          updated_at?: string
        }
        Update: {
          franchise_high_id?: string | null
          franchise_low_id?: string | null
          id?: number
          league_id?: string | null
          max_total?: number | null
          median?: number | null
          min_total?: number | null
          n_games?: number
          p05?: number | null
          p95?: number | null
          segment_key?: string | null
          sport_id?: string
          team_high_id?: string
          team_low_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchup_stats_franchise_high_id_fkey"
            columns: ["franchise_high_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_stats_franchise_low_id_fkey"
            columns: ["franchise_low_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_stats_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_stats_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_stats_team_high_id_fkey"
            columns: ["team_high_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_stats_team_low_id_fkey"
            columns: ["team_low_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      odds_event_map: {
        Row: {
          confidence: number
          game_id: string
          id: string
          matched_at: string
          odds_event_id: string
          odds_sport_key: string
        }
        Insert: {
          confidence?: number
          game_id: string
          id?: string
          matched_at?: string
          odds_event_id: string
          odds_sport_key: string
        }
        Update: {
          confidence?: number
          game_id?: string
          id?: string
          matched_at?: string
          odds_event_id?: string
          odds_sport_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "odds_event_map_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      odds_snapshots: {
        Row: {
          bookmaker: string
          fetched_at: string
          game_id: string
          id: number
          market: string
          raw_payload: Json | null
          total_line: number | null
        }
        Insert: {
          bookmaker?: string
          fetched_at?: string
          game_id: string
          id?: number
          market?: string
          raw_payload?: Json | null
          total_line?: number | null
        }
        Update: {
          bookmaker?: string
          fetched_at?: string
          game_id?: string
          id?: number
          market?: string
          raw_payload?: Json | null
          total_line?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "odds_snapshots_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_raw: {
        Row: {
          endpoint: string
          fetched_at: string
          id: number
          params_hash: string
          payload_json: Json
          provider: string
          season_year: number | null
          sport_id: string
        }
        Insert: {
          endpoint: string
          fetched_at?: string
          id?: never
          params_hash: string
          payload_json: Json
          provider?: string
          season_year?: number | null
          sport_id: string
        }
        Update: {
          endpoint?: string
          fetched_at?: string
          id?: never
          params_hash?: string
          payload_json?: Json
          provider?: string
          season_year?: number | null
          sport_id?: string
        }
        Relationships: []
      }
      roster_snapshots: {
        Row: {
          continuity_score: number | null
          created_at: string
          era_tag: string | null
          id: string
          key_players: Json | null
          notes: string | null
          season_year: number
          sport_id: string
          team_id: string
        }
        Insert: {
          continuity_score?: number | null
          created_at?: string
          era_tag?: string | null
          id?: string
          key_players?: Json | null
          notes?: string | null
          season_year: number
          sport_id: string
          team_id: string
        }
        Update: {
          continuity_score?: number | null
          created_at?: string
          era_tag?: string | null
          id?: string
          key_players?: Json | null
          notes?: string | null
          season_year?: number
          sport_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_snapshots_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string | null
          games_count: number | null
          id: string
          is_complete: boolean | null
          league_id: string | null
          provider_season_key: string | null
          season_year: number
          sport_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          games_count?: number | null
          id?: string
          is_complete?: boolean | null
          league_id?: string | null
          provider_season_key?: string | null
          season_year: number
          sport_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          games_count?: number | null
          id?: string
          is_complete?: boolean | null
          league_id?: string | null
          provider_season_key?: string | null
          season_year?: number
          sport_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          display_name: string
          id: string
        }
        Insert: {
          display_name: string
          id: string
        }
        Update: {
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      team_seasons: {
        Row: {
          conference: string | null
          created_at: string
          division: string | null
          id: string
          losses: number | null
          opp_ppg_avg: number | null
          playoff_result: string | null
          ppg_avg: number | null
          season_year: number
          sport_id: string
          team_id: string
          updated_at: string
          wins: number | null
        }
        Insert: {
          conference?: string | null
          created_at?: string
          division?: string | null
          id?: string
          losses?: number | null
          opp_ppg_avg?: number | null
          playoff_result?: string | null
          ppg_avg?: number | null
          season_year: number
          sport_id: string
          team_id: string
          updated_at?: string
          wins?: number | null
        }
        Update: {
          conference?: string | null
          created_at?: string
          division?: string | null
          id?: string
          losses?: number | null
          opp_ppg_avg?: number | null
          playoff_result?: string | null
          ppg_avg?: number | null
          season_year?: number
          sport_id?: string
          team_id?: string
          updated_at?: string
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_seasons_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_seasons_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_version_map: {
        Row: {
          created_at: string
          franchise_id: string
          id: string
          league_id: string | null
          provider: string
          provider_team_key: string
          sport_id: string
          team_id: string | null
          team_version_id: string
        }
        Insert: {
          created_at?: string
          franchise_id: string
          id?: string
          league_id?: string | null
          provider?: string
          provider_team_key: string
          sport_id: string
          team_id?: string | null
          team_version_id: string
        }
        Update: {
          created_at?: string
          franchise_id?: string
          id?: string
          league_id?: string | null
          provider?: string
          provider_team_key?: string
          sport_id?: string
          team_id?: string | null
          team_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_version_map_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_version_map_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_version_map_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_version_map_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_version_map_team_version_id_fkey"
            columns: ["team_version_id"]
            isOneToOne: false
            referencedRelation: "team_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_versions: {
        Row: {
          abbrev: string | null
          city: string | null
          created_at: string
          display_name: string
          effective_from: string
          effective_to: string | null
          franchise_id: string
          id: string
          league_id: string | null
          notes: string | null
          sport_id: string
        }
        Insert: {
          abbrev?: string | null
          city?: string | null
          created_at?: string
          display_name: string
          effective_from: string
          effective_to?: string | null
          franchise_id: string
          id?: string
          league_id?: string | null
          notes?: string | null
          sport_id: string
        }
        Update: {
          abbrev?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          effective_from?: string
          effective_to?: string | null
          franchise_id?: string
          id?: string
          league_id?: string | null
          notes?: string | null
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_versions_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_versions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_versions_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          abbrev: string | null
          city: string | null
          created_at: string
          id: string
          league_id: string | null
          name: string
          provider_team_key: string
          sport_id: string
        }
        Insert: {
          abbrev?: string | null
          city?: string | null
          created_at?: string
          id?: string
          league_id?: string | null
          name: string
          provider_team_key: string
          sport_id: string
        }
        Update: {
          abbrev?: string | null
          city?: string | null
          created_at?: string
          id?: string
          league_id?: string | null
          name?: string
          provider_team_key?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      franchise_matchups: {
        Row: {
          first_game: string | null
          franchise_high_id: string | null
          franchise_high_name: string | null
          franchise_low_id: string | null
          franchise_low_name: string | null
          games_10y: number | null
          games_20y: number | null
          last_game: string | null
          sport_id: string | null
          total_games: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matchup_games_franchise_high_id_fkey"
            columns: ["franchise_high_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_games_franchise_low_id_fkey"
            columns: ["franchise_low_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_games_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
