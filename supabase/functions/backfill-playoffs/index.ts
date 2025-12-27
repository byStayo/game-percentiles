import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlayoffEntry {
  team_abbrev: string;
  season_year: number;
  playoff_result: string;
}

// Mapping from common abbreviations to actual database team names
const ABBREV_TO_DB: Record<string, Record<string, string>> = {
  nba: {
    'GSW': 'GS',
    'NOP': 'NO',
    'NYK': 'NY',
    'PHX': 'PHO',
    'SAS': 'SA',
  },
  nfl: {
    // NFL names match
  },
  mlb: {
    'WAS': 'WSH',
  },
  nhl: {
    'VGK': 'VEG',
    'MTL': 'MON',
    'NSH': 'NAS',
    'SJS': 'SJ',
    'WSH': 'WAS',
  },
};

function getDbTeamName(abbrev: string, sport: string): string {
  return ABBREV_TO_DB[sport]?.[abbrev] || abbrev;
}

// Known playoff results by sport - Historical data going back to 2015
const NBA_PLAYOFFS: PlayoffEntry[] = [
  // 2024 Playoffs
  { team_abbrev: 'BOS', season_year: 2024, playoff_result: 'Champion' },
  { team_abbrev: 'DAL', season_year: 2024, playoff_result: 'Finals' },
  { team_abbrev: 'MIN', season_year: 2024, playoff_result: 'Conf Finals' },
  { team_abbrev: 'IND', season_year: 2024, playoff_result: 'Conf Finals' },
  { team_abbrev: 'DEN', season_year: 2024, playoff_result: 'Conf Semis' },
  { team_abbrev: 'OKC', season_year: 2024, playoff_result: 'Conf Semis' },
  { team_abbrev: 'NYK', season_year: 2024, playoff_result: 'Conf Semis' },
  { team_abbrev: 'CLE', season_year: 2024, playoff_result: 'Conf Semis' },
  { team_abbrev: 'LAC', season_year: 2024, playoff_result: 'First Round' },
  { team_abbrev: 'PHX', season_year: 2024, playoff_result: 'First Round' },
  { team_abbrev: 'NOP', season_year: 2024, playoff_result: 'First Round' },
  { team_abbrev: 'LAL', season_year: 2024, playoff_result: 'First Round' },
  { team_abbrev: 'MIA', season_year: 2024, playoff_result: 'First Round' },
  { team_abbrev: 'PHI', season_year: 2024, playoff_result: 'First Round' },
  { team_abbrev: 'MIL', season_year: 2024, playoff_result: 'First Round' },
  { team_abbrev: 'ORL', season_year: 2024, playoff_result: 'First Round' },
  // 2023 Playoffs
  { team_abbrev: 'DEN', season_year: 2023, playoff_result: 'Champion' },
  { team_abbrev: 'MIA', season_year: 2023, playoff_result: 'Finals' },
  { team_abbrev: 'LAL', season_year: 2023, playoff_result: 'Conf Finals' },
  { team_abbrev: 'BOS', season_year: 2023, playoff_result: 'Conf Finals' },
  { team_abbrev: 'PHX', season_year: 2023, playoff_result: 'Conf Semis' },
  { team_abbrev: 'GSW', season_year: 2023, playoff_result: 'Conf Semis' },
  { team_abbrev: 'PHI', season_year: 2023, playoff_result: 'Conf Semis' },
  { team_abbrev: 'NYK', season_year: 2023, playoff_result: 'Conf Semis' },
  { team_abbrev: 'MEM', season_year: 2023, playoff_result: 'First Round' },
  { team_abbrev: 'SAC', season_year: 2023, playoff_result: 'First Round' },
  { team_abbrev: 'MIN', season_year: 2023, playoff_result: 'First Round' },
  { team_abbrev: 'CLE', season_year: 2023, playoff_result: 'First Round' },
  { team_abbrev: 'BKN', season_year: 2023, playoff_result: 'First Round' },
  { team_abbrev: 'MIL', season_year: 2023, playoff_result: 'First Round' },
  { team_abbrev: 'ATL', season_year: 2023, playoff_result: 'First Round' },
  // 2022 Playoffs
  { team_abbrev: 'GSW', season_year: 2022, playoff_result: 'Champion' },
  { team_abbrev: 'BOS', season_year: 2022, playoff_result: 'Finals' },
  { team_abbrev: 'DAL', season_year: 2022, playoff_result: 'Conf Finals' },
  { team_abbrev: 'MIA', season_year: 2022, playoff_result: 'Conf Finals' },
  { team_abbrev: 'PHX', season_year: 2022, playoff_result: 'Conf Semis' },
  { team_abbrev: 'MEM', season_year: 2022, playoff_result: 'Conf Semis' },
  { team_abbrev: 'PHI', season_year: 2022, playoff_result: 'Conf Semis' },
  { team_abbrev: 'MIL', season_year: 2022, playoff_result: 'Conf Semis' },
  { team_abbrev: 'UTA', season_year: 2022, playoff_result: 'First Round' },
  { team_abbrev: 'DEN', season_year: 2022, playoff_result: 'First Round' },
  { team_abbrev: 'MIN', season_year: 2022, playoff_result: 'First Round' },
  { team_abbrev: 'NOP', season_year: 2022, playoff_result: 'First Round' },
  { team_abbrev: 'TOR', season_year: 2022, playoff_result: 'First Round' },
  { team_abbrev: 'CHI', season_year: 2022, playoff_result: 'First Round' },
  { team_abbrev: 'BKN', season_year: 2022, playoff_result: 'First Round' },
  { team_abbrev: 'ATL', season_year: 2022, playoff_result: 'First Round' },
  // 2021 Playoffs
  { team_abbrev: 'MIL', season_year: 2021, playoff_result: 'Champion' },
  { team_abbrev: 'PHX', season_year: 2021, playoff_result: 'Finals' },
  { team_abbrev: 'LAC', season_year: 2021, playoff_result: 'Conf Finals' },
  { team_abbrev: 'ATL', season_year: 2021, playoff_result: 'Conf Finals' },
  { team_abbrev: 'UTA', season_year: 2021, playoff_result: 'Conf Semis' },
  { team_abbrev: 'DEN', season_year: 2021, playoff_result: 'Conf Semis' },
  { team_abbrev: 'PHI', season_year: 2021, playoff_result: 'Conf Semis' },
  { team_abbrev: 'BKN', season_year: 2021, playoff_result: 'Conf Semis' },
  { team_abbrev: 'LAL', season_year: 2021, playoff_result: 'First Round' },
  { team_abbrev: 'DAL', season_year: 2021, playoff_result: 'First Round' },
  { team_abbrev: 'POR', season_year: 2021, playoff_result: 'First Round' },
  { team_abbrev: 'MEM', season_year: 2021, playoff_result: 'First Round' },
  { team_abbrev: 'NYK', season_year: 2021, playoff_result: 'First Round' },
  { team_abbrev: 'BOS', season_year: 2021, playoff_result: 'First Round' },
  { team_abbrev: 'MIA', season_year: 2021, playoff_result: 'First Round' },
  { team_abbrev: 'WAS', season_year: 2021, playoff_result: 'First Round' },
  // 2020 Playoffs (Bubble)
  { team_abbrev: 'LAL', season_year: 2020, playoff_result: 'Champion' },
  { team_abbrev: 'MIA', season_year: 2020, playoff_result: 'Finals' },
  { team_abbrev: 'DEN', season_year: 2020, playoff_result: 'Conf Finals' },
  { team_abbrev: 'BOS', season_year: 2020, playoff_result: 'Conf Finals' },
  { team_abbrev: 'LAC', season_year: 2020, playoff_result: 'Conf Semis' },
  { team_abbrev: 'HOU', season_year: 2020, playoff_result: 'Conf Semis' },
  { team_abbrev: 'TOR', season_year: 2020, playoff_result: 'Conf Semis' },
  { team_abbrev: 'MIL', season_year: 2020, playoff_result: 'Conf Semis' },
  // 2019 Playoffs
  { team_abbrev: 'TOR', season_year: 2019, playoff_result: 'Champion' },
  { team_abbrev: 'GSW', season_year: 2019, playoff_result: 'Finals' },
  { team_abbrev: 'POR', season_year: 2019, playoff_result: 'Conf Finals' },
  { team_abbrev: 'MIL', season_year: 2019, playoff_result: 'Conf Finals' },
  { team_abbrev: 'DEN', season_year: 2019, playoff_result: 'Conf Semis' },
  { team_abbrev: 'HOU', season_year: 2019, playoff_result: 'Conf Semis' },
  { team_abbrev: 'PHI', season_year: 2019, playoff_result: 'Conf Semis' },
  { team_abbrev: 'BOS', season_year: 2019, playoff_result: 'Conf Semis' },
  // 2018 Playoffs
  { team_abbrev: 'GSW', season_year: 2018, playoff_result: 'Champion' },
  { team_abbrev: 'CLE', season_year: 2018, playoff_result: 'Finals' },
  { team_abbrev: 'HOU', season_year: 2018, playoff_result: 'Conf Finals' },
  { team_abbrev: 'BOS', season_year: 2018, playoff_result: 'Conf Finals' },
  { team_abbrev: 'NOP', season_year: 2018, playoff_result: 'Conf Semis' },
  { team_abbrev: 'UTA', season_year: 2018, playoff_result: 'Conf Semis' },
  { team_abbrev: 'PHI', season_year: 2018, playoff_result: 'Conf Semis' },
  { team_abbrev: 'TOR', season_year: 2018, playoff_result: 'Conf Semis' },
  // 2017 Playoffs
  { team_abbrev: 'GSW', season_year: 2017, playoff_result: 'Champion' },
  { team_abbrev: 'CLE', season_year: 2017, playoff_result: 'Finals' },
  { team_abbrev: 'SAS', season_year: 2017, playoff_result: 'Conf Finals' },
  { team_abbrev: 'BOS', season_year: 2017, playoff_result: 'Conf Finals' },
  { team_abbrev: 'HOU', season_year: 2017, playoff_result: 'Conf Semis' },
  { team_abbrev: 'UTA', season_year: 2017, playoff_result: 'Conf Semis' },
  { team_abbrev: 'TOR', season_year: 2017, playoff_result: 'Conf Semis' },
  { team_abbrev: 'WAS', season_year: 2017, playoff_result: 'Conf Semis' },
  // 2016 Playoffs
  { team_abbrev: 'CLE', season_year: 2016, playoff_result: 'Champion' },
  { team_abbrev: 'GSW', season_year: 2016, playoff_result: 'Finals' },
  { team_abbrev: 'OKC', season_year: 2016, playoff_result: 'Conf Finals' },
  { team_abbrev: 'TOR', season_year: 2016, playoff_result: 'Conf Finals' },
  { team_abbrev: 'SAS', season_year: 2016, playoff_result: 'Conf Semis' },
  { team_abbrev: 'POR', season_year: 2016, playoff_result: 'Conf Semis' },
  { team_abbrev: 'MIA', season_year: 2016, playoff_result: 'Conf Semis' },
  { team_abbrev: 'ATL', season_year: 2016, playoff_result: 'Conf Semis' },
  // 2015 Playoffs
  { team_abbrev: 'GSW', season_year: 2015, playoff_result: 'Champion' },
  { team_abbrev: 'CLE', season_year: 2015, playoff_result: 'Finals' },
  { team_abbrev: 'HOU', season_year: 2015, playoff_result: 'Conf Finals' },
  { team_abbrev: 'ATL', season_year: 2015, playoff_result: 'Conf Finals' },
  { team_abbrev: 'MEM', season_year: 2015, playoff_result: 'Conf Semis' },
  { team_abbrev: 'LAC', season_year: 2015, playoff_result: 'Conf Semis' },
  { team_abbrev: 'CHI', season_year: 2015, playoff_result: 'Conf Semis' },
  { team_abbrev: 'WAS', season_year: 2015, playoff_result: 'Conf Semis' },
];

const NFL_PLAYOFFS: PlayoffEntry[] = [
  // 2024 Season (Super Bowl LIX)
  { team_abbrev: 'KC', season_year: 2025, playoff_result: 'Champion' },
  { team_abbrev: 'PHI', season_year: 2025, playoff_result: 'Super Bowl' },
  { team_abbrev: 'BUF', season_year: 2025, playoff_result: 'Conf Champ' },
  { team_abbrev: 'WAS', season_year: 2025, playoff_result: 'Conf Champ' },
  // 2023 Season (Super Bowl LVIII)
  { team_abbrev: 'KC', season_year: 2024, playoff_result: 'Champion' },
  { team_abbrev: 'SF', season_year: 2024, playoff_result: 'Super Bowl' },
  { team_abbrev: 'BAL', season_year: 2024, playoff_result: 'Conf Champ' },
  { team_abbrev: 'DET', season_year: 2024, playoff_result: 'Conf Champ' },
  // 2022 Season (Super Bowl LVII)
  { team_abbrev: 'KC', season_year: 2023, playoff_result: 'Champion' },
  { team_abbrev: 'PHI', season_year: 2023, playoff_result: 'Super Bowl' },
  { team_abbrev: 'CIN', season_year: 2023, playoff_result: 'Conf Champ' },
  { team_abbrev: 'SF', season_year: 2023, playoff_result: 'Conf Champ' },
  // 2021 Season (Super Bowl LVI)
  { team_abbrev: 'LAR', season_year: 2022, playoff_result: 'Champion' },
  { team_abbrev: 'CIN', season_year: 2022, playoff_result: 'Super Bowl' },
  { team_abbrev: 'KC', season_year: 2022, playoff_result: 'Conf Champ' },
  { team_abbrev: 'SF', season_year: 2022, playoff_result: 'Conf Champ' },
  // 2020 Season (Super Bowl LV)
  { team_abbrev: 'TB', season_year: 2021, playoff_result: 'Champion' },
  { team_abbrev: 'KC', season_year: 2021, playoff_result: 'Super Bowl' },
  { team_abbrev: 'BUF', season_year: 2021, playoff_result: 'Conf Champ' },
  { team_abbrev: 'GB', season_year: 2021, playoff_result: 'Conf Champ' },
  // 2019 Season (Super Bowl LIV)
  { team_abbrev: 'KC', season_year: 2020, playoff_result: 'Champion' },
  { team_abbrev: 'SF', season_year: 2020, playoff_result: 'Super Bowl' },
  { team_abbrev: 'TEN', season_year: 2020, playoff_result: 'Conf Champ' },
  { team_abbrev: 'GB', season_year: 2020, playoff_result: 'Conf Champ' },
  // 2018 Season (Super Bowl LIII)
  { team_abbrev: 'NE', season_year: 2019, playoff_result: 'Champion' },
  { team_abbrev: 'LAR', season_year: 2019, playoff_result: 'Super Bowl' },
  { team_abbrev: 'KC', season_year: 2019, playoff_result: 'Conf Champ' },
  { team_abbrev: 'NO', season_year: 2019, playoff_result: 'Conf Champ' },
  // 2017 Season (Super Bowl LII)
  { team_abbrev: 'PHI', season_year: 2018, playoff_result: 'Champion' },
  { team_abbrev: 'NE', season_year: 2018, playoff_result: 'Super Bowl' },
  { team_abbrev: 'JAX', season_year: 2018, playoff_result: 'Conf Champ' },
  { team_abbrev: 'MIN', season_year: 2018, playoff_result: 'Conf Champ' },
  // 2016 Season (Super Bowl LI)
  { team_abbrev: 'NE', season_year: 2017, playoff_result: 'Champion' },
  { team_abbrev: 'ATL', season_year: 2017, playoff_result: 'Super Bowl' },
  { team_abbrev: 'PIT', season_year: 2017, playoff_result: 'Conf Champ' },
  { team_abbrev: 'GB', season_year: 2017, playoff_result: 'Conf Champ' },
  // 2015 Season (Super Bowl 50)
  { team_abbrev: 'DEN', season_year: 2016, playoff_result: 'Champion' },
  { team_abbrev: 'CAR', season_year: 2016, playoff_result: 'Super Bowl' },
  { team_abbrev: 'NE', season_year: 2016, playoff_result: 'Conf Champ' },
  { team_abbrev: 'ARI', season_year: 2016, playoff_result: 'Conf Champ' },
  // 2014 Season (Super Bowl XLIX)
  { team_abbrev: 'NE', season_year: 2015, playoff_result: 'Champion' },
  { team_abbrev: 'SEA', season_year: 2015, playoff_result: 'Super Bowl' },
  { team_abbrev: 'IND', season_year: 2015, playoff_result: 'Conf Champ' },
  { team_abbrev: 'GB', season_year: 2015, playoff_result: 'Conf Champ' },
];

const MLB_PLAYOFFS: PlayoffEntry[] = [
  // 2024 World Series
  { team_abbrev: 'LAD', season_year: 2024, playoff_result: 'Champion' },
  { team_abbrev: 'NYY', season_year: 2024, playoff_result: 'World Series' },
  { team_abbrev: 'CLE', season_year: 2024, playoff_result: 'ALCS' },
  { team_abbrev: 'NYM', season_year: 2024, playoff_result: 'NLCS' },
  // 2023 World Series
  { team_abbrev: 'TEX', season_year: 2023, playoff_result: 'Champion' },
  { team_abbrev: 'ARI', season_year: 2023, playoff_result: 'World Series' },
  { team_abbrev: 'HOU', season_year: 2023, playoff_result: 'ALCS' },
  { team_abbrev: 'PHI', season_year: 2023, playoff_result: 'NLCS' },
  // 2022 World Series
  { team_abbrev: 'HOU', season_year: 2022, playoff_result: 'Champion' },
  { team_abbrev: 'PHI', season_year: 2022, playoff_result: 'World Series' },
  { team_abbrev: 'NYY', season_year: 2022, playoff_result: 'ALCS' },
  { team_abbrev: 'SD', season_year: 2022, playoff_result: 'NLCS' },
  // 2021 World Series
  { team_abbrev: 'ATL', season_year: 2021, playoff_result: 'Champion' },
  { team_abbrev: 'HOU', season_year: 2021, playoff_result: 'World Series' },
  { team_abbrev: 'BOS', season_year: 2021, playoff_result: 'ALCS' },
  { team_abbrev: 'LAD', season_year: 2021, playoff_result: 'NLCS' },
  // 2020 World Series (Shortened)
  { team_abbrev: 'LAD', season_year: 2020, playoff_result: 'Champion' },
  { team_abbrev: 'TB', season_year: 2020, playoff_result: 'World Series' },
  { team_abbrev: 'HOU', season_year: 2020, playoff_result: 'ALCS' },
  { team_abbrev: 'ATL', season_year: 2020, playoff_result: 'NLCS' },
  // 2019 World Series
  { team_abbrev: 'WAS', season_year: 2019, playoff_result: 'Champion' },
  { team_abbrev: 'HOU', season_year: 2019, playoff_result: 'World Series' },
  { team_abbrev: 'NYY', season_year: 2019, playoff_result: 'ALCS' },
  { team_abbrev: 'STL', season_year: 2019, playoff_result: 'NLCS' },
  // 2018 World Series
  { team_abbrev: 'BOS', season_year: 2018, playoff_result: 'Champion' },
  { team_abbrev: 'LAD', season_year: 2018, playoff_result: 'World Series' },
  { team_abbrev: 'HOU', season_year: 2018, playoff_result: 'ALCS' },
  { team_abbrev: 'MIL', season_year: 2018, playoff_result: 'NLCS' },
  // 2017 World Series
  { team_abbrev: 'HOU', season_year: 2017, playoff_result: 'Champion' },
  { team_abbrev: 'LAD', season_year: 2017, playoff_result: 'World Series' },
  { team_abbrev: 'NYY', season_year: 2017, playoff_result: 'ALCS' },
  { team_abbrev: 'CHC', season_year: 2017, playoff_result: 'NLCS' },
  // 2016 World Series
  { team_abbrev: 'CHC', season_year: 2016, playoff_result: 'Champion' },
  { team_abbrev: 'CLE', season_year: 2016, playoff_result: 'World Series' },
  { team_abbrev: 'TOR', season_year: 2016, playoff_result: 'ALCS' },
  { team_abbrev: 'LAD', season_year: 2016, playoff_result: 'NLCS' },
  // 2015 World Series
  { team_abbrev: 'KC', season_year: 2015, playoff_result: 'Champion' },
  { team_abbrev: 'NYM', season_year: 2015, playoff_result: 'World Series' },
  { team_abbrev: 'TOR', season_year: 2015, playoff_result: 'ALCS' },
  { team_abbrev: 'CHC', season_year: 2015, playoff_result: 'NLCS' },
];

const NHL_PLAYOFFS: PlayoffEntry[] = [
  // 2024 Stanley Cup
  { team_abbrev: 'FLA', season_year: 2024, playoff_result: 'Champion' },
  { team_abbrev: 'EDM', season_year: 2024, playoff_result: 'Finals' },
  { team_abbrev: 'DAL', season_year: 2024, playoff_result: 'Conf Finals' },
  { team_abbrev: 'NYR', season_year: 2024, playoff_result: 'Conf Finals' },
  // 2023 Stanley Cup
  { team_abbrev: 'VGK', season_year: 2023, playoff_result: 'Champion' },
  { team_abbrev: 'FLA', season_year: 2023, playoff_result: 'Finals' },
  { team_abbrev: 'DAL', season_year: 2023, playoff_result: 'Conf Finals' },
  { team_abbrev: 'CAR', season_year: 2023, playoff_result: 'Conf Finals' },
  // 2022 Stanley Cup
  { team_abbrev: 'COL', season_year: 2022, playoff_result: 'Champion' },
  { team_abbrev: 'TB', season_year: 2022, playoff_result: 'Finals' },
  { team_abbrev: 'EDM', season_year: 2022, playoff_result: 'Conf Finals' },
  { team_abbrev: 'NYR', season_year: 2022, playoff_result: 'Conf Finals' },
  // 2021 Stanley Cup
  { team_abbrev: 'TB', season_year: 2021, playoff_result: 'Champion' },
  { team_abbrev: 'MTL', season_year: 2021, playoff_result: 'Finals' },
  { team_abbrev: 'VGK', season_year: 2021, playoff_result: 'Conf Finals' },
  { team_abbrev: 'NYI', season_year: 2021, playoff_result: 'Conf Finals' },
  // 2020 Stanley Cup (Bubble)
  { team_abbrev: 'TB', season_year: 2020, playoff_result: 'Champion' },
  { team_abbrev: 'DAL', season_year: 2020, playoff_result: 'Finals' },
  { team_abbrev: 'VGK', season_year: 2020, playoff_result: 'Conf Finals' },
  { team_abbrev: 'NYI', season_year: 2020, playoff_result: 'Conf Finals' },
  // 2019 Stanley Cup
  { team_abbrev: 'STL', season_year: 2019, playoff_result: 'Champion' },
  { team_abbrev: 'BOS', season_year: 2019, playoff_result: 'Finals' },
  { team_abbrev: 'SJS', season_year: 2019, playoff_result: 'Conf Finals' },
  { team_abbrev: 'CAR', season_year: 2019, playoff_result: 'Conf Finals' },
  // 2018 Stanley Cup
  { team_abbrev: 'WSH', season_year: 2018, playoff_result: 'Champion' },
  { team_abbrev: 'VGK', season_year: 2018, playoff_result: 'Finals' },
  { team_abbrev: 'TB', season_year: 2018, playoff_result: 'Conf Finals' },
  { team_abbrev: 'WPG', season_year: 2018, playoff_result: 'Conf Finals' },
  // 2017 Stanley Cup
  { team_abbrev: 'PIT', season_year: 2017, playoff_result: 'Champion' },
  { team_abbrev: 'NSH', season_year: 2017, playoff_result: 'Finals' },
  { team_abbrev: 'ANA', season_year: 2017, playoff_result: 'Conf Finals' },
  { team_abbrev: 'OTT', season_year: 2017, playoff_result: 'Conf Finals' },
  // 2016 Stanley Cup
  { team_abbrev: 'PIT', season_year: 2016, playoff_result: 'Champion' },
  { team_abbrev: 'SJS', season_year: 2016, playoff_result: 'Finals' },
  { team_abbrev: 'STL', season_year: 2016, playoff_result: 'Conf Finals' },
  { team_abbrev: 'TB', season_year: 2016, playoff_result: 'Conf Finals' },
  // 2015 Stanley Cup
  { team_abbrev: 'CHI', season_year: 2015, playoff_result: 'Champion' },
  { team_abbrev: 'TB', season_year: 2015, playoff_result: 'Finals' },
  { team_abbrev: 'ANA', season_year: 2015, playoff_result: 'Conf Finals' },
  { team_abbrev: 'NYR', season_year: 2015, playoff_result: 'Conf Finals' },
];

async function backfillPlayoffs(
  supabase: any,
  sport: string
): Promise<{ updated: number; errors: string[] }> {
  let playoffData: PlayoffEntry[];
  
  switch (sport) {
    case 'nba':
      playoffData = NBA_PLAYOFFS;
      break;
    case 'nfl':
      playoffData = NFL_PLAYOFFS;
      break;
    case 'mlb':
      playoffData = MLB_PLAYOFFS;
      break;
    case 'nhl':
      playoffData = NHL_PLAYOFFS;
      break;
    default:
      return { updated: 0, errors: [`Unknown sport: ${sport}`] };
  }

  console.log(`[backfill-playoffs] Processing ${playoffData.length} playoff entries for ${sport}`);

  // Get all teams for this sport - match by name since that's where abbreviations are stored
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, abbrev')
    .eq('sport_id', sport);

  if (teamsError) {
    console.error('[backfill-playoffs] Error fetching teams:', teamsError);
    return { updated: 0, errors: [teamsError.message] };
  }

  // Create map using both name and abbrev as keys (name is the primary storage)
  const teamMap = new Map<string, string>();
  (teams || []).forEach((t: any) => {
    if (t.name) teamMap.set(t.name, t.id);
    if (t.abbrev) teamMap.set(t.abbrev, t.id);
  });
  let updated = 0;
  const errors: string[] = [];

  for (const entry of playoffData) {
    // Convert common abbreviation to DB team name
    const dbTeamName = getDbTeamName(entry.team_abbrev, sport);
    const teamId = teamMap.get(dbTeamName);
    
    if (!teamId) {
      errors.push(`Team not found: ${entry.team_abbrev} (tried: ${dbTeamName})`);
      continue;
    }

    // Update team_seasons record
    const { error: updateError } = await supabase
      .from('team_seasons')
      .update({ playoff_result: entry.playoff_result })
      .eq('team_id', teamId)
      .eq('season_year', entry.season_year)
      .eq('sport_id', sport);

    if (updateError) {
      errors.push(`Failed to update ${entry.team_abbrev} ${entry.season_year}: ${updateError.message}`);
    } else {
      updated++;
      console.log(`[backfill-playoffs] Updated ${entry.team_abbrev} ${entry.season_year}: ${entry.playoff_result}`);
    }
  }

  return { updated, errors };
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

    console.log(`[backfill-playoffs] Starting backfill for ${allSports ? 'all sports' : sport}`);

    const results: Record<string, { updated: number; errors: string[] }> = {};

    if (allSports) {
      for (const s of ['nba', 'nfl', 'mlb', 'nhl']) {
        results[s] = await backfillPlayoffs(supabase, s);
      }
    } else {
      results[sport] = await backfillPlayoffs(supabase, sport);
    }

    const totalUpdated = Object.values(results).reduce((sum, r) => sum + r.updated, 0);
    const allErrors = Object.entries(results).flatMap(([s, r]) => r.errors.map(e => `[${s}] ${e}`));

    console.log(`[backfill-playoffs] Completed. Updated ${totalUpdated} records.`);
    if (allErrors.length > 0) {
      console.log(`[backfill-playoffs] Errors:`, allErrors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalUpdated,
        results,
        errors: allErrors,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[backfill-playoffs] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
