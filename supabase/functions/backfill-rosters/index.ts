import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ESPN Roster API URLs by sport
const ESPN_ROSTER_URLS: Record<string, string> = {
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams",
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams",
  nhl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams",
};

interface ESPNAthlete {
  id: string;
  fullName: string;
  position?: { abbreviation: string };
  jersey?: string;
  experience?: { years: number };
  salary?: number;
}

interface ESPNTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  athletes?: ESPNAthlete[];
}

interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  jersey: string;
  experience: number;
}

async function fetchTeamRoster(sport: string, teamId: string): Promise<RosterPlayer[]> {
  const baseUrl = ESPN_ROSTER_URLS[sport];
  if (!baseUrl) return [];

  try {
    const url = `${baseUrl}/${teamId}/roster`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) return [];

    const data = await response.json();
    const players: RosterPlayer[] = [];

    // ESPN roster structure varies by sport
    const athletes = data.athletes || [];
    for (const group of athletes) {
      const items = group.items || [];
      for (const athlete of items) {
        players.push({
          id: athlete.id,
          name: athlete.fullName || athlete.displayName || "Unknown",
          position: athlete.position?.abbreviation || "N/A",
          jersey: athlete.jersey || "",
          experience: athlete.experience?.years || 0,
        });
      }
    }

    return players;
  } catch (err) {
    console.log(`[ROSTER] Error fetching roster for ${sport} team ${teamId}:`, err);
    return [];
  }
}

async function fetchAllTeams(sport: string): Promise<ESPNTeam[]> {
  const baseUrl = ESPN_ROSTER_URLS[sport];
  if (!baseUrl) return [];

  try {
    const response = await fetch(baseUrl, { headers: { "Accept": "application/json" } });
    if (!response.ok) return [];

    const data = await response.json();
    const teams: ESPNTeam[] = [];

    for (const group of data.sports?.[0]?.leagues?.[0]?.teams || []) {
      if (group.team) {
        teams.push({
          id: group.team.id,
          abbreviation: group.team.abbreviation,
          displayName: group.team.displayName,
        });
      }
    }

    return teams;
  } catch (err) {
    console.log(`[ROSTER] Error fetching teams for ${sport}:`, err);
    return [];
  }
}

function computeContinuityScore(
  prevPlayers: RosterPlayer[],
  currPlayers: RosterPlayer[]
): number {
  if (prevPlayers.length === 0 || currPlayers.length === 0) {
    return 0;
  }

  const prevIds = new Set(prevPlayers.map(p => p.id));
  const currIds = new Set(currPlayers.map(p => p.id));
  
  // Count players that remained
  let retained = 0;
  for (const id of currIds) {
    if (prevIds.has(id)) retained++;
  }

  // Compute as percentage of current roster that was on previous roster
  const continuity = (retained / currPlayers.length) * 100;
  return Math.round(continuity * 10) / 10;
}

function identifyKeyPlayers(players: RosterPlayer[], sport: string): RosterPlayer[] {
  // Key positions by sport
  const keyPositions: Record<string, string[]> = {
    nba: ["PG", "SF", "C"],
    nfl: ["QB", "WR", "RB", "DE", "CB"],
    nhl: ["C", "G", "D"],
    mlb: ["P", "C", "SS", "CF"],
  };

  const positions = keyPositions[sport] || [];
  
  // Filter to key positions, then take top 5 by experience
  const keyPlayers = players
    .filter(p => positions.includes(p.position))
    .sort((a, b) => b.experience - a.experience)
    .slice(0, 5);

  // If we don't have enough, add more by experience
  if (keyPlayers.length < 5) {
    const remaining = players
      .filter(p => !keyPlayers.find(k => k.id === p.id))
      .sort((a, b) => b.experience - a.experience)
      .slice(0, 5 - keyPlayers.length);
    keyPlayers.push(...remaining);
  }

  return keyPlayers;
}

// Detect team era based on multi-year continuity patterns
async function detectTeamEra(
  supabase: any,
  teamId: string,
  sport: string,
  currentYear: number,
  currentContinuity: number
): Promise<{ era_tag: string; era_start_year: number; era_description: string }> {
  // Get historical snapshots for this team
  const { data: history } = await supabase
    .from("roster_snapshots")
    .select("season_year, continuity_score, era_tag")
    .eq("team_id", teamId)
    .eq("sport_id", sport)
    .order("season_year", { ascending: false })
    .limit(10);

  const snapshots = history || [];
  
  // Thresholds
  const REBUILD_THRESHOLD = 30;
  const STABLE_THRESHOLD = 70;
  const TRANSITION_THRESHOLD = 50;

  // Determine current era tag
  let era_tag: string;
  if (currentContinuity < REBUILD_THRESHOLD) {
    era_tag = "rebuild";
  } else if (currentContinuity >= STABLE_THRESHOLD) {
    era_tag = "stable";
  } else if (currentContinuity < TRANSITION_THRESHOLD) {
    era_tag = "retooling";
  } else {
    era_tag = "transition";
  }

  // Find when the current era started by looking at recent changes
  let era_start_year = currentYear;
  let previousEraTag = era_tag;
  
  for (const snapshot of snapshots) {
    if (snapshot.season_year >= currentYear) continue;
    
    const score = snapshot.continuity_score || 50;
    let snapEraTag: string;
    
    if (score < REBUILD_THRESHOLD) {
      snapEraTag = "rebuild";
    } else if (score >= STABLE_THRESHOLD) {
      snapEraTag = "stable";
    } else if (score < TRANSITION_THRESHOLD) {
      snapEraTag = "retooling";
    } else {
      snapEraTag = "transition";
    }
    
    // If era category changed, this is where current era started
    const isStableCategory = (tag: string) => tag === "stable" || tag === "transition";
    const isRebuildCategory = (tag: string) => tag === "rebuild" || tag === "retooling";
    
    if (isStableCategory(era_tag) !== isStableCategory(snapEraTag)) {
      break;
    }
    
    era_start_year = snapshot.season_year;
  }

  // Generate description
  const yearsInEra = currentYear - era_start_year + 1;
  let era_description: string;
  
  if (era_tag === "stable") {
    era_description = yearsInEra > 3 
      ? `Core intact since ${era_start_year} (${yearsInEra}yr dynasty)`
      : `Stable core since ${era_start_year}`;
  } else if (era_tag === "rebuild") {
    era_description = yearsInEra > 2
      ? `Major rebuild underway since ${era_start_year}`
      : `New era starting ${currentYear}`;
  } else if (era_tag === "retooling") {
    era_description = `Retooling roster (${currentContinuity.toFixed(0)}% continuity)`;
  } else {
    era_description = `Roster in transition`;
  }

  return { era_tag, era_start_year, era_description };
}

async function backfillRosters(
  supabase: any,
  sport: string,
  seasonYear: number
) {
  console.log(`[ROSTER] Starting roster backfill for ${sport} ${seasonYear}`);

  // Get all teams from ESPN
  const espnTeams = await fetchAllTeams(sport);
  console.log(`[ROSTER] Found ${espnTeams.length} teams for ${sport}`);

  // Get our teams from DB
  const { data: dbTeams } = await supabase
    .from("teams")
    .select("id, abbrev")
    .eq("sport_id", sport);

  const teamMap = new Map(dbTeams?.map((t: any) => [t.abbrev, t.id]) || []);

  let processed = 0;
  let errors = 0;

  for (const espnTeam of espnTeams) {
    const teamId = teamMap.get(espnTeam.abbreviation);
    if (!teamId) {
      console.log(`[ROSTER] No DB team for ${sport}:${espnTeam.abbreviation}`);
      continue;
    }

    try {
      // Fetch current roster
      const players = await fetchTeamRoster(sport, espnTeam.id);
      if (players.length === 0) {
        console.log(`[ROSTER] No players for ${sport}:${espnTeam.abbreviation}`);
        continue;
      }

      // Get previous season's roster for continuity calculation
      const { data: prevSnapshot } = await supabase
        .from("roster_snapshots")
        .select("key_players")
        .eq("team_id", teamId)
        .eq("sport_id", sport)
        .eq("season_year", seasonYear - 1)
        .maybeSingle();

      const prevPlayers: RosterPlayer[] = prevSnapshot?.key_players || [];
      const continuityScore = computeContinuityScore(prevPlayers, players);
      const keyPlayers = identifyKeyPlayers(players, sport);

      // Detect team era with multi-year pattern analysis
      const eraInfo = await detectTeamEra(supabase, teamId as string, sport, seasonYear, continuityScore);

      // Upsert roster snapshot with enhanced era info
      const { error } = await supabase
        .from("roster_snapshots")
        .upsert({
          team_id: teamId,
          sport_id: sport,
          season_year: seasonYear,
          key_players: keyPlayers,
          continuity_score: continuityScore,
          era_tag: `${eraInfo.era_tag} (${eraInfo.era_start_year})`,
          notes: eraInfo.era_description,
        }, { onConflict: "team_id,sport_id,season_year" });

      if (error) {
        console.log(`[ROSTER] Error upserting ${sport}:${espnTeam.abbreviation}:`, error);
        errors++;
      } else {
        processed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.log(`[ROSTER] Error processing ${sport}:${espnTeam.abbreviation}:`, err);
      errors++;
    }
  }

  console.log(`[ROSTER] ${sport} ${seasonYear}: ${processed} processed, ${errors} errors`);
  return { processed, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sport = url.searchParams.get("sport") || "all";
    const seasonYear = parseInt(url.searchParams.get("season") || new Date().getFullYear().toString());

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[ROSTER] Backfill request: sport=${sport}, season=${seasonYear}`);

    // Record job start
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({ job_name: `backfill-rosters-${sport}-${seasonYear}`, status: "running" })
      .select("id")
      .single();

    const results: Record<string, { processed: number; errors: number }> = {};
    const sports = sport === "all" ? ["nba", "nfl", "nhl", "mlb"] : [sport];

    for (const s of sports) {
      results[s] = await backfillRosters(supabase, s, seasonYear);
    }

    // Update job status
    if (jobRun) {
      await supabase
        .from("job_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          details: results,
        })
        .eq("id", jobRun.id);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ROSTER] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
