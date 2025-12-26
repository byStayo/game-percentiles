import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Layout } from "@/components/layout/Layout";
import { SportTabs } from "@/components/ui/sport-tabs";
import { DatePickerInline } from "@/components/ui/date-picker-inline";
import { GameCard } from "@/components/game/GameCardNew";
import { GameCardSkeleton } from "@/components/game/GameCardSkeleton";
import { EmptyState } from "@/components/game/EmptyState";
import { ErrorState } from "@/components/game/ErrorState";
import { useTodayGames } from "@/hooks/useApi";
import type { SportId } from "@/types";

const ET_TIMEZONE = 'America/New_York';

// Get today in ET timezone
function getTodayInET(): Date {
  const now = new Date();
  const etDate = toZonedTime(now, ET_TIMEZONE);
  // Return a date object set to today (start of day)
  return new Date(etDate.getFullYear(), etDate.getMonth(), etDate.getDate());
}

const sports = [
  { id: 'nfl' as SportId, display_name: 'NFL' },
  { id: 'nba' as SportId, display_name: 'NBA' },
  { id: 'mlb' as SportId, display_name: 'MLB' },
  { id: 'nhl' as SportId, display_name: 'NHL' },
  { id: 'soccer' as SportId, display_name: 'Soccer' },
];

export default function Index() {
  const [selectedDate, setSelectedDate] = useState(getTodayInET);
  const [selectedSport, setSelectedSport] = useState<SportId>('nfl'); // Default to NFL where we have data
  
  const { data, isLoading, error, refetch } = useTodayGames(selectedDate, selectedSport);

  const games = data?.games || [];

  // Sort games by start time
  const sortedGames = [...games].sort((a, b) => 
    new Date(a.start_time_utc).getTime() - new Date(b.start_time_utc).getTime()
  );

  return (
    <>
      <Helmet>
        <title>Percentile Totals | H2H Historical Analysis</title>
        <meta name="description" content="Analyze head-to-head historical totals distribution for NFL, NBA, MLB, NHL, and Soccer games. View P05/P95 percentile bounds and DraftKings line analysis." />
      </Helmet>

      <Layout>
        <div className="space-y-8 animate-fade-in">
          {/* Page header */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Percentile Totals</h1>
              <p className="text-muted-foreground mt-1">
                H2H historical analysis with percentile bounds
              </p>
            </div>

            {/* Date picker */}
            <DatePickerInline
              date={selectedDate}
              onDateChange={setSelectedDate}
            />

            {/* Sport tabs */}
            <SportTabs
              sports={sports}
              activeSport={selectedSport}
              onSportChange={setSelectedSport}
            />
          </div>

          {/* Games grid */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <GameCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              title="Unable to load games"
              description={error instanceof Error ? error.message : 'An error occurred while fetching games.'}
              onRetry={() => refetch()}
            />
          ) : sortedGames.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No games available"
              description={`No ${selectedSport.toUpperCase()} games with sufficient H2H history found for ${format(selectedDate, 'MMMM d, yyyy')}.`}
            />
          )}
        </div>
      </Layout>
    </>
  );
}
