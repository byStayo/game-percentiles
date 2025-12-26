// DraftKings-style team name mappings (short city + team name format)
export const NFL_TEAMS: Record<string, string> = {
  'ARI': 'ARI Cardinals',
  'ATL': 'ATL Falcons',
  'BAL': 'BAL Ravens',
  'BUF': 'BUF Bills',
  'CAR': 'CAR Panthers',
  'CHI': 'CHI Bears',
  'CIN': 'CIN Bengals',
  'CLE': 'CLE Browns',
  'DAL': 'DAL Cowboys',
  'DEN': 'DEN Broncos',
  'DET': 'DET Lions',
  'GB': 'GB Packers',
  'HOU': 'HOU Texans',
  'IND': 'IND Colts',
  'JAX': 'JAX Jaguars',
  'KC': 'KC Chiefs',
  'LV': 'LV Raiders',
  'LAC': 'LA Chargers',
  'LAR': 'LA Rams',
  'MIA': 'MIA Dolphins',
  'MIN': 'MIN Vikings',
  'NE': 'NE Patriots',
  'NO': 'NO Saints',
  'NYG': 'NY Giants',
  'NYJ': 'NY Jets',
  'PHI': 'PHI Eagles',
  'PIT': 'PIT Steelers',
  'SF': 'SF 49ers',
  'SEA': 'SEA Seahawks',
  'TB': 'TB Buccaneers',
  'TEN': 'TEN Titans',
  'WAS': 'WAS Commanders',
};

export const NBA_TEAMS: Record<string, string> = {
  'ATL': 'ATL Hawks',
  'BOS': 'BOS Celtics',
  'BKN': 'BKN Nets',
  'CHA': 'CHA Hornets',
  'CHI': 'CHI Bulls',
  'CLE': 'CLE Cavaliers',
  'DAL': 'DAL Mavericks',
  'DEN': 'DEN Nuggets',
  'DET': 'DET Pistons',
  'GS': 'GS Warriors',
  'GSW': 'GS Warriors',
  'HOU': 'HOU Rockets',
  'IND': 'IND Pacers',
  'LAC': 'LA Clippers',
  'LAL': 'LA Lakers',
  'MEM': 'MEM Grizzlies',
  'MIA': 'MIA Heat',
  'MIL': 'MIL Bucks',
  'MIN': 'MIN Timberwolves',
  'NO': 'NO Pelicans',
  'NOP': 'NO Pelicans',
  'NY': 'NY Knicks',
  'NYK': 'NY Knicks',
  'OKC': 'OKC Thunder',
  'ORL': 'ORL Magic',
  'PHI': 'PHI 76ers',
  'PHO': 'PHX Suns',
  'PHX': 'PHX Suns',
  'POR': 'POR Trail Blazers',
  'SAC': 'SAC Kings',
  'SA': 'SA Spurs',
  'SAS': 'SA Spurs',
  'TOR': 'TOR Raptors',
  'UTA': 'UTA Jazz',
  'WAS': 'WAS Wizards',
};

export const NHL_TEAMS: Record<string, string> = {
  'ANA': 'ANA Ducks',
  'ARI': 'ARI Coyotes',
  'BOS': 'BOS Bruins',
  'BUF': 'BUF Sabres',
  'CGY': 'CGY Flames',
  'CAR': 'CAR Hurricanes',
  'CHI': 'CHI Blackhawks',
  'COL': 'COL Avalanche',
  'CBJ': 'CBJ Blue Jackets',
  'DAL': 'DAL Stars',
  'DET': 'DET Red Wings',
  'EDM': 'EDM Oilers',
  'FLA': 'FLA Panthers',
  'LA': 'LA Kings',
  'LAK': 'LA Kings',
  'MIN': 'MIN Wild',
  'MTL': 'MTL Canadiens',
  'NSH': 'NSH Predators',
  'NJ': 'NJ Devils',
  'NJD': 'NJ Devils',
  'NYI': 'NY Islanders',
  'NYR': 'NY Rangers',
  'OTT': 'OTT Senators',
  'PHI': 'PHI Flyers',
  'PIT': 'PIT Penguins',
  'SJ': 'SJ Sharks',
  'SJS': 'SJ Sharks',
  'SEA': 'SEA Kraken',
  'STL': 'STL Blues',
  'TB': 'TB Lightning',
  'TBL': 'TB Lightning',
  'TOR': 'TOR Maple Leafs',
  'UTA': 'UTA Hockey Club',
  'VAN': 'VAN Canucks',
  'VGK': 'VGS Golden Knights',
  'WSH': 'WAS Capitals',
  'WPG': 'WPG Jets',
};

export const MLB_TEAMS: Record<string, string> = {
  'ARI': 'ARI Diamondbacks',
  'ATL': 'ATL Braves',
  'BAL': 'BAL Orioles',
  'BOS': 'BOS Red Sox',
  'CHC': 'CHC Cubs',
  'CWS': 'CHW White Sox',
  'CIN': 'CIN Reds',
  'CLE': 'CLE Guardians',
  'COL': 'COL Rockies',
  'DET': 'DET Tigers',
  'HOU': 'HOU Astros',
  'KC': 'KC Royals',
  'LA': 'LAA Angels',
  'LAA': 'LAA Angels',
  'LAD': 'LAD Dodgers',
  'MIA': 'MIA Marlins',
  'MIL': 'MIL Brewers',
  'MIN': 'MIN Twins',
  'NYM': 'NYM Mets',
  'NYY': 'NYY Yankees',
  'OAK': 'OAK Athletics',
  'PHI': 'PHI Phillies',
  'PIT': 'PIT Pirates',
  'SD': 'SD Padres',
  'SF': 'SF Giants',
  'SEA': 'SEA Mariners',
  'STL': 'STL Cardinals',
  'TB': 'TB Rays',
  'TEX': 'TEX Rangers',
  'TOR': 'TOR Blue Jays',
  'WSH': 'WAS Nationals',
};

const SPORT_TEAM_MAPS: Record<string, Record<string, string>> = {
  nfl: NFL_TEAMS,
  nba: NBA_TEAMS,
  nhl: NHL_TEAMS,
  mlb: MLB_TEAMS,
};

/**
 * Expands a team abbreviation to DraftKings-style short name based on sport
 * If no match found, returns the original name
 */
export function expandTeamName(abbrev: string, sportId: string): string {
  const sportMap = SPORT_TEAM_MAPS[sportId];
  if (!sportMap) return abbrev;
  
  // Try uppercase lookup
  const upper = abbrev.toUpperCase();
  if (sportMap[upper]) return sportMap[upper];
  
  // Try original case
  if (sportMap[abbrev]) return sportMap[abbrev];
  
  return abbrev;
}

/**
 * Gets the DraftKings-style display name for a team
 * Uses short city abbreviation + team name format
 */
export function getTeamDisplayName(
  team: { name: string; city?: string | null; abbrev?: string | null } | null | undefined,
  sportId: string
): string {
  if (!team) return 'TBD';
  
  // First try to expand the abbreviation to DK-style name
  if (team.abbrev) {
    const expanded = expandTeamName(team.abbrev, sportId);
    if (expanded !== team.abbrev) return expanded;
  }
  
  // Try to expand the team name as an abbreviation
  const expanded = expandTeamName(team.name, sportId);
  if (expanded !== team.name) return expanded;
  
  // Fallback to city + name or just name
  if (team.city) {
    return `${team.city} ${team.name}`;
  }
  
  return team.name;
}

/**
 * Format a date to Eastern Time display string
 */
export function formatTimeET(date: Date | string, formatStr: string = 'h:mm a'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date to Eastern Time with explicit ET suffix
 */
export function formatDateTimeET(date: Date | string): { time: string; date: string } {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const timeStr = d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  const dateStr = d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  
  return { time: `${timeStr} ET`, date: dateStr };
}
