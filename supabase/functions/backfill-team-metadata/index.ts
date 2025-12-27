import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TeamMetadata {
  name: string; // This is the abbreviation in the database
  city: string;
  fullName: string;
  conference: string;
  division: string;
}

// Complete team metadata by sport - names must match DB exactly
const NBA_TEAMS: TeamMetadata[] = [
  // Eastern Conference - Atlantic
  { name: 'BOS', city: 'Boston', fullName: 'Celtics', conference: 'Eastern', division: 'Atlantic' },
  { name: 'BKN', city: 'Brooklyn', fullName: 'Nets', conference: 'Eastern', division: 'Atlantic' },
  { name: 'NY', city: 'New York', fullName: 'Knicks', conference: 'Eastern', division: 'Atlantic' },
  { name: 'PHI', city: 'Philadelphia', fullName: '76ers', conference: 'Eastern', division: 'Atlantic' },
  { name: 'TOR', city: 'Toronto', fullName: 'Raptors', conference: 'Eastern', division: 'Atlantic' },
  // Eastern Conference - Central
  { name: 'CHI', city: 'Chicago', fullName: 'Bulls', conference: 'Eastern', division: 'Central' },
  { name: 'CLE', city: 'Cleveland', fullName: 'Cavaliers', conference: 'Eastern', division: 'Central' },
  { name: 'DET', city: 'Detroit', fullName: 'Pistons', conference: 'Eastern', division: 'Central' },
  { name: 'IND', city: 'Indiana', fullName: 'Pacers', conference: 'Eastern', division: 'Central' },
  { name: 'MIL', city: 'Milwaukee', fullName: 'Bucks', conference: 'Eastern', division: 'Central' },
  // Eastern Conference - Southeast
  { name: 'ATL', city: 'Atlanta', fullName: 'Hawks', conference: 'Eastern', division: 'Southeast' },
  { name: 'CHA', city: 'Charlotte', fullName: 'Hornets', conference: 'Eastern', division: 'Southeast' },
  { name: 'MIA', city: 'Miami', fullName: 'Heat', conference: 'Eastern', division: 'Southeast' },
  { name: 'ORL', city: 'Orlando', fullName: 'Magic', conference: 'Eastern', division: 'Southeast' },
  { name: 'WAS', city: 'Washington', fullName: 'Wizards', conference: 'Eastern', division: 'Southeast' },
  // Western Conference - Northwest
  { name: 'DEN', city: 'Denver', fullName: 'Nuggets', conference: 'Western', division: 'Northwest' },
  { name: 'MIN', city: 'Minnesota', fullName: 'Timberwolves', conference: 'Western', division: 'Northwest' },
  { name: 'OKC', city: 'Oklahoma City', fullName: 'Thunder', conference: 'Western', division: 'Northwest' },
  { name: 'POR', city: 'Portland', fullName: 'Trail Blazers', conference: 'Western', division: 'Northwest' },
  { name: 'UTA', city: 'Utah', fullName: 'Jazz', conference: 'Western', division: 'Northwest' },
  // Western Conference - Pacific
  { name: 'GS', city: 'Golden State', fullName: 'Warriors', conference: 'Western', division: 'Pacific' },
  { name: 'LAC', city: 'Los Angeles', fullName: 'Clippers', conference: 'Western', division: 'Pacific' },
  { name: 'LAL', city: 'Los Angeles', fullName: 'Lakers', conference: 'Western', division: 'Pacific' },
  { name: 'PHO', city: 'Phoenix', fullName: 'Suns', conference: 'Western', division: 'Pacific' },
  { name: 'SAC', city: 'Sacramento', fullName: 'Kings', conference: 'Western', division: 'Pacific' },
  // Western Conference - Southwest
  { name: 'DAL', city: 'Dallas', fullName: 'Mavericks', conference: 'Western', division: 'Southwest' },
  { name: 'HOU', city: 'Houston', fullName: 'Rockets', conference: 'Western', division: 'Southwest' },
  { name: 'MEM', city: 'Memphis', fullName: 'Grizzlies', conference: 'Western', division: 'Southwest' },
  { name: 'NO', city: 'New Orleans', fullName: 'Pelicans', conference: 'Western', division: 'Southwest' },
  { name: 'SA', city: 'San Antonio', fullName: 'Spurs', conference: 'Western', division: 'Southwest' },
];

const NFL_TEAMS: TeamMetadata[] = [
  // AFC East
  { name: 'BUF', city: 'Buffalo', fullName: 'Bills', conference: 'AFC', division: 'East' },
  { name: 'MIA', city: 'Miami', fullName: 'Dolphins', conference: 'AFC', division: 'East' },
  { name: 'NE', city: 'New England', fullName: 'Patriots', conference: 'AFC', division: 'East' },
  { name: 'NYJ', city: 'New York', fullName: 'Jets', conference: 'AFC', division: 'East' },
  // AFC North
  { name: 'BAL', city: 'Baltimore', fullName: 'Ravens', conference: 'AFC', division: 'North' },
  { name: 'CIN', city: 'Cincinnati', fullName: 'Bengals', conference: 'AFC', division: 'North' },
  { name: 'CLE', city: 'Cleveland', fullName: 'Browns', conference: 'AFC', division: 'North' },
  { name: 'PIT', city: 'Pittsburgh', fullName: 'Steelers', conference: 'AFC', division: 'North' },
  // AFC South
  { name: 'HOU', city: 'Houston', fullName: 'Texans', conference: 'AFC', division: 'South' },
  { name: 'IND', city: 'Indianapolis', fullName: 'Colts', conference: 'AFC', division: 'South' },
  { name: 'JAX', city: 'Jacksonville', fullName: 'Jaguars', conference: 'AFC', division: 'South' },
  { name: 'TEN', city: 'Tennessee', fullName: 'Titans', conference: 'AFC', division: 'South' },
  // AFC West
  { name: 'DEN', city: 'Denver', fullName: 'Broncos', conference: 'AFC', division: 'West' },
  { name: 'KC', city: 'Kansas City', fullName: 'Chiefs', conference: 'AFC', division: 'West' },
  { name: 'LV', city: 'Las Vegas', fullName: 'Raiders', conference: 'AFC', division: 'West' },
  { name: 'LAC', city: 'Los Angeles', fullName: 'Chargers', conference: 'AFC', division: 'West' },
  // NFC East
  { name: 'DAL', city: 'Dallas', fullName: 'Cowboys', conference: 'NFC', division: 'East' },
  { name: 'NYG', city: 'New York', fullName: 'Giants', conference: 'NFC', division: 'East' },
  { name: 'PHI', city: 'Philadelphia', fullName: 'Eagles', conference: 'NFC', division: 'East' },
  { name: 'WAS', city: 'Washington', fullName: 'Commanders', conference: 'NFC', division: 'East' },
  // NFC North
  { name: 'CHI', city: 'Chicago', fullName: 'Bears', conference: 'NFC', division: 'North' },
  { name: 'DET', city: 'Detroit', fullName: 'Lions', conference: 'NFC', division: 'North' },
  { name: 'GB', city: 'Green Bay', fullName: 'Packers', conference: 'NFC', division: 'North' },
  { name: 'MIN', city: 'Minnesota', fullName: 'Vikings', conference: 'NFC', division: 'North' },
  // NFC South
  { name: 'ATL', city: 'Atlanta', fullName: 'Falcons', conference: 'NFC', division: 'South' },
  { name: 'CAR', city: 'Carolina', fullName: 'Panthers', conference: 'NFC', division: 'South' },
  { name: 'NO', city: 'New Orleans', fullName: 'Saints', conference: 'NFC', division: 'South' },
  { name: 'TB', city: 'Tampa Bay', fullName: 'Buccaneers', conference: 'NFC', division: 'South' },
  // NFC West
  { name: 'ARI', city: 'Arizona', fullName: 'Cardinals', conference: 'NFC', division: 'West' },
  { name: 'LAR', city: 'Los Angeles', fullName: 'Rams', conference: 'NFC', division: 'West' },
  { name: 'SF', city: 'San Francisco', fullName: '49ers', conference: 'NFC', division: 'West' },
  { name: 'SEA', city: 'Seattle', fullName: 'Seahawks', conference: 'NFC', division: 'West' },
];

const MLB_TEAMS: TeamMetadata[] = [
  // AL East
  { name: 'BAL', city: 'Baltimore', fullName: 'Orioles', conference: 'AL', division: 'East' },
  { name: 'BOS', city: 'Boston', fullName: 'Red Sox', conference: 'AL', division: 'East' },
  { name: 'NYY', city: 'New York', fullName: 'Yankees', conference: 'AL', division: 'East' },
  { name: 'TB', city: 'Tampa Bay', fullName: 'Rays', conference: 'AL', division: 'East' },
  { name: 'TOR', city: 'Toronto', fullName: 'Blue Jays', conference: 'AL', division: 'East' },
  // AL Central
  { name: 'CHW', city: 'Chicago', fullName: 'White Sox', conference: 'AL', division: 'Central' },
  { name: 'CLE', city: 'Cleveland', fullName: 'Guardians', conference: 'AL', division: 'Central' },
  { name: 'DET', city: 'Detroit', fullName: 'Tigers', conference: 'AL', division: 'Central' },
  { name: 'KC', city: 'Kansas City', fullName: 'Royals', conference: 'AL', division: 'Central' },
  { name: 'MIN', city: 'Minnesota', fullName: 'Twins', conference: 'AL', division: 'Central' },
  // AL West
  { name: 'HOU', city: 'Houston', fullName: 'Astros', conference: 'AL', division: 'West' },
  { name: 'LAA', city: 'Los Angeles', fullName: 'Angels', conference: 'AL', division: 'West' },
  { name: 'ATH', city: 'Oakland', fullName: 'Athletics', conference: 'AL', division: 'West' },
  { name: 'SEA', city: 'Seattle', fullName: 'Mariners', conference: 'AL', division: 'West' },
  { name: 'TEX', city: 'Texas', fullName: 'Rangers', conference: 'AL', division: 'West' },
  // NL East
  { name: 'ATL', city: 'Atlanta', fullName: 'Braves', conference: 'NL', division: 'East' },
  { name: 'MIA', city: 'Miami', fullName: 'Marlins', conference: 'NL', division: 'East' },
  { name: 'NYM', city: 'New York', fullName: 'Mets', conference: 'NL', division: 'East' },
  { name: 'PHI', city: 'Philadelphia', fullName: 'Phillies', conference: 'NL', division: 'East' },
  { name: 'WSH', city: 'Washington', fullName: 'Nationals', conference: 'NL', division: 'East' },
  // NL Central
  { name: 'CHC', city: 'Chicago', fullName: 'Cubs', conference: 'NL', division: 'Central' },
  { name: 'CIN', city: 'Cincinnati', fullName: 'Reds', conference: 'NL', division: 'Central' },
  { name: 'MIL', city: 'Milwaukee', fullName: 'Brewers', conference: 'NL', division: 'Central' },
  { name: 'PIT', city: 'Pittsburgh', fullName: 'Pirates', conference: 'NL', division: 'Central' },
  { name: 'STL', city: 'St. Louis', fullName: 'Cardinals', conference: 'NL', division: 'Central' },
  // NL West
  { name: 'ARI', city: 'Arizona', fullName: 'Diamondbacks', conference: 'NL', division: 'West' },
  { name: 'COL', city: 'Colorado', fullName: 'Rockies', conference: 'NL', division: 'West' },
  { name: 'LAD', city: 'Los Angeles', fullName: 'Dodgers', conference: 'NL', division: 'West' },
  { name: 'SD', city: 'San Diego', fullName: 'Padres', conference: 'NL', division: 'West' },
  { name: 'SF', city: 'San Francisco', fullName: 'Giants', conference: 'NL', division: 'West' },
];

const NHL_TEAMS: TeamMetadata[] = [
  // Eastern - Atlantic
  { name: 'BOS', city: 'Boston', fullName: 'Bruins', conference: 'Eastern', division: 'Atlantic' },
  { name: 'BUF', city: 'Buffalo', fullName: 'Sabres', conference: 'Eastern', division: 'Atlantic' },
  { name: 'DET', city: 'Detroit', fullName: 'Red Wings', conference: 'Eastern', division: 'Atlantic' },
  { name: 'FLA', city: 'Florida', fullName: 'Panthers', conference: 'Eastern', division: 'Atlantic' },
  { name: 'MON', city: 'Montreal', fullName: 'Canadiens', conference: 'Eastern', division: 'Atlantic' },
  { name: 'OTT', city: 'Ottawa', fullName: 'Senators', conference: 'Eastern', division: 'Atlantic' },
  { name: 'TB', city: 'Tampa Bay', fullName: 'Lightning', conference: 'Eastern', division: 'Atlantic' },
  { name: 'TOR', city: 'Toronto', fullName: 'Maple Leafs', conference: 'Eastern', division: 'Atlantic' },
  // Eastern - Metropolitan
  { name: 'CAR', city: 'Carolina', fullName: 'Hurricanes', conference: 'Eastern', division: 'Metropolitan' },
  { name: 'CBJ', city: 'Columbus', fullName: 'Blue Jackets', conference: 'Eastern', division: 'Metropolitan' },
  { name: 'NJ', city: 'New Jersey', fullName: 'Devils', conference: 'Eastern', division: 'Metropolitan' },
  { name: 'NYI', city: 'New York', fullName: 'Islanders', conference: 'Eastern', division: 'Metropolitan' },
  { name: 'NYR', city: 'New York', fullName: 'Rangers', conference: 'Eastern', division: 'Metropolitan' },
  { name: 'PHI', city: 'Philadelphia', fullName: 'Flyers', conference: 'Eastern', division: 'Metropolitan' },
  { name: 'PIT', city: 'Pittsburgh', fullName: 'Penguins', conference: 'Eastern', division: 'Metropolitan' },
  { name: 'WAS', city: 'Washington', fullName: 'Capitals', conference: 'Eastern', division: 'Metropolitan' },
  // Western - Central
  { name: 'ARI', city: 'Arizona', fullName: 'Coyotes', conference: 'Western', division: 'Central' },
  { name: 'CHI', city: 'Chicago', fullName: 'Blackhawks', conference: 'Western', division: 'Central' },
  { name: 'COL', city: 'Colorado', fullName: 'Avalanche', conference: 'Western', division: 'Central' },
  { name: 'DAL', city: 'Dallas', fullName: 'Stars', conference: 'Western', division: 'Central' },
  { name: 'MIN', city: 'Minnesota', fullName: 'Wild', conference: 'Western', division: 'Central' },
  { name: 'NAS', city: 'Nashville', fullName: 'Predators', conference: 'Western', division: 'Central' },
  { name: 'STL', city: 'St. Louis', fullName: 'Blues', conference: 'Western', division: 'Central' },
  { name: 'WPG', city: 'Winnipeg', fullName: 'Jets', conference: 'Western', division: 'Central' },
  // Western - Pacific
  { name: 'ANA', city: 'Anaheim', fullName: 'Ducks', conference: 'Western', division: 'Pacific' },
  { name: 'CGY', city: 'Calgary', fullName: 'Flames', conference: 'Western', division: 'Pacific' },
  { name: 'EDM', city: 'Edmonton', fullName: 'Oilers', conference: 'Western', division: 'Pacific' },
  { name: 'LA', city: 'Los Angeles', fullName: 'Kings', conference: 'Western', division: 'Pacific' },
  { name: 'SJ', city: 'San Jose', fullName: 'Sharks', conference: 'Western', division: 'Pacific' },
  { name: 'SEA', city: 'Seattle', fullName: 'Kraken', conference: 'Western', division: 'Pacific' },
  { name: 'VAN', city: 'Vancouver', fullName: 'Canucks', conference: 'Western', division: 'Pacific' },
  { name: 'VEG', city: 'Vegas', fullName: 'Golden Knights', conference: 'Western', division: 'Pacific' },
];

async function backfillTeamMetadata(
  supabase: any,
  sport: string
): Promise<{ teamsUpdated: number; seasonsUpdated: number; errors: string[] }> {
  let teamData: TeamMetadata[];
  
  switch (sport) {
    case 'nba': teamData = NBA_TEAMS; break;
    case 'nfl': teamData = NFL_TEAMS; break;
    case 'mlb': teamData = MLB_TEAMS; break;
    case 'nhl': teamData = NHL_TEAMS; break;
    default: return { teamsUpdated: 0, seasonsUpdated: 0, errors: [`Unknown sport: ${sport}`] };
  }

  console.log(`[backfill-team-metadata] Processing ${teamData.length} teams for ${sport}`);

  let teamsUpdated = 0;
  let seasonsUpdated = 0;
  const errors: string[] = [];

  for (const team of teamData) {
    // Update teams table with city and abbrev
    const { data: teamRow, error: findError } = await supabase
      .from('teams')
      .select('id')
      .eq('name', team.name)
      .eq('sport_id', sport)
      .maybeSingle();

    if (findError) {
      errors.push(`Error finding ${team.name}: ${findError.message}`);
      continue;
    }

    if (!teamRow) {
      errors.push(`Team not found in DB: ${team.name} (${sport})`);
      continue;
    }

    // Update team info
    const { error: updateTeamError } = await supabase
      .from('teams')
      .update({ 
        city: team.city, 
        abbrev: team.name  // Set abbrev to match name for consistency
      })
      .eq('id', teamRow.id);

    if (updateTeamError) {
      errors.push(`Error updating team ${team.name}: ${updateTeamError.message}`);
    } else {
      teamsUpdated++;
    }

    // Update all team_seasons for this team with conference/division
    const { data: updateResult, error: updateSeasonsError } = await supabase
      .from('team_seasons')
      .update({ 
        conference: team.conference, 
        division: team.division 
      })
      .eq('team_id', teamRow.id)
      .eq('sport_id', sport)
      .select('id');

    if (updateSeasonsError) {
      errors.push(`Error updating seasons for ${team.name}: ${updateSeasonsError.message}`);
    } else {
      seasonsUpdated += (updateResult?.length || 0);
    }
  }

  console.log(`[backfill-team-metadata] ${sport}: Updated ${teamsUpdated} teams, ${seasonsUpdated} season records`);
  return { teamsUpdated, seasonsUpdated, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const sport = url.searchParams.get('sport') || 'nba';
    const allSports = url.searchParams.get('allSports') === 'true';

    console.log(`[backfill-team-metadata] Starting for ${allSports ? 'all sports' : sport}`);

    const results: Record<string, { teamsUpdated: number; seasonsUpdated: number; errors: string[] }> = {};

    if (allSports) {
      for (const s of ['nba', 'nfl', 'mlb', 'nhl']) {
        results[s] = await backfillTeamMetadata(supabase, s);
      }
    } else {
      results[sport] = await backfillTeamMetadata(supabase, sport);
    }

    const totalTeams = Object.values(results).reduce((sum, r) => sum + r.teamsUpdated, 0);
    const totalSeasons = Object.values(results).reduce((sum, r) => sum + r.seasonsUpdated, 0);
    const allErrors = Object.entries(results).flatMap(([s, r]) => r.errors.map(e => `[${s}] ${e}`));

    console.log(`[backfill-team-metadata] Complete. Teams: ${totalTeams}, Seasons: ${totalSeasons}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalTeamsUpdated: totalTeams,
        totalSeasonsUpdated: totalSeasons,
        results,
        errors: allErrors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[backfill-team-metadata] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
