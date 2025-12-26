import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { SportTabs } from "@/components/ui/sport-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, X, Search, AlertTriangle } from "lucide-react";
import type { SportId, Team, ProviderMapping } from "@/types";

const defaultSports = [
  { id: 'nfl' as SportId, display_name: 'NFL' },
  { id: 'nba' as SportId, display_name: 'NBA' },
  { id: 'mlb' as SportId, display_name: 'MLB' },
  { id: 'nhl' as SportId, display_name: 'NHL' },
  { id: 'soccer' as SportId, display_name: 'Soccer' },
];

interface TeamWithMapping extends Team {
  mapping?: ProviderMapping;
}

export default function AdminMappings() {
  const [selectedSport, setSelectedSport] = useState<SportId>('nfl');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const queryClient = useQueryClient();

  // Fetch teams with their mappings
  const { data: teamsWithMappings, isLoading } = useQuery({
    queryKey: ['teams-with-mappings', selectedSport],
    queryFn: async (): Promise<TeamWithMapping[]> => {
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('sport_id', selectedSport)
        .order('name');

      if (teamsError) throw teamsError;

      const { data: mappings } = await supabase
        .from('provider_mappings')
        .select('*')
        .eq('sport_id', selectedSport);

      const mappingsMap = new Map(
        (mappings || []).map(m => [m.team_id, m])
      );

      return (teams || []).map(team => ({
        ...team,
        mapping: mappingsMap.get(team.id) as ProviderMapping | undefined,
      })) as TeamWithMapping[];
    },
  });

  // Mutation to save mapping
  const saveMappingMutation = useMutation({
    mutationFn: async ({ teamId, oddsApiName }: { teamId: string; oddsApiName: string }) => {
      const { error } = await supabase
        .from('provider_mappings')
        .upsert({
          sport_id: selectedSport,
          team_id: teamId,
          odds_api_team_name: oddsApiName,
          last_verified_at: new Date().toISOString(),
        }, { onConflict: 'sport_id,league_id,team_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-with-mappings'] });
      toast.success('Mapping saved');
      setEditingTeamId(null);
      setEditValue('');
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Mutation to delete mapping
  const deleteMappingMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase
        .from('provider_mappings')
        .delete()
        .eq('sport_id', selectedSport)
        .eq('team_id', teamId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-with-mappings'] });
      toast.success('Mapping deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const filteredTeams = teamsWithMappings?.filter(team =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.mapping?.odds_api_team_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unmappedCount = teamsWithMappings?.filter(t => !t.mapping).length || 0;
  const mappedCount = teamsWithMappings?.filter(t => t.mapping).length || 0;

  const startEdit = (team: TeamWithMapping) => {
    setEditingTeamId(team.id);
    setEditValue(team.mapping?.odds_api_team_name || team.name);
  };

  const saveEdit = (teamId: string) => {
    if (editValue.trim()) {
      saveMappingMutation.mutate({ teamId, oddsApiName: editValue.trim() });
    }
  };

  const cancelEdit = () => {
    setEditingTeamId(null);
    setEditValue('');
  };

  return (
    <>
      <Helmet>
        <title>Team Mappings | Percentile Totals Admin</title>
        <meta name="description" content="Map internal team names to Odds API team names for accurate odds matching." />
      </Helmet>

      <Layout>
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Mappings</h1>
            <p className="text-muted-foreground mt-1">
              Map internal team names to The Odds API team names
            </p>
          </div>

          {/* Sport tabs */}
          <SportTabs
            sports={defaultSports}
            activeSport={selectedSport}
            onSportChange={setSelectedSport}
          />

          {/* Stats */}
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-status-live/10 text-status-live border-status-live/30">
              {mappedCount} Mapped
            </Badge>
            {unmappedCount > 0 && (
              <Badge variant="outline" className="bg-percentile-mid/10 text-percentile-mid border-percentile-mid/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {unmappedCount} Unmapped
              </Badge>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Teams list */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredTeams && filteredTeams.length > 0 ? (
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
              {filteredTeams.map((team, index) => (
                <div
                  key={team.id}
                  className={`flex items-center justify-between p-4 ${
                    index !== filteredTeams.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{team.name}</span>
                      {team.abbrev && (
                        <span className="text-xs text-muted-foreground">({team.abbrev})</span>
                      )}
                    </div>
                    {editingTeamId === team.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="Odds API team name"
                          className="h-8 text-sm flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(team.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-status-live"
                          onClick={() => saveEdit(team.id)}
                          disabled={saveMappingMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : team.mapping ? (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        → {team.mapping.odds_api_team_name}
                      </p>
                    ) : (
                      <p className="text-sm text-percentile-mid mt-0.5">
                        No mapping set
                      </p>
                    )}
                  </div>

                  {editingTeamId !== team.id && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(team)}
                      >
                        {team.mapping ? 'Edit' : 'Map'}
                      </Button>
                      {team.mapping && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteMappingMutation.mutate(team.id)}
                          disabled={deleteMappingMutation.isPending}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <p className="text-muted-foreground">
                {searchQuery ? 'No teams match your search' : 'No teams found for this sport'}
              </p>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
