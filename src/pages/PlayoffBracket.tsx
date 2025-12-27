import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Trophy, Crown, Medal, Calendar, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SportId } from "@/types";

interface PlayoffTeam {
  team_id: string;
  team_name: string;
  team_abbrev: string | null;
  team_city: string | null;
  season_year: number;
  playoff_result: string;
  wins: number;
  losses: number;
}

const sportLabels: Record<SportId, string> = {
  nfl: 'NFL',
  nba: 'NBA',
  mlb: 'MLB',
  nhl: 'NHL',
};

const sportColors: Record<SportId, { bg: string; text: string; border: string }> = {
  nfl: { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/30' },
  nba: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30' },
  mlb: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
  nhl: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/30' },
};

// Bracket round order by sport
const bracketRounds: Record<SportId, string[]> = {
  nba: ['Champion', 'Finals', 'Conf Finals', 'Semis', 'First Round'],
  nfl: ['Champion', 'Super Bowl', 'Conf Champ', 'Div Round', 'Wild Card'],
  mlb: ['Champion', 'World Series', 'LCS', 'LDS', 'Wild Card'],
  nhl: ['Champion', 'Stanley Cup', 'Conf Final', 'Second Round', 'First Round'],
};

// Map playoff_result to display names
const roundDisplayNames: Record<string, string> = {
  'Champion': '🏆 Champion',
  'Finals': 'Finals',
  'Super Bowl': 'Super Bowl',
  'World Series': 'World Series',
  'Stanley Cup': 'Stanley Cup Finals',
  'Conf Finals': 'Conference Finals',
  'Conf Champ': 'Conference Championship',
  'Conf Final': 'Conference Finals',
  'LCS': 'League Championship Series',
  'Semis': 'Conference Semifinals',
  'Div Round': 'Divisional Round',
  'LDS': 'League Division Series',
  'Second Round': 'Second Round',
  'First Round': 'First Round',
  'Wild Card': 'Wild Card',
};

function getTeamsInRound(teams: PlayoffTeam[], roundName: string): PlayoffTeam[] {
  return teams.filter(t => {
    // For champion, match exactly
    if (roundName === 'Champion') {
      return t.playoff_result === 'Champion';
    }
    // For other rounds, check if the result includes the round name
    return t.playoff_result?.includes(roundName);
  });
}

function BracketRound({ 
  teams, 
  roundName, 
  isChampion,
  sportId,
  isLeft 
}: { 
  teams: PlayoffTeam[];
  roundName: string;
  isChampion: boolean;
  sportId: SportId;
  isLeft?: boolean;
}) {
  const displayName = roundDisplayNames[roundName] || roundName;
  const colors = sportColors[sportId];
  
  if (teams.length === 0) return null;

  return (
    <div className={cn(
      "flex flex-col gap-4",
      isChampion ? "items-center" : isLeft ? "items-start" : "items-end"
    )}>
      <div className={cn(
        "text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full",
        colors.bg,
        colors.text
      )}>
        {displayName}
      </div>
      <div className="flex flex-col gap-2">
        {teams.map((team) => (
          <Link
            key={team.team_id}
            to={`/team/${team.team_id}`}
            className={cn(
              "group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:scale-102",
              isChampion 
                ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/50 shadow-lg shadow-amber-500/10" 
                : "bg-card border-border/60 hover:border-primary/40 hover:bg-muted/30"
            )}
          >
            {isChampion && <Trophy className="h-5 w-5 text-amber-500" />}
            <div className={cn("text-left", !isLeft && !isChampion && "text-right")}>
              <div className={cn(
                "font-bold",
                isChampion ? "text-lg" : "text-sm"
              )}>
                {team.team_city} {team.team_name}
              </div>
              <div className="text-xs text-muted-foreground">
                {team.wins}-{team.losses}
              </div>
            </div>
            {!isChampion && (
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function PlayoffBracketView({ teams, sportId, year }: { teams: PlayoffTeam[]; sportId: SportId; year: number }) {
  const rounds = bracketRounds[sportId];
  const colors = sportColors[sportId];
  
  // Find champion
  const champion = teams.find(t => t.playoff_result === 'Champion');
  
  // Get teams for each round
  const roundTeams = useMemo(() => {
    const result: Record<string, PlayoffTeam[]> = {};
    rounds.forEach(round => {
      result[round] = getTeamsInRound(teams, round);
    });
    return result;
  }, [teams, rounds]);

  // Split rounds for left/right sides (excluding champion)
  const nonChampionRounds = rounds.filter(r => r !== 'Champion');
  const leftRounds = nonChampionRounds.slice(0, Math.ceil(nonChampionRounds.length / 2)).reverse();
  const rightRounds = nonChampionRounds.slice(Math.ceil(nonChampionRounds.length / 2)).reverse();

  return (
    <div className="space-y-8">
      {/* Champion Banner */}
      {champion && (
        <div className="text-center">
          <div className={cn(
            "inline-flex flex-col items-center gap-4 p-8 rounded-2xl border-2",
            "bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-amber-500/10",
            "border-amber-500/30 shadow-xl shadow-amber-500/5"
          )}>
            <div className="relative">
              <Crown className="h-12 w-12 text-amber-500" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full animate-pulse" />
            </div>
            <div>
              <div className="text-sm text-amber-500 font-semibold uppercase tracking-wide mb-1">
                {year} {sportLabels[sportId]} Champion
              </div>
              <Link 
                to={`/team/${champion.team_id}`}
                className="text-3xl font-bold hover:text-primary transition-colors"
              >
                {champion.team_city} {champion.team_name}
              </Link>
              <div className="text-muted-foreground mt-1">
                {champion.wins}-{champion.losses} Regular Season
              </div>
            </div>
            <Trophy className="h-8 w-8 text-amber-400" />
          </div>
        </div>
      )}

      {/* Bracket Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Left Side - Early Rounds */}
        <div className="space-y-6">
          {leftRounds.map(round => (
            <BracketRound
              key={round}
              teams={roundTeams[round] || []}
              roundName={round}
              isChampion={false}
              sportId={sportId}
              isLeft={true}
            />
          ))}
        </div>

        {/* Center - Finals */}
        <div className="flex flex-col items-center justify-center space-y-6">
          {rounds.filter(r => r.includes('Finals') || r.includes('Super Bowl') || r.includes('World Series') || r.includes('Stanley Cup')).map(round => (
            <BracketRound
              key={round}
              teams={roundTeams[round] || []}
              roundName={round}
              isChampion={false}
              sportId={sportId}
            />
          ))}
        </div>

        {/* Right Side - Early Rounds */}
        <div className="space-y-6 flex flex-col items-end">
          {rightRounds.map(round => (
            <BracketRound
              key={round}
              teams={roundTeams[round] || []}
              roundName={round}
              isChampion={false}
              sportId={sportId}
              isLeft={false}
            />
          ))}
        </div>
      </div>

      {/* All Playoff Teams List */}
      <Card className="bg-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Medal className="h-5 w-5 text-primary" />
            All Playoff Teams - {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {teams.sort((a, b) => {
              // Sort by round importance
              const aIdx = rounds.indexOf(a.playoff_result?.split(' ')[0] || '');
              const bIdx = rounds.indexOf(b.playoff_result?.split(' ')[0] || '');
              return aIdx - bIdx;
            }).map((team) => (
              <Link
                key={team.team_id}
                to={`/team/${team.team_id}`}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-muted/30",
                  team.playoff_result === 'Champion' 
                    ? "bg-amber-500/10 border-amber-500/30" 
                    : "bg-card border-border/40"
                )}
              >
                {team.playoff_result === 'Champion' && <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{team.team_city} {team.team_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{team.wins}-{team.losses}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px]",
                      colors.bg,
                      colors.text
                    )}>
                      {team.playoff_result}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          {teams.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No playoff data available for {year}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlayoffBracket() {
  const [sportFilter, setSportFilter] = useState<SportId>('nba');
  const [yearFilter, setYearFilter] = useState<number | 'latest'>('latest');

  const { data: playoffData, isLoading } = useQuery({
    queryKey: ['playoff-teams', sportFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_seasons')
        .select(`
          id,
          team_id,
          season_year,
          wins,
          losses,
          playoff_result,
          teams!inner(name, abbrev, city)
        `)
        .eq('sport_id', sportFilter)
        .not('playoff_result', 'is', null)
        .order('season_year', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        team_id: row.team_id,
        team_name: row.teams.name,
        team_abbrev: row.teams.abbrev,
        team_city: row.teams.city,
        season_year: row.season_year,
        playoff_result: row.playoff_result,
        wins: row.wins,
        losses: row.losses,
      })) as PlayoffTeam[];
    },
    staleTime: 60000,
  });

  // Get available years
  const availableYears = useMemo(() => {
    if (!playoffData) return [];
    const years = [...new Set(playoffData.map(p => p.season_year))];
    return years.sort((a, b) => b - a);
  }, [playoffData]);

  // Get current year
  const currentYear = useMemo(() => {
    if (yearFilter === 'latest' && availableYears.length > 0) {
      return availableYears[0];
    }
    return yearFilter === 'latest' ? new Date().getFullYear() : yearFilter;
  }, [yearFilter, availableYears]);

  // Filter to current year
  const currentYearTeams = useMemo(() => {
    if (!playoffData) return [];
    return playoffData.filter(p => p.season_year === currentYear);
  }, [playoffData, currentYear]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <Trophy className="h-6 w-6 text-amber-500" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-3">
            Playoff Bracket
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tournament progression and playoff results
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          {/* Sport Filter */}
          <div className="flex items-center gap-2 bg-card rounded-xl p-1.5 border border-border/60">
            <Trophy className="h-4 w-4 text-muted-foreground ml-2" />
            {(['nba', 'nfl', 'nhl', 'mlb'] as SportId[]).map(sport => (
              <button
                key={sport}
                onClick={() => setSportFilter(sport)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium uppercase transition-all",
                  sportFilter === sport
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {sport}
              </button>
            ))}
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2 bg-card rounded-xl p-1.5 border border-border/60">
            <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
            <Select
              value={yearFilter === 'latest' ? 'latest' : yearFilter.toString()}
              onValueChange={(v) => setYearFilter(v === 'latest' ? 'latest' : parseInt(v))}
            >
              <SelectTrigger className="w-28 h-8 border-0 bg-transparent">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Season Badge */}
        <div className="flex justify-center mb-8">
          <span className={cn(
            "px-4 py-2 rounded-full text-sm font-semibold",
            sportColors[sportFilter].bg,
            sportColors[sportFilter].text
          )}>
            {sportLabels[sportFilter]} {currentYear} Playoffs
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-xl mx-auto max-w-md" />
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          </div>
        ) : (
          <PlayoffBracketView 
            teams={currentYearTeams} 
            sportId={sportFilter} 
            year={currentYear} 
          />
        )}
      </div>
    </Layout>
  );
}
