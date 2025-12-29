import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlayerInjury {
  id: string;
  player_name: string;
  player_external_id: string;
  position: string | null;
  injury_status: string;
  injury_type: string | null;
  injury_details: string | null;
  team_id: string | null;
  sport_id: string;
}

export function useGameInjuries(
  homeTeamId: string | null | undefined,
  awayTeamId: string | null | undefined,
  sportId: string
) {
  return useQuery<{ home: PlayerInjury[]; away: PlayerInjury[] }>({
    queryKey: ["game-injuries", homeTeamId, awayTeamId, sportId],
    queryFn: async () => {
      if (!homeTeamId || !awayTeamId) {
        return { home: [], away: [] };
      }

      const { data, error } = await supabase
        .from("player_injuries")
        .select("*")
        .eq("sport_id", sportId)
        .in("team_id", [homeTeamId, awayTeamId]);

      if (error) {
        console.error("Failed to fetch injuries:", error);
        return { home: [], away: [] };
      }

      const injuries = data || [];
      
      return {
        home: injuries.filter(i => i.team_id === homeTeamId),
        away: injuries.filter(i => i.team_id === awayTeamId),
      };
    },
    enabled: !!homeTeamId && !!awayTeamId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
