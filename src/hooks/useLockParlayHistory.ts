import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ParlayLeg {
  game_id: string;
  sport_id: string;
  pick: "over" | "under";
  line: number;
  hit_probability: number;
  home_team: string;
  away_team: string;
  result?: "hit" | "miss" | "pending";
  final_total?: number;
}

export interface ParlayLegInput {
  game_id: string;
  sport_id: string;
  pick: "over" | "under";
  line: number;
  hit_probability: number;
  home_team: string;
  away_team: string;
}

interface LockParlayRecord {
  id: string;
  created_at: string;
  num_legs: number;
  legs_hit: number;
  legs_pending: number;
  is_complete: boolean;
  is_win: boolean;
  combined_probability: number;
  legs: ParlayLeg[];
}

interface ParlayStats {
  totalParlays: number;
  completedParlays: number;
  wins: number;
  losses: number;
  winRate: number;
  totalLegs: number;
  legsHit: number;
  legHitRate: number;
  avgCombinedProbability: number;
  pendingParlays: number;
}

export function useLockParlayHistory() {
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useQuery({
    queryKey: ["lock-parlay-history"],
    queryFn: async (): Promise<LockParlayRecord[]> => {
      const { data, error } = await supabase
        .from("lock_parlay_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      return (data || []).map(row => ({
        ...row,
        legs: (row.legs as unknown as ParlayLeg[]) || [],
      }));
    },
  });

  const stats: ParlayStats = {
    totalParlays: history?.length || 0,
    completedParlays: history?.filter(p => p.is_complete).length || 0,
    wins: history?.filter(p => p.is_complete && p.is_win).length || 0,
    losses: history?.filter(p => p.is_complete && !p.is_win).length || 0,
    winRate: 0,
    totalLegs: history?.reduce((sum, p) => sum + p.num_legs, 0) || 0,
    legsHit: history?.reduce((sum, p) => sum + p.legs_hit, 0) || 0,
    legHitRate: 0,
    avgCombinedProbability: 0,
    pendingParlays: history?.filter(p => !p.is_complete).length || 0,
  };

  if (stats.completedParlays > 0) {
    stats.winRate = (stats.wins / stats.completedParlays) * 100;
  }
  
  const completedLegs = history?.reduce((sum, p) => 
    sum + p.legs.filter(l => l.result !== "pending").length, 0
  ) || 0;
  
  if (completedLegs > 0) {
    stats.legHitRate = (stats.legsHit / completedLegs) * 100;
  }

  if (history && history.length > 0) {
    stats.avgCombinedProbability = 
      history.reduce((sum, p) => sum + (p.combined_probability || 0), 0) / history.length;
  }

  const saveParlayMutation = useMutation({
    mutationFn: async (legs: ParlayLegInput[]) => {
      const combinedProb = legs.reduce((acc, leg) => 
        acc * (leg.hit_probability / 100), 1
      ) * 100;

      const { data, error } = await supabase
        .from("lock_parlay_history")
        .insert({
          num_legs: legs.length,
          legs_pending: legs.length,
          combined_probability: combinedProb,
          legs: legs.map(leg => ({
            ...leg,
            result: "pending",
          })),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lock-parlay-history"] });
    },
  });

  return {
    history,
    stats,
    isLoading,
    saveParlay: saveParlayMutation.mutate,
    isSaving: saveParlayMutation.isPending,
  };
}
