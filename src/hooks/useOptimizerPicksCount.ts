import { useMemo } from "react";
import { toZonedTime } from "date-fns-tz";
import { useTodayGames, TodayGame } from "@/hooks/useApi";

interface AlternateLine {
  point: number;
  over_price: number;
  under_price: number;
}

const ET_TIMEZONE = 'America/New_York';

function getTodayInET(): Date {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  return new Date(etDate.getFullYear(), etDate.getMonth(), etDate.getDate());
}

export function useOptimizerPicksCount(tolerance: number = 1, minSampleSize: number = 5) {
  const today = useMemo(() => getTodayInET(), []);

  // Fetch games for all sports
  const { data: nflData } = useTodayGames(today, "nfl");
  const { data: nbaData } = useTodayGames(today, "nba");
  const { data: mlbData } = useTodayGames(today, "mlb");
  const { data: nhlData } = useTodayGames(today, "nhl");

  const count = useMemo(() => {
    const allGames: TodayGame[] = [
      ...(nflData?.games || []),
      ...(nbaData?.games || []),
      ...(mlbData?.games || []),
      ...(nhlData?.games || []),
    ];

    const seenGames = new Set<string>();
    let matchCount = 0;

    allGames
      .filter(game => {
        if (game.status === "final") return false;
        if (game.n_h2h < minSampleSize) return false;
        if (!game.alternate_lines || !Array.isArray(game.alternate_lines)) return false;
        if (game.p05 === null || game.p95 === null) return false;
        return true;
      })
      .forEach(game => {
        if (seenGames.has(game.game_id)) return;
        
        const alternateLines = game.alternate_lines as AlternateLine[];
        const p05 = game.p05!;
        const p95 = game.p95!;

        // Check if any line matches p95 or p05
        const hasMatch = alternateLines.some(line => {
          const distanceToP95 = Math.abs(line.point - p95);
          const distanceToP05 = Math.abs(line.point - p05);
          return distanceToP95 <= tolerance || distanceToP05 <= tolerance;
        });

        if (hasMatch) {
          seenGames.add(game.game_id);
          matchCount++;
        }
      });

    return matchCount;
  }, [nflData, nbaData, mlbData, nhlData, tolerance, minSampleSize]);

  return count;
}
