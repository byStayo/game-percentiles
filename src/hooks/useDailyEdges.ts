import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { SportId, DailyEdge, Game, Team } from "@/types";

interface DailyEdgeWithRelations extends DailyEdge {
  game: Game & {
    home_team: Team;
    away_team: Team;
  };
}

export function useDailyEdges(date: Date, sportId: SportId) {
  const dateString = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['daily-edges', dateString, sportId],
    queryFn: async (): Promise<DailyEdgeWithRelations[]> => {
      const { data, error } = await supabase
        .from('daily_edges')
        .select(`
          *,
          game:games!inner(
            *,
            home_team:teams!games_home_team_id_fkey(*),
            away_team:teams!games_away_team_id_fkey(*)
          )
        `)
        .eq('date_local', dateString)
        .eq('sport_id', sportId)
        .gte('n_h2h', 5)
        .order('game(start_time_utc)', { ascending: true });

      if (error) throw error;
      
      return (data || []) as unknown as DailyEdgeWithRelations[];
    },
    staleTime: 30000,
  });
}

export function useSports() {
  return useQuery({
    queryKey: ['sports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sports')
        .select('*')
        .order('id');

      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });
}
