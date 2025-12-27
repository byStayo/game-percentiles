import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ESPN Scoreboard API URLs
const ESPN_SCOREBOARD_URLS: Record<string, string> = {
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  nhl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
};

// ESPN abbreviation normalization
const ESPN_ABBREV_MAP: Record<string, Record<string, string>> = {
  nba: { "GS": "GSW", "NY": "NYK", "NO": "NOP", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS" },
  nfl: { "JAX": "JAC", "WSH": "WAS" },
  nhl: { "LA": "LAK", "UTAH": "UTA", "WSH": "WAS", "VGK": "VEG", "NAS": "NSH" },
  mlb: { "CHW": "CWS", "WSH": "WAS" },
};

// Franchise mappings for all sports
const FRANCHISE_MAPPINGS: Record<string, Record<string, string>> = {
  nba: {
    "ATL": "Atlanta Hawks", "BOS": "Boston Celtics", "BKN": "Brooklyn Nets", 
    "CHA": "Charlotte Hornets", "CHI": "Chicago Bulls", "CLE": "Cleveland Cavaliers",
    "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets", "DET": "Detroit Pistons",
    "GSW": "Golden State Warriors", "GS": "Golden State Warriors",
    "HOU": "Houston Rockets", "IND": "Indiana Pacers", "LAC": "LA Clippers",
    "LAL": "Los Angeles Lakers", "MEM": "Memphis Grizzlies", "MIA": "Miami Heat",
    "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans", "NO": "New Orleans Pelicans",
    "NYK": "New York Knicks", "NY": "New York Knicks",
    "OKC": "Oklahoma City Thunder", "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers",
    "PHX": "Phoenix Suns", "PHO": "Phoenix Suns", "POR": "Portland Trail Blazers",
    "SAC": "Sacramento Kings", "SAS": "San Antonio Spurs", "SA": "San Antonio Spurs",
    "TOR": "Toronto Raptors", "UTA": "Utah Jazz", "UTAH": "Utah Jazz",
    "WAS": "Washington Wizards", "WSH": "Washington Wizards",
    "NJN": "Brooklyn Nets", "SEA": "Oklahoma City Thunder", "VAN": "Memphis Grizzlies",
    "NOH": "New Orleans Pelicans", "NOK": "New Orleans Pelicans",
  },
  nfl: {
    "ARI": "Arizona Cardinals", "ATL": "Atlanta Falcons", "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills", "CAR": "Carolina Panthers", "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals", "CLE": "Cleveland Browns", "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos", "DET": "Detroit Lions", "GB": "Green Bay Packers",
    "HOU": "Houston Texans", "IND": "Indianapolis Colts", "JAC": "Jacksonville Jaguars",
    "JAX": "Jacksonville Jaguars", "KC": "Kansas City Chiefs",
    "LV": "Las Vegas Raiders", "LAC": "Los Angeles Chargers", "LAR": "Los Angeles Rams",
    "MIA": "Miami Dolphins", "MIN": "Minnesota Vikings", "NE": "New England Patriots",
    "NO": "New Orleans Saints", "NYG": "New York Giants", "NYJ": "New York Jets",
    "PHI": "Philadelphia Eagles", "PIT": "Pittsburgh Steelers", "SF": "San Francisco 49ers",
    "SEA": "Seattle Seahawks", "TB": "Tampa Bay Buccaneers", "TEN": "Tennessee Titans",
    "WAS": "Washington Commanders", "WSH": "Washington Commanders",
    "OAK": "Las Vegas Raiders", "SD": "Los Angeles Chargers", "STL": "Los Angeles Rams",
  },
  nhl: {
    "ANA": "Anaheim Ducks", "ARI": "Arizona Coyotes", "BOS": "Boston Bruins",
    "BUF": "Buffalo Sabres", "CGY": "Calgary Flames", "CAR": "Carolina Hurricanes",
    "CHI": "Chicago Blackhawks", "COL": "Colorado Avalanche", "CBJ": "Columbus Blue Jackets",
    "DAL": "Dallas Stars", "DET": "Detroit Red Wings", "EDM": "Edmonton Oilers",
    "FLA": "Florida Panthers", "LA": "Los Angeles Kings", "LAK": "Los Angeles Kings",
    "MIN": "Minnesota Wild", "MTL": "Montreal Canadiens", "NSH": "Nashville Predators",
    "NAS": "Nashville Predators", "NJ": "New Jersey Devils",
    "NYI": "New York Islanders", "NYR": "New York Rangers", "OTT": "Ottawa Senators",
    "PHI": "Philadelphia Flyers", "PIT": "Pittsburgh Penguins", "SJ": "San Jose Sharks",
    "SEA": "Seattle Kraken", "STL": "St. Louis Blues", "TB": "Tampa Bay Lightning",
    "TOR": "Toronto Maple Leafs", "VAN": "Vancouver Canucks", "VGK": "Vegas Golden Knights",
    "VEG": "Vegas Golden Knights", "WPG": "Winnipeg Jets", "WSH": "Washington Capitals",
    "WAS": "Washington Capitals", "PHX": "Arizona Coyotes", "ATL": "Winnipeg Jets",
    "UTAH": "Utah Hockey Club", "HFD": "Carolina Hurricanes", "QUE": "Colorado Avalanche",
  },
  mlb: {
    "ARI": "Arizona Diamondbacks", "ATL": "Atlanta Braves", "BAL": "Baltimore Orioles",
    "BOS": "Boston Red Sox", "CHC": "Chicago Cubs", "CWS": "Chicago White Sox",
    "CHW": "Chicago White Sox", "CIN": "Cincinnati Reds", "CLE": "Cleveland Guardians",
    "COL": "Colorado Rockies", "DET": "Detroit Tigers", "HOU": "Houston Astros",
    "KC": "Kansas City Royals", "LAA": "Los Angeles Angels", "LAD": "Los Angeles Dodgers",
    "MIA": "Miami Marlins", "MIL": "Milwaukee Brewers", "MIN": "Minnesota Twins",
    "NYM": "New York Mets", "NYY": "New York Yankees", "OAK": "Oakland Athletics",
    "PHI": "Philadelphia Phillies", "PIT": "Pittsburgh Pirates", "SD": "San Diego Padres",
    "SF": "San Francisco Giants", "SEA": "Seattle Mariners", "STL": "St. Louis Cardinals",
    "TB": "Tampa Bay Rays", "TEX": "Texas Rangers", "TOR": "Toronto Blue Jays",
    "WAS": "Washington Nationals", "WSH": "Washington Nationals",
    "FLA": "Miami Marlins", "MON": "Washington Nationals", "ANA": "Los Angeles Angels",
  },
};

interface ParsedGame {
  espnId: string;
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
  startTimeUtc: string;
  seasonYear: number;
  isPlayoff: boolean;
}

function computeDecade(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

// Fetch games for multiple dates in parallel (10 at a time)
async function fetchGamesForDateRange(sport: string, dates: string[]): Promise<ParsedGame[]> {
  const baseUrl = ESPN_SCOREBOARD_URLS[sport];
  if (!baseUrl) return [];

  const abbrevMap = ESPN_ABBREV_MAP[sport] || {};
  const allGames: ParsedGame[] = [];
  const batchSize = 10;

  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    const promises = batch.map(async (dateStr) => {
      const espnDate = dateStr.replace(/-/g, "");
      const url = `${baseUrl}?dates=${espnDate}`;
      
      try {
        const response = await fetch(url, { headers: { "Accept": "application/json" } });
        if (!response.ok) return [];

        const data = await response.json();
        const games: ParsedGame[] = [];

        for (const event of data.events || []) {
          const competition = event.competitions?.[0];
          if (!competition || !event.status?.type?.completed) continue;

          const homeTeam = competition.competitors.find((c: any) => c.homeAway === "home");
          const awayTeam = competition.competitors.find((c: any) => c.homeAway === "away");
          if (!homeTeam || !awayTeam) continue;

          const homeScore = parseInt(homeTeam.score, 10);
          const awayScore = parseInt(awayTeam.score, 10);
          if (isNaN(homeScore) || isNaN(awayScore)) continue;

          const rawHomeAbbrev = homeTeam.team.abbreviation;
          const rawAwayAbbrev = awayTeam.team.abbreviation;

          games.push({
            espnId: event.id,
            homeAbbrev: abbrevMap[rawHomeAbbrev] || rawHomeAbbrev,
            awayAbbrev: abbrevMap[rawAwayAbbrev] || rawAwayAbbrev,
            homeScore,
            awayScore,
            startTimeUtc: event.date,
            seasonYear: event.season?.year || new Date().getFullYear(),
            isPlayoff: event.season?.type === 3,
          });
        }

        return games;
      } catch (err) {
        console.log(`[INSTANT] Error fetching ${sport} ${dateStr}:`, err);
        return [];
      }
    });

    const results = await Promise.all(promises);
    for (const games of results) {
      allGames.push(...games);
    }
  }

  return allGames;
}

// Generate date range strings
function generateDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// Define season date ranges for each sport
function getSeasonRanges(sport: string, yearsBack: number): { start: Date; end: Date }[] {
  const ranges: { start: Date; end: Date }[] = [];
  const currentYear = new Date().getFullYear();
  const today = new Date();
  
  for (let y = currentYear; y >= currentYear - yearsBack; y--) {
    let start: Date;
    let end: Date;
    
    switch (sport) {
      case "nba":
        // NBA season: Oct to June
        start = new Date(y - 1, 9, 1); // Oct 1 of previous year
        end = new Date(y, 5, 30); // June 30
        break;
      case "nfl":
        // NFL season: Sep to Feb
        start = new Date(y, 8, 1); // Sep 1
        end = new Date(y + 1, 1, 15); // Feb 15 next year
        break;
      case "nhl":
        // NHL season: Oct to June
        start = new Date(y - 1, 9, 1); // Oct 1 of previous year
        end = new Date(y, 5, 30); // June 30
        break;
      case "mlb":
        // MLB season: Mar to Nov
        start = new Date(y, 2, 1); // Mar 1
        end = new Date(y, 10, 15); // Nov 15
        break;
      default:
        continue;
    }
    
    // Don't go past today
    if (end > today) end = today;
    if (start > today) continue;
    
    ranges.push({ start, end });
  }
  
  return ranges;
}

// Caches
const franchiseCache = new Map<string, string>();
const teamCache = new Map<string, string>();

async function getOrCreateFranchise(supabase: any, sport: string, abbrev: string): Promise<string | null> {
  const cacheKey = `${sport}:${abbrev}`;
  if (franchiseCache.has(cacheKey)) return franchiseCache.get(cacheKey)!;

  const mapping = FRANCHISE_MAPPINGS[sport] || {};
  const canonicalName = mapping[abbrev];
  if (!canonicalName) return null;

  const { data: existing } = await supabase
    .from("franchises")
    .select("id")
    .eq("sport_id", sport)
    .eq("canonical_name", canonicalName)
    .maybeSingle();

  if (existing) {
    franchiseCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("franchises")
    .insert({ sport_id: sport, canonical_name: canonicalName })
    .select("id")
    .single();

  if (error) {
    const { data: retry } = await supabase
      .from("franchises")
      .select("id")
      .eq("sport_id", sport)
      .eq("canonical_name", canonicalName)
      .maybeSingle();
    if (retry) {
      franchiseCache.set(cacheKey, retry.id);
      return retry.id;
    }
    return null;
  }

  franchiseCache.set(cacheKey, created.id);
  return created.id;
}

async function getOrCreateTeam(supabase: any, sport: string, abbrev: string): Promise<string | null> {
  const cacheKey = `${sport}:${abbrev}`;
  if (teamCache.has(cacheKey)) return teamCache.get(cacheKey)!;

  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("sport_id", sport)
    .eq("abbrev", abbrev)
    .maybeSingle();

  if (existing) {
    teamCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const mapping = FRANCHISE_MAPPINGS[sport] || {};
  const name = mapping[abbrev] || abbrev;

  const { data: created, error } = await supabase
    .from("teams")
    .insert({
      sport_id: sport,
      provider_team_key: `espn-${sport}-${abbrev}`,
      name,
      abbrev,
    })
    .select("id")
    .single();

  if (error) {
    const { data: retry } = await supabase
      .from("teams")
      .select("id")
      .eq("sport_id", sport)
      .eq("abbrev", abbrev)
      .maybeSingle();
    if (retry) {
      teamCache.set(cacheKey, retry.id);
      return retry.id;
    }
    return null;
  }

  teamCache.set(cacheKey, created.id);
  return created.id;
}

// Bulk insert games
async function bulkInsertGames(
  supabase: any, 
  sport: string, 
  games: ParsedGame[],
  progress: (msg: string) => void
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Get existing game keys to avoid duplicates
  const gameKeys = games.map(g => `espn-${sport}-${g.espnId}`);
  const { data: existingGames } = await supabase
    .from("games")
    .select("provider_game_key")
    .in("provider_game_key", gameKeys);

  const existingKeys = new Set((existingGames || []).map((g: any) => g.provider_game_key));
  progress(`Found ${existingKeys.size} existing games to skip`);

  const newGames = games.filter(g => !existingKeys.has(`espn-${sport}-${g.espnId}`));
  progress(`Processing ${newGames.length} new games`);

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < newGames.length; i += batchSize) {
    const batch = newGames.slice(i, i + batchSize);
    const gameInserts: any[] = [];
    const matchupInserts: any[] = [];

    for (const game of batch) {
      try {
        const homeFranchiseId = await getOrCreateFranchise(supabase, sport, game.homeAbbrev);
        const awayFranchiseId = await getOrCreateFranchise(supabase, sport, game.awayAbbrev);
        const homeTeamId = await getOrCreateTeam(supabase, sport, game.homeAbbrev);
        const awayTeamId = await getOrCreateTeam(supabase, sport, game.awayAbbrev);

        if (!homeTeamId || !awayTeamId) {
          skipped++;
          continue;
        }

        const finalTotal = game.homeScore + game.awayScore;
        const decade = computeDecade(game.seasonYear);
        const providerGameKey = `espn-${sport}-${game.espnId}`;

        gameInserts.push({
          sport_id: sport,
          provider_game_key: providerGameKey,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_score: game.homeScore,
          away_score: game.awayScore,
          final_total: finalTotal,
          start_time_utc: game.startTimeUtc,
          status: "final",
          season_year: game.seasonYear,
          decade,
          is_playoff: game.isPlayoff,
          home_franchise_id: homeFranchiseId,
          away_franchise_id: awayFranchiseId,
        });

        // Prepare matchup data
        const [teamLowId, teamHighId] = [homeTeamId, awayTeamId].sort();
        const [franchiseLowId, franchiseHighId] = homeFranchiseId && awayFranchiseId
          ? [homeFranchiseId, awayFranchiseId].sort()
          : [null, null];

        matchupInserts.push({
          _espnId: game.espnId,
          sport_id: sport,
          team_low_id: teamLowId,
          team_high_id: teamHighId,
          franchise_low_id: franchiseLowId,
          franchise_high_id: franchiseHighId,
          total: finalTotal,
          played_at_utc: game.startTimeUtc,
          season_year: game.seasonYear,
          decade,
        });
      } catch (err) {
        errors++;
      }
    }

    // Bulk insert games
    if (gameInserts.length > 0) {
      const { data: insertedGames, error: insertError } = await supabase
        .from("games")
        .upsert(gameInserts, { onConflict: "provider_game_key", ignoreDuplicates: true })
        .select("id, provider_game_key");

      if (insertError) {
        console.log(`[INSTANT] Batch insert error:`, insertError.message);
        errors += gameInserts.length;
      } else if (insertedGames) {
        inserted += insertedGames.length;

        // Create game_id map
        const gameIdMap = new Map<string, string>();
        for (const g of insertedGames) {
          const espnId = g.provider_game_key.replace(`espn-${sport}-`, "");
          gameIdMap.set(espnId, g.id);
        }

        // Bulk insert matchups
        const matchupsToInsert = matchupInserts
          .filter(m => gameIdMap.has(m._espnId))
          .map(m => {
            const { _espnId, ...rest } = m;
            return { ...rest, game_id: gameIdMap.get(_espnId) };
          });

        if (matchupsToInsert.length > 0) {
          await supabase.from("matchup_games").upsert(matchupsToInsert, { 
            onConflict: "game_id", 
            ignoreDuplicates: true 
          });
        }
      }
    }

    skipped += games.length - newGames.length;
    
    if (i % 200 === 0 && i > 0) {
      progress(`Processed ${i}/${newGames.length} games (${inserted} inserted)`);
    }
  }

  return { inserted, skipped, errors };
}

// Compute matchup stats for all franchise pairs
async function computeMatchupStats(supabase: any, sport: string, progress: (msg: string) => void): Promise<void> {
  progress(`Computing matchup stats for ${sport}...`);

  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Get all unique franchise pairs with games
  const { data: pairs } = await supabase
    .from("matchup_games")
    .select("franchise_low_id, franchise_high_id, team_low_id, team_high_id")
    .eq("sport_id", sport)
    .not("franchise_low_id", "is", null)
    .not("franchise_high_id", "is", null);

  if (!pairs || pairs.length === 0) {
    progress(`No matchup pairs found for ${sport}`);
    return;
  }

  // Get unique pairs
  const uniquePairs = new Map<string, any>();
  for (const p of pairs) {
    const key = `${p.franchise_low_id}:${p.franchise_high_id}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, p);
    }
  }

  progress(`Found ${uniquePairs.size} unique matchup pairs for ${sport}`);

  const segments = [
    { key: "h2h_all", cutoff: null },
    { key: "h2h_5y", cutoff: fiveYearsAgo },
    { key: "h2h_3y", cutoff: threeYearsAgo },
    { key: "h2h_1y", cutoff: oneYearAgo },
  ];

  let processed = 0;
  for (const [key, pair] of uniquePairs) {
    for (const seg of segments) {
      let query = supabase
        .from("matchup_games")
        .select("total")
        .eq("sport_id", sport)
        .eq("franchise_low_id", pair.franchise_low_id)
        .eq("franchise_high_id", pair.franchise_high_id);

      if (seg.cutoff) {
        query = query.gte("played_at_utc", seg.cutoff.toISOString());
      }

      const { data: games } = await query;
      
      if (!games || games.length === 0) continue;

      const totals = games.map((g: any) => g.total).sort((a: number, b: number) => a - b);
      const n = totals.length;
      
      const p05Index = Math.floor(n * 0.05);
      const p95Index = Math.min(Math.floor(n * 0.95), n - 1);
      const medianIndex = Math.floor(n / 2);

      await supabase.from("matchup_stats").upsert({
        sport_id: sport,
        team_low_id: pair.team_low_id,
        team_high_id: pair.team_high_id,
        franchise_low_id: pair.franchise_low_id,
        franchise_high_id: pair.franchise_high_id,
        segment_key: seg.key,
        n_games: n,
        p05: totals[p05Index],
        p95: totals[p95Index],
        median: totals[medianIndex],
        min_total: totals[0],
        max_total: totals[n - 1],
        updated_at: new Date().toISOString(),
      }, { onConflict: "sport_id,team_low_id,team_high_id,segment_key" });
    }

    processed++;
    if (processed % 50 === 0) {
      progress(`Computed stats for ${processed}/${uniquePairs.size} pairs`);
    }
  }

  progress(`Finished computing ${uniquePairs.size} matchup stats for ${sport}`);
}

async function runInstantBackfill(
  supabase: any,
  sports: string[],
  yearsBack: number,
  jobId: number
): Promise<void> {
  const updateProgress = async (message: string) => {
    console.log(`[INSTANT] ${message}`);
    await supabase
      .from("job_runs")
      .update({ details: { progress: message, updated_at: new Date().toISOString() } })
      .eq("id", jobId);
  };

  const results: Record<string, any> = {};

  for (const sport of sports) {
    await updateProgress(`Starting ${sport} backfill (${yearsBack} years)...`);

    const seasonRanges = getSeasonRanges(sport, yearsBack);
    const allDates: string[] = [];

    for (const range of seasonRanges) {
      const dates = generateDateRange(range.start, range.end);
      allDates.push(...dates);
    }

    // Remove duplicates and sort
    const uniqueDates = [...new Set(allDates)].sort();
    await updateProgress(`${sport}: Fetching ${uniqueDates.length} days of data...`);

    // Fetch all games
    const allGames = await fetchGamesForDateRange(sport, uniqueDates);
    await updateProgress(`${sport}: Found ${allGames.length} total games`);

    // Insert games
    const insertResult = await bulkInsertGames(supabase, sport, allGames, (msg) => {
      console.log(`[INSTANT] ${sport}: ${msg}`);
    });

    results[sport] = {
      ...insertResult,
      totalFetched: allGames.length,
      daysProcessed: uniqueDates.length,
    };

    await updateProgress(`${sport}: Inserted ${insertResult.inserted}, skipped ${insertResult.skipped}`);

    // Compute matchup stats
    await computeMatchupStats(supabase, sport, async (msg) => {
      await updateProgress(`${sport}: ${msg}`);
    });
  }

  // Update job as complete
  await supabase
    .from("job_runs")
    .update({
      status: "success",
      finished_at: new Date().toISOString(),
      details: { results, completed_at: new Date().toISOString() },
    })
    .eq("id", jobId);

  console.log("[INSTANT] Backfill complete!", JSON.stringify(results));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const sports = body.sports || ["nba", "nfl", "nhl", "mlb"];
    const yearsBack = body.years_back || 5;

    console.log(`[INSTANT] Starting instant backfill for ${sports.join(", ")} (${yearsBack} years)`);

    // Create job record
    const { data: jobRun, error: jobError } = await supabase
      .from("job_runs")
      .insert({ 
        job_name: "instant-backfill", 
        status: "running",
        details: { sports, yearsBack, started_at: new Date().toISOString() }
      })
      .select("id")
      .single();

    if (jobError) {
      console.log("[INSTANT] Failed to create job:", jobError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Run in background
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(runInstantBackfill(supabase, sports, yearsBack, jobRun.id));

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobRun.id,
        message: `Instant backfill started for ${sports.join(", ")} (${yearsBack} years)`,
        note: "This fetches games in parallel and should complete in 10-30 minutes depending on data volume.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.log("[INSTANT] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
