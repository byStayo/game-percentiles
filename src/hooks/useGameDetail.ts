import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Game, Team, MatchupGame, MatchupStats, DailyEdge } from "@/types";

interface GameDetailData {
  game: Game & {
    home_team: Team;
    away_team: Team;
  };
  matchupStats: MatchupStats | null;
  matchupGames: (MatchupGame & { game: Game })[];
  dailyEdge: DailyEdge | null;
}

export function useGameDetail(gameId: string) {
  return useQuery({
    queryKey: ['game-detail', gameId],
    queryFn: async (): Promise<GameDetailData> => {
      // Fetch game with teams
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(*),
          away_team:teams!games_away_team_id_fkey(*)
        `)
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;

      const typedGame = game as unknown as Game & { home_team: Team; away_team: Team };

      // Determine team_low and team_high
      const [teamLowId, teamHighId] = [typedGame.home_team_id, typedGame.away_team_id].sort();

      // Fetch matchup stats
      const { data: matchupStats } = await supabase
        .from('matchup_stats')
        .select('*')
        .eq('sport_id', typedGame.sport_id)
        .eq('team_low_id', teamLowId)
        .eq('team_high_id', teamHighId)
        .maybeSingle();

      // Fetch recent H2H games
      const { data: matchupGames } = await supabase
        .from('matchup_games')
        .select(`
          *,
          game:games(*)
        `)
        .eq('sport_id', typedGame.sport_id)
        .eq('team_low_id', teamLowId)
        .eq('team_high_id', teamHighId)
        .order('played_at_utc', { ascending: false })
        .limit(20);

      // Fetch daily edge
      const { data: dailyEdge } = await supabase
        .from('daily_edges')
        .select('*')
        .eq('game_id', gameId)
        .maybeSingle();

      return {
        game: typedGame,
        matchupStats: matchupStats as MatchupStats | null,
        matchupGames: (matchupGames || []) as unknown as (MatchupGame & { game: Game })[],
        dailyEdge: dailyEdge as DailyEdge | null,
      };
    },
    enabled: !!gameId,
  });
}
