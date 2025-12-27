import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ESPN API URLs by sport
const ESPN_API_URLS: Record<string, string> = {
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  nhl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
};

// Team name mappings by sport (our DB name -> ESPN abbreviation)
const TEAM_MAPPINGS: Record<string, Record<string, string>> = {
  nba: {
    "ATL": "ATL", "Hawks": "ATL",
    "BOS": "BOS", "Celtics": "BOS",
    "BKN": "BKN", "BRO": "BKN", "Nets": "BKN",
    "CHA": "CHA", "CHO": "CHA", "Hornets": "CHA",
    "CHI": "CHI", "Bulls": "CHI",
    "CLE": "CLE", "Cavaliers": "CLE",
    "DAL": "DAL", "Mavericks": "DAL",
    "DEN": "DEN", "Nuggets": "DEN",
    "DET": "DET", "Pistons": "DET",
    "GSW": "GS", "GS": "GS", "Warriors": "GS",
    "HOU": "HOU", "Rockets": "HOU",
    "IND": "IND", "Pacers": "IND",
    "LAC": "LAC", "Clippers": "LAC",
    "LAL": "LAL", "Lakers": "LAL",
    "MEM": "MEM", "Grizzlies": "MEM",
    "MIA": "MIA", "Heat": "MIA",
    "MIL": "MIL", "Bucks": "MIL",
    "MIN": "MIN", "Timberwolves": "MIN",
    "NOP": "NO", "NO": "NO", "Pelicans": "NO",
    "NYK": "NY", "NY": "NY", "Knicks": "NY",
    "OKC": "OKC", "Thunder": "OKC",
    "ORL": "ORL", "Magic": "ORL",
    "PHI": "PHI", "76ers": "PHI",
    "PHX": "PHX", "PHO": "PHX", "Suns": "PHX",
    "POR": "POR", "Trail Blazers": "POR", "Blazers": "POR",
    "SAC": "SAC", "Kings": "SAC",
    "SAS": "SA", "SA": "SA", "Spurs": "SA",
    "TOR": "TOR", "Raptors": "TOR",
    "UTA": "UTAH", "UTAH": "UTAH", "Jazz": "UTAH",
    "WAS": "WSH", "WSH": "WSH", "Wizards": "WSH",
  },
  nfl: {
    "ARI": "ARI", "Cardinals": "ARI",
    "ATL": "ATL", "Falcons": "ATL",
    "BAL": "BAL", "Ravens": "BAL",
    "BUF": "BUF", "Bills": "BUF",
    "CAR": "CAR", "Panthers": "CAR",
    "CHI": "CHI", "Bears": "CHI",
    "CIN": "CIN", "Bengals": "CIN",
    "CLE": "CLE", "Browns": "CLE",
    "DAL": "DAL", "Cowboys": "DAL",
    "DEN": "DEN", "Broncos": "DEN",
    "DET": "DET", "Lions": "DET",
    "GB": "GB", "GNB": "GB", "Packers": "GB",
    "HOU": "HOU", "Texans": "HOU",
    "IND": "IND", "Colts": "IND",
    "JAC": "JAX", "JAX": "JAX", "Jaguars": "JAX",
    "KC": "KC", "KAN": "KC", "Chiefs": "KC",
    "LV": "LV", "LVR": "LV", "Raiders": "LV",
    "LAC": "LAC", "Chargers": "LAC",
    "LAR": "LAR", "LA": "LAR", "Rams": "LAR",
    "MIA": "MIA", "Dolphins": "MIA",
    "MIN": "MIN", "Vikings": "MIN",
    "NE": "NE", "NEP": "NE", "Patriots": "NE",
    "NO": "NO", "NOR": "NO", "Saints": "NO",
    "NYG": "NYG", "Giants": "NYG",
    "NYJ": "NYJ", "Jets": "NYJ",
    "PHI": "PHI", "Eagles": "PHI",
    "PIT": "PIT", "Steelers": "PIT",
    "SF": "SF", "SFO": "SF", "49ers": "SF",
    "SEA": "SEA", "Seahawks": "SEA",
    "TB": "TB", "TAM": "TB", "Buccaneers": "TB",
    "TEN": "TEN", "Titans": "TEN",
    "WAS": "WSH", "WSH": "WSH", "Commanders": "WSH",
  },
  nhl: {
    "ANA": "ANA", "Ducks": "ANA",
    "ARI": "ARI", "UTA": "UTAH", "Coyotes": "ARI", "Utah": "UTAH",
    "BOS": "BOS", "Bruins": "BOS",
    "BUF": "BUF", "Sabres": "BUF",
    "CGY": "CGY", "CAL": "CGY", "Flames": "CGY",
    "CAR": "CAR", "Hurricanes": "CAR",
    "CHI": "CHI", "Blackhawks": "CHI",
    "COL": "COL", "Avalanche": "COL",
    "CBJ": "CBJ", "CLB": "CBJ", "Blue Jackets": "CBJ",
    "DAL": "DAL", "Stars": "DAL",
    "DET": "DET", "Red Wings": "DET",
    "EDM": "EDM", "Oilers": "EDM",
    "FLA": "FLA", "Panthers": "FLA",
    "LA": "LA", "LAK": "LA", "Kings": "LA",
    "MIN": "MIN", "Wild": "MIN",
    "MTL": "MTL", "MON": "MTL", "Canadiens": "MTL",
    "NSH": "NSH", "NAS": "NSH", "Predators": "NSH",
    "NJ": "NJ", "NJD": "NJ", "Devils": "NJ",
    "NYI": "NYI", "Islanders": "NYI",
    "NYR": "NYR", "Rangers": "NYR",
    "OTT": "OTT", "Senators": "OTT",
    "PHI": "PHI", "Flyers": "PHI",
    "PIT": "PIT", "Penguins": "PIT",
    "SJ": "SJ", "SJS": "SJ", "Sharks": "SJ",
    "SEA": "SEA", "Kraken": "SEA",
    "STL": "STL", "Blues": "STL",
    "TB": "TB", "TBL": "TB", "Lightning": "TB",
    "TOR": "TOR", "Maple Leafs": "TOR",
    "VAN": "VAN", "Canucks": "VAN",
    "VGK": "VGK", "VEG": "VGK", "Golden Knights": "VGK",
    "WPG": "WPG", "WIN": "WPG", "Jets": "WPG",
    "WSH": "WSH", "WAS": "WSH", "Capitals": "WSH",
  },
  mlb: {
    "ARI": "ARI", "Diamondbacks": "ARI", "D-backs": "ARI",
    "ATL": "ATL", "Braves": "ATL",
    "BAL": "BAL", "Orioles": "BAL",
    "BOS": "BOS", "Red Sox": "BOS",
    "CHC": "CHC", "Cubs": "CHC",
    "CWS": "CHW", "CHW": "CHW", "White Sox": "CHW",
    "CIN": "CIN", "Reds": "CIN",
    "CLE": "CLE", "Guardians": "CLE", "Indians": "CLE",
    "COL": "COL", "Rockies": "COL",
    "DET": "DET", "Tigers": "DET",
    "HOU": "HOU", "Astros": "HOU",
    "KC": "KC", "KAN": "KC", "Royals": "KC",
    "LAA": "LAA", "Angels": "LAA",
    "LAD": "LAD", "LA": "LAD", "Dodgers": "LAD",
    "MIA": "MIA", "Marlins": "MIA",
    "MIL": "MIL", "Brewers": "MIL",
    "MIN": "MIN", "Twins": "MIN",
    "NYM": "NYM", "Mets": "NYM",
    "NYY": "NYY", "Yankees": "NYY",
    "OAK": "OAK", "Athletics": "OAK", "A's": "OAK",
    "PHI": "PHI", "Phillies": "PHI",
    "PIT": "PIT", "Pirates": "PIT",
    "SD": "SD", "SDP": "SD", "Padres": "SD",
    "SF": "SF", "SFG": "SF", "Giants": "SF",
    "SEA": "SEA", "Mariners": "SEA",
    "STL": "STL", "Cardinals": "STL",
    "TB": "TB", "TBR": "TB", "Rays": "TB",
    "TEX": "TEX", "Rangers": "TEX",
    "TOR": "TOR", "Blue Jays": "TOR",
    "WAS": "WSH", "WSH": "WSH", "Nationals": "WSH",
  },
};

interface ESPNCompetitor {
  id: string;
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
  };
  score: string;
  homeAway: "home" | "away";
}

interface ESPNEvent {
  id: string;
  date: string;
  status: {
    type: {
      name: string;
      state: string;
      completed: boolean;
    };
  };
  competitions: Array<{
    id: string;
    competitors: ESPNCompetitor[];
  }>;
}

interface ESPNResponse {
  events: ESPNEvent[];
}

interface ParsedGame {
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
  homeScore: number;
  awayScore: number;
  isComplete: boolean;
}

function getTeamAbbrev(teamName: string, sport: string): string | null {
  const mapping = TEAM_MAPPINGS[sport];
  if (!mapping) return teamName.toUpperCase();
  
  if (mapping[teamName]) return mapping[teamName];
  const upper = teamName.toUpperCase();
  if (mapping[upper]) return mapping[upper];
  
  // Fallback: return the original name
  return teamName.toUpperCase();
}

async function fetchESPNGames(sport: string, dateStr: string): Promise<ParsedGame[]> {
  const baseUrl = ESPN_API_URLS[sport];
  if (!baseUrl) {
    console.log(`[VERIFY-SCORES] No ESPN URL for sport: ${sport}`);
    return [];
  }

  const espnDate = dateStr.replace(/-/g, "");
  const url = `${baseUrl}?dates=${espnDate}`;
  console.log(`[VERIFY-SCORES] Fetching ESPN ${sport} games for ${dateStr}`);

  const response = await fetch(url, {
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) {
    console.error(`[VERIFY-SCORES] ESPN API error for ${sport}: ${response.status}`);
    throw new Error(`ESPN API returned ${response.status}`);
  }

  const data: ESPNResponse = await response.json();
  const games: ParsedGame[] = [];

  for (const event of data.events || []) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const isComplete = event.status?.type?.completed === true;
    if (!isComplete) continue;

    const homeTeam = competition.competitors.find((c) => c.homeAway === "home");
    const awayTeam = competition.competitors.find((c) => c.homeAway === "away");

    if (!homeTeam || !awayTeam) continue;

    const homeScore = parseInt(homeTeam.score, 10);
    const awayScore = parseInt(awayTeam.score, 10);

    if (isNaN(homeScore) || isNaN(awayScore)) continue;

    games.push({
      homeTeamAbbrev: homeTeam.team.abbreviation,
      awayTeamAbbrev: awayTeam.team.abbreviation,
      homeScore,
      awayScore,
      isComplete,
    });
  }

  return games;
}

function matchGame(
  ourHomeTeam: string,
  ourAwayTeam: string,
  sport: string,
  espnGames: ParsedGame[]
): ParsedGame | null {
  const ourHomeAbbrev = getTeamAbbrev(ourHomeTeam, sport);
  const ourAwayAbbrev = getTeamAbbrev(ourAwayTeam, sport);

  if (!ourHomeAbbrev || !ourAwayAbbrev) {
    return null;
  }

  for (const espnGame of espnGames) {
    if (
      espnGame.homeTeamAbbrev === ourHomeAbbrev &&
      espnGame.awayTeamAbbrev === ourAwayAbbrev
    ) {
      return espnGame;
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    let targetDates: string[] = [];
    let targetSports: string[] = ["nba", "nfl", "nhl", "mlb"];
    
    try {
      const body = await req.json();
      if (body.date) {
        targetDates = [body.date];
      } else if (body.dates) {
        targetDates = body.dates;
      }
      if (body.sport) {
        targetSports = [body.sport];
      } else if (body.sports) {
        targetSports = body.sports;
      }
    } catch {
      // No body
    }

    // If no dates specified, check games from last 3 days
    if (targetDates.length === 0) {
      const today = new Date();
      for (let i = 0; i < 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        targetDates.push(`${year}-${month}-${day}`);
      }
    }

    console.log(`[VERIFY-SCORES] Sports: ${targetSports.join(", ")}, Dates: ${targetDates.join(", ")}`);

    const { data: jobRun, error: jobError } = await supabase
      .from("job_runs")
      .insert({ job_name: "verify-scores", status: "running" })
      .select("id")
      .single();

    if (jobError) {
      console.error("[VERIFY-SCORES] Failed to create job run:", jobError);
    }

    let correctedCount = 0;
    let checkedCount = 0;
    let errorCount = 0;
    const corrections: Array<{
      game_id: string;
      sport: string;
      teams: string;
      old_scores: { home: number; away: number; total: number };
      new_scores: { home: number; away: number; total: number };
    }> = [];

    for (const sport of targetSports) {
      console.log(`[VERIFY-SCORES] Processing sport: ${sport}`);
      
      for (const dateStr of targetDates) {
        const [year, month, day] = dateStr.split("-").map(Number);
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

        const { data: ourGames, error: gamesError } = await supabase
          .from("games")
          .select(`
            id,
            home_score,
            away_score,
            final_total,
            status,
            start_time_utc,
            home_team:teams!games_home_team_id_fkey(id, name),
            away_team:teams!games_away_team_id_fkey(id, name)
          `)
          .eq("sport_id", sport)
          .eq("status", "final")
          .gte("start_time_utc", startOfDay.toISOString())
          .lte("start_time_utc", endOfDay.toISOString());

        if (gamesError) {
          console.error(`[VERIFY-SCORES] Error fetching ${sport} games for ${dateStr}:`, gamesError);
          errorCount++;
          continue;
        }

        if (!ourGames || ourGames.length === 0) {
          continue;
        }

        console.log(`[VERIFY-SCORES] Found ${ourGames.length} final ${sport.toUpperCase()} games for ${dateStr}`);

        // Fetch ESPN games for this date AND the previous day (for timezone handling)
        let espnGames: ParsedGame[] = [];
        try {
          const currentGames = await fetchESPNGames(sport, dateStr);
          espnGames.push(...currentGames);

          // Also check previous day
          const prevDate = new Date(year, month - 1, day);
          prevDate.setDate(prevDate.getDate() - 1);
          const prevYear = prevDate.getFullYear();
          const prevMonth = String(prevDate.getMonth() + 1).padStart(2, "0");
          const prevDay = String(prevDate.getDate()).padStart(2, "0");
          const prevDateStr = `${prevYear}-${prevMonth}-${prevDay}`;

          const prevGames = await fetchESPNGames(sport, prevDateStr);
          espnGames.push(...prevGames);
        } catch (e) {
          console.error(`[VERIFY-SCORES] Failed to fetch ESPN ${sport} games for ${dateStr}:`, e);
          errorCount++;
          continue;
        }

        for (const ourGame of ourGames) {
          checkedCount++;

          const homeTeamData = ourGame.home_team as unknown as { id: string; name: string } | null;
          const awayTeamData = ourGame.away_team as unknown as { id: string; name: string } | null;
          const homeTeam = homeTeamData?.name;
          const awayTeam = awayTeamData?.name;

          if (!homeTeam || !awayTeam) continue;

          const espnMatch = matchGame(homeTeam, awayTeam, sport, espnGames);

          if (!espnMatch) continue;

          const espnHomeScore = espnMatch.homeScore;
          const espnAwayScore = espnMatch.awayScore;
          const espnTotal = espnHomeScore + espnAwayScore;

          const scoreDiffers =
            ourGame.home_score !== espnHomeScore ||
            ourGame.away_score !== espnAwayScore;

          if (scoreDiffers) {
            console.log(
              `[VERIFY-SCORES] ${sport.toUpperCase()} mismatch ${homeTeam} vs ${awayTeam}: ` +
              `Our: ${ourGame.home_score}-${ourGame.away_score}, ESPN: ${espnHomeScore}-${espnAwayScore}`
            );

            const { error: updateError } = await supabase
              .from("games")
              .update({
                home_score: espnHomeScore,
                away_score: espnAwayScore,
              })
              .eq("id", ourGame.id);

            if (updateError) {
              console.error(`[VERIFY-SCORES] Failed to update game ${ourGame.id}:`, updateError);
              errorCount++;
            } else {
              correctedCount++;
              corrections.push({
                game_id: ourGame.id,
                sport,
                teams: `${homeTeam} vs ${awayTeam}`,
                old_scores: {
                  home: ourGame.home_score ?? 0,
                  away: ourGame.away_score ?? 0,
                  total: ourGame.final_total ?? 0,
                },
                new_scores: {
                  home: espnHomeScore,
                  away: espnAwayScore,
                  total: espnTotal,
                },
              });

              // Update matchup_games
              await supabase
                .from("matchup_games")
                .update({ total: espnTotal })
                .eq("game_id", ourGame.id);
            }
          }
        }
      }
    }

    if (jobRun) {
      await supabase
        .from("job_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          details: {
            sports: targetSports,
            dates_checked: targetDates,
            games_checked: checkedCount,
            games_corrected: correctedCount,
            errors: errorCount,
            corrections: corrections.slice(0, 50),
          },
        })
        .eq("id", jobRun.id);
    }

    console.log(`[VERIFY-SCORES] Complete: ${checkedCount} checked, ${correctedCount} corrected, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        sports: targetSports,
        dates_checked: targetDates,
        games_checked: checkedCount,
        games_corrected: correctedCount,
        errors: errorCount,
        corrections,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[VERIFY-SCORES] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
