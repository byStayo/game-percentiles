import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GameRow {
  sport_id: string;
  league_key?: string;
  season_year?: number;
  game_date_utc: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  status: string;
  provider_game_key?: string;
}

interface ImportRequest {
  source: string;
  rows: GameRow[];
}

// Simple team name normalizer
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Generate deterministic game key
async function generateImportKey(row: GameRow): Promise<string> {
  const data = `${row.sport_id}|${row.game_date_utc}|${normalizeTeamName(row.home_team_name)}|${normalizeTeamName(row.away_team_name)}|${row.home_score}|${row.away_score}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `import:${hashHex.slice(0, 32)}`;
}

// Get played date in ET
function getPlayedDateLocal(utcDateStr: string): string {
  const date = new Date(utcDateStr);
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Compute decade from date
function computeDecade(dateStr: string): string {
  const year = new Date(dateStr).getFullYear();
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const importToken = Deno.env.get('IMPORT_TOKEN');
  if (!importToken) {
    console.error('[IMPORT] IMPORT_TOKEN secret not configured');
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== importToken) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: ImportRequest = await req.json();
    const { source, rows } = body;

    if (!source || !rows || !Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (rows.length > 5000) {
      return new Response(JSON.stringify({ error: 'Max 5000 rows per request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[IMPORT] Starting import from "${source}" with ${rows.length} rows`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Start job run
    const { data: jobRun, error: jobError } = await supabase
      .from('job_runs')
      .insert({
        job_name: 'import-games',
        status: 'running',
        details: { source, rows_received: rows.length }
      })
      .select()
      .single();

    if (jobError) {
      console.error('[IMPORT] Failed to create job run:', jobError);
    }

    const counters = {
      received: rows.length,
      accepted: 0,
      rejected: 0,
      teams_upserted: 0,
      games_upserted: 0,
      matchup_rows_upserted: 0,
    };
    const errors: string[] = [];
    const teamCache = new Map<string, string>(); // normalized_name -> team_id

    // Validate and process rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Validation
      if (row.status !== 'final') {
        errors.push(`Row ${i}: status must be "final"`);
        counters.rejected++;
        continue;
      }
      if (typeof row.home_score !== 'number' || row.home_score < 0) {
        errors.push(`Row ${i}: invalid home_score`);
        counters.rejected++;
        continue;
      }
      if (typeof row.away_score !== 'number' || row.away_score < 0) {
        errors.push(`Row ${i}: invalid away_score`);
        counters.rejected++;
        continue;
      }
      if (!row.sport_id || !row.game_date_utc || !row.home_team_name || !row.away_team_name) {
        errors.push(`Row ${i}: missing required fields`);
        counters.rejected++;
        continue;
      }

      try {
        // Upsert home team
        const homeNormalized = normalizeTeamName(row.home_team_name);
        let homeTeamId = teamCache.get(`${row.sport_id}:${homeNormalized}`);
        
        if (!homeTeamId) {
          const { data: existingHome } = await supabase
            .from('teams')
            .select('id')
            .eq('sport_id', row.sport_id)
            .ilike('name', row.home_team_name)
            .maybeSingle();

          if (existingHome) {
            homeTeamId = existingHome.id;
          } else {
            const { data: newHome, error: homeError } = await supabase
              .from('teams')
              .insert({
                sport_id: row.sport_id,
                name: row.home_team_name,
                provider_team_key: `import:${homeNormalized}`,
              })
              .select()
              .single();

            if (homeError) {
              // Try to fetch again in case of race condition
              const { data: retryHome } = await supabase
                .from('teams')
                .select('id')
                .eq('sport_id', row.sport_id)
                .eq('provider_team_key', `import:${homeNormalized}`)
                .maybeSingle();
              
              if (retryHome) {
                homeTeamId = retryHome.id;
              } else {
                throw new Error(`Failed to upsert home team: ${homeError.message}`);
              }
            } else {
              homeTeamId = newHome.id;
              counters.teams_upserted++;
            }
          }
          if (!homeTeamId) {
            throw new Error('Failed to get home team ID');
          }
          teamCache.set(`${row.sport_id}:${homeNormalized}`, homeTeamId);
        }

        // Upsert away team
        const awayNormalized = normalizeTeamName(row.away_team_name);
        let awayTeamId = teamCache.get(`${row.sport_id}:${awayNormalized}`);
        
        if (!awayTeamId) {
          const { data: existingAway } = await supabase
            .from('teams')
            .select('id')
            .eq('sport_id', row.sport_id)
            .ilike('name', row.away_team_name)
            .maybeSingle();

          if (existingAway) {
            awayTeamId = existingAway.id;
          } else {
            const { data: newAway, error: awayError } = await supabase
              .from('teams')
              .insert({
                sport_id: row.sport_id,
                name: row.away_team_name,
                provider_team_key: `import:${awayNormalized}`,
              })
              .select()
              .single();

            if (awayError) {
              const { data: retryAway } = await supabase
                .from('teams')
                .select('id')
                .eq('sport_id', row.sport_id)
                .eq('provider_team_key', `import:${awayNormalized}`)
                .maybeSingle();
              
              if (retryAway) {
                awayTeamId = retryAway.id;
              } else {
                throw new Error(`Failed to upsert away team: ${awayError.message}`);
              }
            } else {
              awayTeamId = newAway.id;
              counters.teams_upserted++;
            }
          }
          if (!awayTeamId) {
            throw new Error('Failed to get away team ID');
          }
          teamCache.set(`${row.sport_id}:${awayNormalized}`, awayTeamId);
        }

        // Generate game key
        const gameKey = row.provider_game_key || await generateImportKey(row);
        const finalTotal = row.home_score + row.away_score;
        const playedDateLocal = getPlayedDateLocal(row.game_date_utc);
        const decade = computeDecade(row.game_date_utc);

        // Upsert game
        const { data: game, error: gameError } = await supabase
          .from('games')
          .upsert({
            sport_id: row.sport_id,
            provider_game_key: gameKey,
            start_time_utc: row.game_date_utc,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_score: row.home_score,
            away_score: row.away_score,
            final_total: finalTotal,
            status: 'final',
            season_year: row.season_year,
            decade: decade,
          }, {
            onConflict: 'provider_game_key',
          })
          .select()
          .single();

        if (gameError) {
          throw new Error(`Failed to upsert game: ${gameError.message}`);
        }
        counters.games_upserted++;

        // Create matchup_games with canonical ordering
        const [teamLowId, teamHighId] = homeTeamId < awayTeamId 
          ? [homeTeamId, awayTeamId] 
          : [awayTeamId, homeTeamId];

        const { error: matchupError } = await supabase
          .from('matchup_games')
          .upsert({
            sport_id: row.sport_id,
            team_low_id: teamLowId,
            team_high_id: teamHighId,
            game_id: game.id,
            played_at_utc: row.game_date_utc,
            total: finalTotal,
            season_year: row.season_year,
            decade: decade,
          }, {
            onConflict: 'game_id',
          });

        if (matchupError) {
          console.warn(`[IMPORT] Matchup upsert warning: ${matchupError.message}`);
        } else {
          counters.matchup_rows_upserted++;
        }

        counters.accepted++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${i}: ${message}`);
        counters.rejected++;
      }
    }

    // Update job run
    if (jobRun) {
      await supabase
        .from('job_runs')
        .update({
          status: counters.rejected > 0 ? 'completed_with_errors' : 'success',
          finished_at: new Date().toISOString(),
          details: { source, counters, errors_count: errors.length }
        })
        .eq('id', jobRun.id);
    }

    console.log(`[IMPORT] Completed: ${JSON.stringify(counters)}`);

    return new Response(JSON.stringify({
      ...counters,
      errors_sample: errors.slice(0, 10),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[IMPORT] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
