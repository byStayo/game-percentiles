import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { SportTabs } from "@/components/ui/sport-tabs";
import { DatePickerInline } from "@/components/ui/date-picker-inline";
import { GameCard } from "@/components/game/GameCard";
import { EmptyState } from "@/components/game/EmptyState";
import { useDailyEdges, useSports } from "@/hooks/useDailyEdges";
import { Skeleton } from "@/components/ui/skeleton";
import type { SportId } from "@/types";

const defaultSports = [
  { id: 'nfl' as SportId, display_name: 'NFL' },
  { id: 'nba' as SportId, display_name: 'NBA' },
  { id: 'mlb' as SportId, display_name: 'MLB' },
  { id: 'nhl' as SportId, display_name: 'NHL' },
  { id: 'soccer' as SportId, display_name: 'Soccer' },
];

export default function Index() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSport, setSelectedSport] = useState<SportId>('nfl');
  
  const { data: sports } = useSports();
  const { data: edges, isLoading } = useDailyEdges(selectedDate, selectedSport);

  const displaySports = (sports as Array<{ id: SportId; display_name: string }>) || defaultSports;

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
              <h1 className="text-3xl font-bold tracking-tight">Today's Games</h1>
              <p className="text-muted-foreground mt-1">
                Historical H2H totals analysis with percentile bounds
              </p>
            </div>

            {/* Date picker */}
            <DatePickerInline
              date={selectedDate}
              onDateChange={setSelectedDate}
            />

            {/* Sport tabs */}
            <SportTabs
              sports={displaySports}
              activeSport={selectedSport}
              onSportChange={setSelectedSport}
            />
          </div>

          {/* Games grid */}
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-[200px] rounded-lg" />
              ))}
            </div>
          ) : edges && edges.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {edges.map((edge) => (
                <GameCard
                  key={edge.id}
                  edge={edge}
                  game={edge.game}
                  homeTeam={edge.game.home_team}
                  awayTeam={edge.game.away_team}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No games with sufficient H2H data"
              description={`No ${selectedSport.toUpperCase()} games found for this date with at least 5 historical head-to-head matchups.`}
            />
          )}
        </div>
      </Layout>
    </>
  );
}
