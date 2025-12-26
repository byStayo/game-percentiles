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
          date_local: string
          dk_line_percentile: number | null
          dk_offered: boolean
          dk_total_line: number | null
          game_id: string
          id: string
          is_visible: boolean
          league_id: string | null
          n_h2h: number
          p05: number | null
          p95: number | null
          sport_id: string
          updated_at: string
        }
        Insert: {
          date_local: string
          dk_line_percentile?: number | null
          dk_offered?: boolean
          dk_total_line?: number | null
          game_id: string
          id?: string
          is_visible?: boolean
          league_id?: string | null
          n_h2h?: number
          p05?: number | null
          p95?: number | null
          sport_id: string
          updated_at?: string
        }
        Update: {
          date_local?: string
          dk_line_percentile?: number | null
          dk_offered?: boolean
          dk_total_line?: number | null
          game_id?: string
          id?: string
          is_visible?: boolean
          league_id?: string | null
          n_h2h?: number
          p05?: number | null
          p95?: number | null
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
      games: {
        Row: {
          away_score: number | null
          away_team_id: string
          final_total: number | null
          home_score: number | null
          home_team_id: string
          id: string
          last_seen_at: string
          league_id: string | null
          provider_game_key: string
          sport_id: string
          start_time_utc: string
          status: string
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          final_total?: number | null
          home_score?: number | null
          home_team_id: string
          id?: string
          last_seen_at?: string
          league_id?: string | null
          provider_game_key: string
          sport_id: string
          start_time_utc: string
          status?: string
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          final_total?: number | null
          home_score?: number | null
          home_team_id?: string
          id?: string
          last_seen_at?: string
          league_id?: string | null
          provider_game_key?: string
          sport_id?: string
          start_time_utc?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
      matchup_games: {
        Row: {
          game_id: string
          id: number
          league_id: string | null
          played_at_utc: string
          sport_id: string
          team_high_id: string
          team_low_id: string
          total: number
        }
        Insert: {
          game_id: string
          id?: number
          league_id?: string | null
          played_at_utc: string
          sport_id: string
          team_high_id: string
          team_low_id: string
          total: number
        }
        Update: {
          game_id?: string
          id?: number
          league_id?: string | null
          played_at_utc?: string
          sport_id?: string
          team_high_id?: string
          team_low_id?: string
          total?: number
        }
        Relationships: [
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
        ]
      }
      matchup_stats: {
        Row: {
          id: number
          league_id: string | null
          max_total: number | null
          median: number | null
          min_total: number | null
          n_games: number
          p05: number | null
          p95: number | null
          sport_id: string
          team_high_id: string
          team_low_id: string
          updated_at: string
        }
        Insert: {
          id?: number
          league_id?: string | null
          max_total?: number | null
          median?: number | null
          min_total?: number | null
          n_games?: number
          p05?: number | null
          p95?: number | null
          sport_id: string
          team_high_id: string
          team_low_id: string
          updated_at?: string
        }
        Update: {
          id?: number
          league_id?: string | null
          max_total?: number | null
          median?: number | null
          min_total?: number | null
          n_games?: number
          p05?: number | null
          p95?: number | null
          sport_id?: string
          team_high_id?: string
          team_low_id?: string
          updated_at?: string
        }
        Relationships: [
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
      [_ in never]: never
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
