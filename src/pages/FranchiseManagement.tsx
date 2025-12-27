import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Building2, GitBranch, MapPin, Calendar, Edit2, Plus, Search, RefreshCw, Link2, Unlink } from "lucide-react";
import type { SportId } from "@/types";

const sportOptions: { value: SportId; label: string }[] = [
  { value: "nfl", label: "NFL" },
  { value: "nba", label: "NBA" },
  { value: "mlb", label: "MLB" },
  { value: "nhl", label: "NHL" },
];

interface Franchise {
  id: string;
  sport_id: string;
  canonical_name: string;
  founded_year: number | null;
  notes: string | null;
}

interface TeamVersion {
  id: string;
  franchise_id: string;
  sport_id: string;
  display_name: string;
  city: string | null;
  abbrev: string | null;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

interface Team {
  id: string;
  sport_id: string;
  name: string;
  city: string | null;
  abbrev: string | null;
  provider_team_key: string;
}

interface VersionMapping {
  id: string;
  sport_id: string;
  provider_team_key: string;
  team_version_id: string;
  franchise_id: string;
  team_id: string | null;
}

export default function FranchiseManagement() {
  const [activeSport, setActiveSport] = useState<SportId>("nba");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const [editingVersion, setEditingVersion] = useState<TeamVersion | null>(null);
  const [isAddVersionOpen, setIsAddVersionOpen] = useState(false);
  const [isAddFranchiseOpen, setIsAddFranchiseOpen] = useState(false);
  const [mappingTeam, setMappingTeam] = useState<Team | null>(null);
  const queryClient = useQueryClient();

  // Fetch franchises
  const { data: franchises, isLoading: franchisesLoading } = useQuery({
    queryKey: ["franchises", activeSport],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchises")
        .select("*")
        .eq("sport_id", activeSport)
        .order("canonical_name");
      if (error) throw error;
      return data as Franchise[];
    },
  });

  // Fetch team versions for selected franchise
  const { data: teamVersions, isLoading: versionsLoading } = useQuery({
    queryKey: ["team_versions", selectedFranchise?.id],
    queryFn: async () => {
      if (!selectedFranchise) return [];
      const { data, error } = await supabase
        .from("team_versions")
        .select("*")
        .eq("franchise_id", selectedFranchise.id)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return data as TeamVersion[];
    },
    enabled: !!selectedFranchise,
  });

  // Fetch all team versions for mapping dropdown
  const { data: allTeamVersions } = useQuery({
    queryKey: ["all_team_versions", activeSport],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_versions")
        .select("*, franchise:franchises(canonical_name)")
        .eq("sport_id", activeSport)
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch teams (provider mappings)
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ["teams", activeSport],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("sport_id", activeSport)
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Fetch team version mappings
  const { data: versionMappings } = useQuery({
    queryKey: ["team_version_map", activeSport],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_version_map")
        .select("*")
        .eq("sport_id", activeSport);
      if (error) throw error;
      return data as VersionMapping[];
    },
  });

  // Create franchise mutation
  const createFranchiseMutation = useMutation({
    mutationFn: async (franchise: Omit<Franchise, "id">) => {
      const { data, error } = await supabase.from("franchises").insert(franchise).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      toast.success("Franchise created");
      setIsAddFranchiseOpen(false);
      setSelectedFranchise(data);
    },
    onError: (error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  // Update team version mutation
  const updateVersionMutation = useMutation({
    mutationFn: async (version: Partial<TeamVersion> & { id: string }) => {
      const { error } = await supabase
        .from("team_versions")
        .update({
          display_name: version.display_name,
          city: version.city,
          abbrev: version.abbrev,
          effective_from: version.effective_from,
          effective_to: version.effective_to,
          notes: version.notes,
        })
        .eq("id", version.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_versions"] });
      toast.success("Team version updated");
      setEditingVersion(null);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Add team version mutation
  const addVersionMutation = useMutation({
    mutationFn: async (version: Omit<TeamVersion, "id">) => {
      const { error } = await supabase.from("team_versions").insert(version);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_versions"] });
      queryClient.invalidateQueries({ queryKey: ["all_team_versions"] });
      toast.success("Team version added");
      setIsAddVersionOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to add: ${error.message}`);
    },
  });

  // Map team to version mutation
  const mapTeamMutation = useMutation({
    mutationFn: async ({ team, versionId, franchiseId }: { team: Team; versionId: string; franchiseId: string }) => {
      const { error } = await supabase.from("team_version_map").insert({
        sport_id: team.sport_id,
        provider_team_key: team.provider_team_key,
        team_version_id: versionId,
        franchise_id: franchiseId,
        team_id: team.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_version_map"] });
      toast.success("Team mapped to franchise");
      setMappingTeam(null);
    },
    onError: (error) => {
      toast.error(`Failed to map: ${error.message}`);
    },
  });

  // Unmap team mutation
  const unmapTeamMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase.from("team_version_map").delete().eq("id", mappingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_version_map"] });
      toast.success("Mapping removed");
    },
    onError: (error) => {
      toast.error(`Failed to unmap: ${error.message}`);
    },
  });

  const filteredFranchises = franchises?.filter((f) =>
    f.canonical_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMappedTeamsForVersion = (versionId: string) => {
    return versionMappings?.filter((m) => m.team_version_id === versionId) || [];
  };

  const getUnmappedTeams = () => {
    return teams?.filter((t) => !versionMappings?.some((m) => m.provider_team_key === t.provider_team_key)) || [];
  };

  const getMappedTeams = () => {
    return teams?.filter((t) => versionMappings?.some((m) => m.provider_team_key === t.provider_team_key)) || [];
  };

  return (
    <>
      <Helmet>
        <title>Franchise Management | Team Identity</title>
        <meta name="description" content="Manage franchise identities, team versions, and handle rebrands/relocations." />
      </Helmet>

      <Layout>
        <div className="max-w-6xl mx-auto space-y-6 px-4 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                Franchise Management
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage team identities, versions, and handle rebrands/relocations
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isAddFranchiseOpen} onOpenChange={setIsAddFranchiseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New Franchise
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card">
                  <AddFranchiseForm
                    sportId={activeSport}
                    onSubmit={(f) => createFranchiseMutation.mutate(f)}
                    isLoading={createFranchiseMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["franchises"] });
                  queryClient.invalidateQueries({ queryKey: ["teams"] });
                  queryClient.invalidateQueries({ queryKey: ["team_version_map"] });
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          <Tabs value={activeSport} onValueChange={(v) => { setActiveSport(v as SportId); setSelectedFranchise(null); }}>
            <TabsList className="bg-muted/50">
              {sportOptions.map((sport) => (
                <TabsTrigger key={sport.value} value={sport.value} className="uppercase text-xs">
                  {sport.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeSport} className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Franchises List */}
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      Franchises
                      <Badge variant="secondary" className="text-2xs">
                        {franchises?.length || 0}
                      </Badge>
                    </CardTitle>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search franchises..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      {franchisesLoading ? (
                        <div className="space-y-2">
                          {[...Array(8)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {filteredFranchises?.map((franchise) => (
                            <button
                              key={franchise.id}
                              onClick={() => setSelectedFranchise(franchise)}
                              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                                selectedFranchise?.id === franchise.id
                                  ? "bg-primary/10 border border-primary/30"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <div className="font-medium text-sm">{franchise.canonical_name}</div>
                              {franchise.founded_year && (
                                <div className="text-xs text-muted-foreground">
                                  Est. {franchise.founded_year}
                                </div>
                              )}
                            </button>
                          ))}
                          {filteredFranchises?.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              No franchises found. Create one to get started.
                            </div>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Team Versions */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          Team Versions
                        </CardTitle>
                        {selectedFranchise && (
                          <CardDescription>{selectedFranchise.canonical_name}</CardDescription>
                        )}
                      </div>
                      {selectedFranchise && (
                        <Dialog open={isAddVersionOpen} onOpenChange={setIsAddVersionOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Plus className="h-4 w-4 mr-1" />
                              Add Version
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-card">
                            <AddVersionForm
                              franchise={selectedFranchise}
                              onSubmit={(version) => addVersionMutation.mutate(version)}
                              isLoading={addVersionMutation.isPending}
                            />
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!selectedFranchise ? (
                      <div className="text-center py-12 text-muted-foreground">
                        Select a franchise to view team versions
                      </div>
                    ) : versionsLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-24 w-full" />
                        ))}
                      </div>
                    ) : teamVersions?.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        No team versions found. Add one to track rebrands/relocations.
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-3">
                          {teamVersions?.map((version) => {
                            const mappedTeams = getMappedTeamsForVersion(version.id);
                            const isEditing = editingVersion?.id === version.id;

                            return (
                              <div
                                key={version.id}
                                className="p-4 rounded-lg border border-border/60 bg-secondary/20"
                              >
                                {isEditing ? (
                                  <EditVersionForm
                                    version={editingVersion}
                                    onChange={setEditingVersion}
                                    onSave={() => updateVersionMutation.mutate(editingVersion)}
                                    onCancel={() => setEditingVersion(null)}
                                    isLoading={updateVersionMutation.isPending}
                                  />
                                ) : (
                                  <>
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <div className="font-semibold flex items-center gap-2">
                                          {version.display_name}
                                          {version.abbrev && (
                                            <Badge variant="outline" className="text-2xs">
                                              {version.abbrev}
                                            </Badge>
                                          )}
                                        </div>
                                        {version.city && (
                                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {version.city}
                                          </div>
                                        )}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setEditingVersion(version)}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                    </div>

                                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      <span>
                                        {version.effective_from}
                                        {version.effective_to ? ` → ${version.effective_to}` : " → Present"}
                                      </span>
                                    </div>

                                    {mappedTeams.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-border/40">
                                        <div className="text-2xs text-muted-foreground mb-1">
                                          Mapped Provider Keys:
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {mappedTeams.map((m) => (
                                            <Badge key={m.id} variant="secondary" className="text-2xs flex items-center gap-1">
                                              {m.provider_team_key}
                                              <button
                                                onClick={() => unmapTeamMutation.mutate(m.id)}
                                                className="hover:text-destructive ml-1"
                                              >
                                                <Unlink className="h-3 w-3" />
                                              </button>
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {version.notes && (
                                      <div className="mt-2 text-xs text-muted-foreground italic">
                                        {version.notes}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Provider Team Mappings */}
              <Card className="mt-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Provider Team Mappings</CardTitle>
                      <CardDescription>
                        Map data provider teams to franchise versions for accurate historical tracking
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getMappedTeams().length} mapped
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {getUnmappedTeams().length} unmapped
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {teamsLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[...Array(8)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {teams?.map((team) => {
                        const mapping = versionMappings?.find(
                          (m) => m.provider_team_key === team.provider_team_key
                        );
                        const isMapped = !!mapping;
                        const mappedVersion = isMapped
                          ? allTeamVersions?.find((v) => v.id === mapping.team_version_id)
                          : null;

                        return (
                          <div
                            key={team.id}
                            className={`p-3 rounded-lg border text-sm transition-colors ${
                              isMapped
                                ? "border-primary/30 bg-primary/5"
                                : "border-status-over/30 bg-status-over/5"
                            }`}
                          >
                            <div className="font-medium truncate">{team.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {team.abbrev} • {team.provider_team_key}
                            </div>
                            {isMapped ? (
                              <div className="mt-2 flex items-center justify-between">
                                <Badge variant="outline" className="text-2xs truncate max-w-[120px]">
                                  {mappedVersion?.display_name || "Mapped"}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => unmapTeamMutation.mutate(mapping.id)}
                                >
                                  <Unlink className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Dialog open={mappingTeam?.id === team.id} onOpenChange={(open) => !open && setMappingTeam(null)}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="mt-2 w-full text-xs"
                                    onClick={() => setMappingTeam(team)}
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Map to Franchise
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-card">
                                  <MapTeamForm
                                    team={team}
                                    teamVersions={allTeamVersions || []}
                                    onSubmit={(versionId, franchiseId) => 
                                      mapTeamMutation.mutate({ team, versionId, franchiseId })
                                    }
                                    isLoading={mapTeamMutation.isPending}
                                    onCancel={() => setMappingTeam(null)}
                                  />
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </>
  );
}

// Add Franchise Form
function AddFranchiseForm({
  sportId,
  onSubmit,
  isLoading,
}: {
  sportId: SportId;
  onSubmit: (franchise: Omit<Franchise, "id">) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    canonical_name: "",
    founded_year: "",
    notes: "",
  });

  const handleSubmit = () => {
    onSubmit({
      sport_id: sportId,
      canonical_name: formData.canonical_name,
      founded_year: formData.founded_year ? parseInt(formData.founded_year) : null,
      notes: formData.notes || null,
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create New Franchise</DialogTitle>
        <DialogDescription>
          Add a new franchise to track team history across rebrands and relocations.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label>Canonical Name</Label>
          <Input
            value={formData.canonical_name}
            onChange={(e) => setFormData({ ...formData, canonical_name: e.target.value })}
            placeholder="e.g., Lakers, Patriots, Yankees"
          />
        </div>
        <div>
          <Label>Founded Year (optional)</Label>
          <Input
            type="number"
            value={formData.founded_year}
            onChange={(e) => setFormData({ ...formData, founded_year: e.target.value })}
            placeholder="e.g., 1946"
          />
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Input
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="e.g., Originally Minneapolis Lakers"
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleSubmit} disabled={isLoading || !formData.canonical_name}>
          {isLoading ? "Creating..." : "Create Franchise"}
        </Button>
      </DialogFooter>
    </>
  );
}

// Map Team Form
function MapTeamForm({
  team,
  teamVersions,
  onSubmit,
  isLoading,
  onCancel,
}: {
  team: Team;
  teamVersions: any[];
  onSubmit: (versionId: string, franchiseId: string) => void;
  isLoading: boolean;
  onCancel: () => void;
}) {
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const selectedVersion = teamVersions.find((v) => v.id === selectedVersionId);

  const handleSubmit = () => {
    if (selectedVersion) {
      onSubmit(selectedVersionId, selectedVersion.franchise_id);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Map Team to Franchise</DialogTitle>
        <DialogDescription>
          Connect "{team.name}" ({team.abbrev}) to a franchise version for historical tracking.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label>Select Team Version</Label>
          <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Choose a team version..." />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {teamVersions.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  {version.display_name} ({version.franchise?.canonical_name})
                  {version.city && ` - ${version.city}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedVersion && (
          <div className="p-3 rounded-lg bg-secondary/50 text-sm">
            <div className="font-medium">{selectedVersion.display_name}</div>
            <div className="text-xs text-muted-foreground">
              Franchise: {selectedVersion.franchise?.canonical_name}
            </div>
            <div className="text-xs text-muted-foreground">
              Period: {selectedVersion.effective_from} → {selectedVersion.effective_to || "Present"}
            </div>
          </div>
        )}
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading || !selectedVersionId}>
          {isLoading ? "Mapping..." : "Map Team"}
        </Button>
      </DialogFooter>
    </>
  );
}

// Edit Version Form Component
function EditVersionForm({
  version,
  onChange,
  onSave,
  onCancel,
  isLoading,
}: {
  version: TeamVersion;
  onChange: (v: TeamVersion) => void;
  onSave: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Display Name</Label>
          <Input
            value={version.display_name}
            onChange={(e) => onChange({ ...version, display_name: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Abbreviation</Label>
          <Input
            value={version.abbrev || ""}
            onChange={(e) => onChange({ ...version, abbrev: e.target.value || null })}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">City</Label>
          <Input
            value={version.city || ""}
            onChange={(e) => onChange({ ...version, city: e.target.value || null })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">From Date</Label>
          <Input
            type="date"
            value={version.effective_from}
            onChange={(e) => onChange({ ...version, effective_from: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">To Date (blank = current)</Label>
          <Input
            type="date"
            value={version.effective_to || ""}
            onChange={(e) => onChange({ ...version, effective_to: e.target.value || null })}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Input
          value={version.notes || ""}
          onChange={(e) => onChange({ ...version, notes: e.target.value || null })}
          className="h-8 text-sm"
          placeholder="e.g., Relocated from Seattle"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={isLoading}>
          {isLoading ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

// Add Version Form Component
function AddVersionForm({
  franchise,
  onSubmit,
  isLoading,
}: {
  franchise: Franchise;
  onSubmit: (version: Omit<TeamVersion, "id">) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    display_name: franchise.canonical_name,
    city: "",
    abbrev: "",
    effective_from: "2000-01-01",
    effective_to: "",
    notes: "",
  });

  const handleSubmit = () => {
    onSubmit({
      franchise_id: franchise.id,
      sport_id: franchise.sport_id,
      display_name: formData.display_name,
      city: formData.city || null,
      abbrev: formData.abbrev || null,
      effective_from: formData.effective_from,
      effective_to: formData.effective_to || null,
      notes: formData.notes || null,
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Team Version</DialogTitle>
        <DialogDescription>
          Add a new version for {franchise.canonical_name} to track rebrands or relocations.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Display Name</Label>
            <Input
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Abbreviation</Label>
            <Input
              value={formData.abbrev}
              onChange={(e) => setFormData({ ...formData, abbrev: e.target.value })}
              placeholder="e.g., LAL"
            />
          </div>
        </div>
        <div>
          <Label>City</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="e.g., Los Angeles"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Effective From</Label>
            <Input
              type="date"
              value={formData.effective_from}
              onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
            />
          </div>
          <div>
            <Label>Effective To (blank = current)</Label>
            <Input
              type="date"
              value={formData.effective_to}
              onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Input
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="e.g., Relocated from Seattle in 2008"
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleSubmit} disabled={isLoading || !formData.display_name}>
          {isLoading ? "Adding..." : "Add Version"}
        </Button>
      </DialogFooter>
    </>
  );
}
