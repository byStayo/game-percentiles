// Team abbreviation to full name mappings for display
export const NFL_TEAMS: Record<string, string> = {
  'ARI': 'Arizona Cardinals',
  'ATL': 'Atlanta Falcons',
  'BAL': 'Baltimore Ravens',
  'BUF': 'Buffalo Bills',
  'CAR': 'Carolina Panthers',
  'CHI': 'Chicago Bears',
  'CIN': 'Cincinnati Bengals',
  'CLE': 'Cleveland Browns',
  'DAL': 'Dallas Cowboys',
  'DEN': 'Denver Broncos',
  'DET': 'Detroit Lions',
  'GB': 'Green Bay Packers',
  'HOU': 'Houston Texans',
  'IND': 'Indianapolis Colts',
  'JAX': 'Jacksonville Jaguars',
  'KC': 'Kansas City Chiefs',
  'LV': 'Las Vegas Raiders',
  'LAC': 'Los Angeles Chargers',
  'LAR': 'Los Angeles Rams',
  'MIA': 'Miami Dolphins',
  'MIN': 'Minnesota Vikings',
  'NE': 'New England Patriots',
  'NO': 'New Orleans Saints',
  'NYG': 'New York Giants',
  'NYJ': 'New York Jets',
  'PHI': 'Philadelphia Eagles',
  'PIT': 'Pittsburgh Steelers',
  'SF': 'San Francisco 49ers',
  'SEA': 'Seattle Seahawks',
  'TB': 'Tampa Bay Buccaneers',
  'TEN': 'Tennessee Titans',
  'WAS': 'Washington Commanders',
};

export const NBA_TEAMS: Record<string, string> = {
  'ATL': 'Atlanta Hawks',
  'BOS': 'Boston Celtics',
  'BKN': 'Brooklyn Nets',
  'CHA': 'Charlotte Hornets',
  'CHI': 'Chicago Bulls',
  'CLE': 'Cleveland Cavaliers',
  'DAL': 'Dallas Mavericks',
  'DEN': 'Denver Nuggets',
  'DET': 'Detroit Pistons',
  'GS': 'Golden State Warriors',
  'GSW': 'Golden State Warriors',
  'HOU': 'Houston Rockets',
  'IND': 'Indiana Pacers',
  'LAC': 'Los Angeles Clippers',
  'LAL': 'Los Angeles Lakers',
  'MEM': 'Memphis Grizzlies',
  'MIA': 'Miami Heat',
  'MIL': 'Milwaukee Bucks',
  'MIN': 'Minnesota Timberwolves',
  'NO': 'New Orleans Pelicans',
  'NOP': 'New Orleans Pelicans',
  'NY': 'New York Knicks',
  'NYK': 'New York Knicks',
  'OKC': 'Oklahoma City Thunder',
  'ORL': 'Orlando Magic',
  'PHI': 'Philadelphia 76ers',
  'PHX': 'Phoenix Suns',
  'POR': 'Portland Trail Blazers',
  'SAC': 'Sacramento Kings',
  'SA': 'San Antonio Spurs',
  'SAS': 'San Antonio Spurs',
  'TOR': 'Toronto Raptors',
  'UTA': 'Utah Jazz',
  'WAS': 'Washington Wizards',
};

export const NHL_TEAMS: Record<string, string> = {
  'ANA': 'Anaheim Ducks',
  'ARI': 'Arizona Coyotes',
  'BOS': 'Boston Bruins',
  'BUF': 'Buffalo Sabres',
  'CGY': 'Calgary Flames',
  'CAR': 'Carolina Hurricanes',
  'CHI': 'Chicago Blackhawks',
  'COL': 'Colorado Avalanche',
  'CBJ': 'Columbus Blue Jackets',
  'DAL': 'Dallas Stars',
  'DET': 'Detroit Red Wings',
  'EDM': 'Edmonton Oilers',
  'FLA': 'Florida Panthers',
  'LA': 'Los Angeles Kings',
  'LAK': 'Los Angeles Kings',
  'MIN': 'Minnesota Wild',
  'MTL': 'Montreal Canadiens',
  'NSH': 'Nashville Predators',
  'NJ': 'New Jersey Devils',
  'NJD': 'New Jersey Devils',
  'NYI': 'New York Islanders',
  'NYR': 'New York Rangers',
  'OTT': 'Ottawa Senators',
  'PHI': 'Philadelphia Flyers',
  'PIT': 'Pittsburgh Penguins',
  'SJ': 'San Jose Sharks',
  'SJS': 'San Jose Sharks',
  'SEA': 'Seattle Kraken',
  'STL': 'St. Louis Blues',
  'TB': 'Tampa Bay Lightning',
  'TBL': 'Tampa Bay Lightning',
  'TOR': 'Toronto Maple Leafs',
  'UTA': 'Utah Hockey Club',
  'VAN': 'Vancouver Canucks',
  'VGK': 'Vegas Golden Knights',
  'WSH': 'Washington Capitals',
  'WPG': 'Winnipeg Jets',
};

export const MLB_TEAMS: Record<string, string> = {
  'ARI': 'Arizona Diamondbacks',
  'ATL': 'Atlanta Braves',
  'BAL': 'Baltimore Orioles',
  'BOS': 'Boston Red Sox',
  'CHC': 'Chicago Cubs',
  'CWS': 'Chicago White Sox',
  'CIN': 'Cincinnati Reds',
  'CLE': 'Cleveland Guardians',
  'COL': 'Colorado Rockies',
  'DET': 'Detroit Tigers',
  'HOU': 'Houston Astros',
  'KC': 'Kansas City Royals',
  'LA': 'Los Angeles Angels',
  'LAA': 'Los Angeles Angels',
  'LAD': 'Los Angeles Dodgers',
  'MIA': 'Miami Marlins',
  'MIL': 'Milwaukee Brewers',
  'MIN': 'Minnesota Twins',
  'NYM': 'New York Mets',
  'NYY': 'New York Yankees',
  'OAK': 'Oakland Athletics',
  'PHI': 'Philadelphia Phillies',
  'PIT': 'Pittsburgh Pirates',
  'SD': 'San Diego Padres',
  'SF': 'San Francisco Giants',
  'SEA': 'Seattle Mariners',
  'STL': 'St. Louis Cardinals',
  'TB': 'Tampa Bay Rays',
  'TEX': 'Texas Rangers',
  'TOR': 'Toronto Blue Jays',
  'WSH': 'Washington Nationals',
};

const SPORT_TEAM_MAPS: Record<string, Record<string, string>> = {
  nfl: NFL_TEAMS,
  nba: NBA_TEAMS,
  nhl: NHL_TEAMS,
  mlb: MLB_TEAMS,
};

/**
 * Expands a team abbreviation to full name based on sport
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
 * Gets the display name for a team
 * Prioritizes: city + name > expanded abbrev > raw name
 */
export function getTeamDisplayName(
  team: { name: string; city?: string | null; abbrev?: string | null } | null | undefined,
  sportId: string
): string {
  if (!team) return 'TBD';
  
  // If we have city, show city + name
  if (team.city) {
    return `${team.city} ${team.name}`;
  }
  
  // Try to expand the name as an abbreviation
  const expanded = expandTeamName(team.name, sportId);
  return expanded;
}
