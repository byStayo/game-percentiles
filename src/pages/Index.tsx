import { useState, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
];

type SortOption = 'time' | 'confidence' | 'edge';
type FilterOption = 'all' | 'high' | 'moderate' | 'limited';

export default function Index() {
  const [selectedDate, setSelectedDate] = useState(getTodayInET);
  const [selectedSport, setSelectedSport] = useState<SportId>('nfl');
  const [sortBy, setSortBy] = useState<SortOption>('time');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  
  const { data, isLoading, error, refetch } = useTodayGames(selectedDate, selectedSport);

  const games = data?.games || [];

  // Filter and sort games
  const filteredAndSortedGames = useMemo(() => {
    let result = [...games];
    
    // Apply filter
    if (filterBy === 'high') {
      result = result.filter(g => g.n_h2h >= 10);
    } else if (filterBy === 'moderate') {
      result = result.filter(g => g.n_h2h >= 5);
    } else if (filterBy === 'limited') {
      result = result.filter(g => g.n_h2h >= 2);
    }
    
    // Apply sort
    if (sortBy === 'time') {
      result.sort((a, b) => new Date(a.start_time_utc).getTime() - new Date(b.start_time_utc).getTime());
    } else if (sortBy === 'confidence') {
      result.sort((a, b) => b.n_h2h - a.n_h2h);
    } else if (sortBy === 'edge') {
      // Sort by how extreme the DK line is relative to percentiles (potential edge)
      result.sort((a, b) => {
        const aEdge = a.dk_line_percentile !== null ? Math.abs(50 - a.dk_line_percentile) : 0;
        const bEdge = b.dk_line_percentile !== null ? Math.abs(50 - b.dk_line_percentile) : 0;
        return bEdge - aEdge;
      });
    }
    
    return result;
  }, [games, filterBy, sortBy]);

  return (
    <>
      <Helmet>
        <title>Percentile Totals | H2H Historical Analysis</title>
        <meta name="description" content="Analyze head-to-head historical totals distribution for NFL, NBA, MLB, and NHL games. View P05/P95 percentile bounds and DraftKings line analysis." />
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

            {/* H2H Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-2.5">
              <span className="font-medium text-foreground">H2H Sample Size:</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-status-under/10 text-status-under">
                  n=10+
                </span>
                <span>High confidence</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-status-edge/10 text-status-edge">
                  n=5-9
                </span>
                <span>Moderate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-muted text-muted-foreground">
                  n=2-4
                </span>
                <span>Limited</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-status-over/10 text-status-over border border-status-over/20">
                  ⚠️ n=1
                </span>
                <span>Very limited</span>
              </div>
            </div>

            {/* Sort & Filter Controls */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort:</span>
                <div className="flex gap-1">
                  {[
                    { value: 'time', label: 'Time' },
                    { value: 'confidence', label: 'Confidence' },
                    { value: 'edge', label: 'Edge' },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant={sortBy === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortBy(option.value as SortOption)}
                      className="text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filter:</span>
                <div className="flex gap-1">
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'limited', label: 'n≥2' },
                    { value: 'moderate', label: 'n≥5' },
                    { value: 'high', label: 'n≥10' },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant={filterBy === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterBy(option.value as FilterOption)}
                      className="text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
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
          ) : filteredAndSortedGames.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedGames.map((game) => (
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
