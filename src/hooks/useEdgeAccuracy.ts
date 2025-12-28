import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

export interface EdgeAccuracyStats {
  totalGames: number;
  overEdgeGames: number;
  overEdgeHits: number;
  underEdgeGames: number;
  underEdgeHits: number;
  beyondExtremesGames: number;
  beyondExtremesHits: number;
  overAccuracy: number;
  underAccuracy: number;
  totalAccuracy: number;
  beyondExtremesAccuracy: number;
  recentResults: EdgeResult[];
}

export interface EdgeResult {
  gameId: string;
  dateLocal: string;
  sportId: string;
  homeTeam: string;
  awayTeam: string;
  dkLine: number;
  finalTotal: number;
  p05: number;
  p95: number;
  edgeType: "over" | "under" | "both";
  result: "hit" | "miss" | "push";
  isBeyondExtremes: boolean;
}

export function useEdgeAccuracy(daysBack: number = 30) {
  return useQuery({
    queryKey: ["edge-accuracy", daysBack],
    queryFn: async (): Promise<EdgeAccuracyStats> => {
      const startDate = format(subDays(new Date(), daysBack), "yyyy-MM-dd");
      
      // Fetch daily_edges with their games that have final totals
      const { data: edges, error } = await supabase
        .from("daily_edges")
        .select(`
          id,
          game_id,
          sport_id,
          date_local,
          dk_total_line,
          p05,
          p95,
          p95_over_line,
          p05_under_line,
          best_over_edge,
          best_under_edge,
          n_h2h
        `)
        .gte("date_local", startDate)
        .gt("n_h2h", 4) // Only games with decent sample size
        .order("date_local", { ascending: false });

      if (error) throw error;

      // Fetch final games
      const gameIds = edges?.map(e => e.game_id) || [];
      if (gameIds.length === 0) {
        return {
          totalGames: 0,
          overEdgeGames: 0,
          overEdgeHits: 0,
          underEdgeGames: 0,
          underEdgeHits: 0,
          beyondExtremesGames: 0,
          beyondExtremesHits: 0,
          overAccuracy: 0,
          underAccuracy: 0,
          totalAccuracy: 0,
          beyondExtremesAccuracy: 0,
          recentResults: [],
        };
      }

      const { data: games, error: gamesError } = await supabase
        .from("games")
        .select("id, final_total, status, home_team_id, away_team_id")
        .in("id", gameIds)
        .eq("status", "final")
        .not("final_total", "is", null);

      if (gamesError) throw gamesError;

      // Get team names
      const teamIds = [...new Set(games?.flatMap(g => [g.home_team_id, g.away_team_id]) || [])];
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, abbrev")
        .in("id", teamIds);

      const teamMap = new Map(teams?.map(t => [t.id, t.name]) || []);
      const gameMap = new Map(games?.map(g => [g.id, g]) || []);

      let overEdgeGames = 0;
      let overEdgeHits = 0;
      let underEdgeGames = 0;
      let underEdgeHits = 0;
      let beyondExtremesGames = 0;
      let beyondExtremesHits = 0;
      const recentResults: EdgeResult[] = [];

      for (const edge of edges || []) {
        const game = gameMap.get(edge.game_id);
        if (!game || game.final_total === null) continue;

        const dkLine = edge.dk_total_line;
        const finalTotal = game.final_total;
        const p05 = edge.p05;
        const p95 = edge.p95;

        if (dkLine === null || p05 === null || p95 === null) continue;

        const hasOverEdge = edge.p95_over_line !== null && (edge.best_over_edge ?? 0) > 0;
        const hasUnderEdge = edge.p05_under_line !== null && (edge.best_under_edge ?? 0) > 0;
        const isBeyondExtremes = dkLine < p05 || dkLine > p95;

        if (!hasOverEdge && !hasUnderEdge) continue;

        // Determine the best edge pick
        const overEdge = edge.best_over_edge ?? 0;
        const underEdge = edge.best_under_edge ?? 0;
        const pickOver = overEdge > underEdge;
        const edgeType = hasOverEdge && hasUnderEdge ? "both" : hasOverEdge ? "over" : "under";

        // Check if pick hit
        let result: "hit" | "miss" | "push";
        if (pickOver) {
          if (finalTotal > dkLine) result = "hit";
          else if (finalTotal < dkLine) result = "miss";
          else result = "push";
          
          overEdgeGames++;
          if (result === "hit") overEdgeHits++;
        } else {
          if (finalTotal < dkLine) result = "hit";
          else if (finalTotal > dkLine) result = "miss";
          else result = "push";
          
          underEdgeGames++;
          if (result === "hit") underEdgeHits++;
        }

        if (isBeyondExtremes) {
          beyondExtremesGames++;
          if (result === "hit") beyondExtremesHits++;
        }

        // Add to recent results (limit to 20)
        if (recentResults.length < 20) {
          recentResults.push({
            gameId: edge.game_id,
            dateLocal: edge.date_local,
            sportId: edge.sport_id,
            homeTeam: teamMap.get(game.home_team_id) || "Unknown",
            awayTeam: teamMap.get(game.away_team_id) || "Unknown",
            dkLine,
            finalTotal,
            p05,
            p95,
            edgeType,
            result,
            isBeyondExtremes,
          });
        }
      }

      const totalGames = overEdgeGames + underEdgeGames;
      const totalHits = overEdgeHits + underEdgeHits;

      return {
        totalGames,
        overEdgeGames,
        overEdgeHits,
        underEdgeGames,
        underEdgeHits,
        beyondExtremesGames,
        beyondExtremesHits,
        overAccuracy: overEdgeGames > 0 ? (overEdgeHits / overEdgeGames) * 100 : 0,
        underAccuracy: underEdgeGames > 0 ? (underEdgeHits / underEdgeGames) * 100 : 0,
        totalAccuracy: totalGames > 0 ? (totalHits / totalGames) * 100 : 0,
        beyondExtremesAccuracy: beyondExtremesGames > 0 ? (beyondExtremesHits / beyondExtremesGames) * 100 : 0,
        recentResults,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
