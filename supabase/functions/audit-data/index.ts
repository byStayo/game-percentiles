import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditResult {
  sport_id: string;
  check_name: string;
  status: 'pass' | 'fail' | 'warn';
  details: string;
  count?: number;
  examples?: any[];
}

interface AuditReport {
  started_at: string;
  finished_at: string;
  sports: string[];
  total_checks: number;
  passed: number;
  failed: number;
  warnings: number;
  results: AuditResult[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const sports = ['nba', 'nfl', 'mlb', 'nhl'];
  const requestedSport = url.searchParams.get('sport');
  const sportsToAudit = requestedSport ? [requestedSport] : sports;

  console.log(`[audit-data] Starting comprehensive audit for: ${sportsToAudit.join(', ')}`);

  const startedAt = new Date().toISOString();
  const results: AuditResult[] = [];

  try {
    for (const sport of sportsToAudit) {
      console.log(`[audit-data] Auditing ${sport.toUpperCase()}...`);

      // ========================================
      // CHECK 1: Games with missing scores for final status
      // ========================================
      const { data: gamesNoScores, error: gnsErr } = await supabase
        .from('games')
        .select('id, start_time_utc, status, home_score, away_score')
        .eq('sport_id', sport)
        .eq('status', 'final')
        .or('home_score.is.null,away_score.is.null')
        .limit(10);

      if (gnsErr) {
        console.error(`[audit-data] ${sport} games no scores query error:`, gnsErr);
      }

      results.push({
        sport_id: sport,
        check_name: 'final_games_have_scores',
        status: (gamesNoScores?.length || 0) === 0 ? 'pass' : 'fail',
        details: `Found ${gamesNoScores?.length || 0} final games missing scores`,
        count: gamesNoScores?.length || 0,
        examples: gamesNoScores?.slice(0, 5),
      });

      // ========================================
      // CHECK 2: Games with final_total mismatch (home + away != final_total)
      // ========================================
      const { data: totalMismatch, error: tmErr } = await supabase
        .from('games')
        .select('id, start_time_utc, home_score, away_score, final_total')
        .eq('sport_id', sport)
        .eq('status', 'final')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .not('final_total', 'is', null)
        .limit(500);

      if (tmErr) {
        console.error(`[audit-data] ${sport} total mismatch query error:`, tmErr);
      }

      const mismatchedTotals = totalMismatch?.filter(g => 
        Math.abs((g.home_score + g.away_score) - g.final_total) > 0.01
      ) || [];

      results.push({
        sport_id: sport,
        check_name: 'final_total_matches_sum',
        status: mismatchedTotals.length === 0 ? 'pass' : 'fail',
        details: `Found ${mismatchedTotals.length} games where final_total != home_score + away_score`,
        count: mismatchedTotals.length,
        examples: mismatchedTotals.slice(0, 5).map(g => ({
          id: g.id,
          home_score: g.home_score,
          away_score: g.away_score,
          final_total: g.final_total,
          expected: g.home_score + g.away_score,
        })),
      });

      // ========================================
      // CHECK 3: Odds snapshots with null total_line for totals market
      // ========================================
      const { data: oddsMissingLine } = await supabase
        .from('odds_snapshots')
        .select('id, game_id, bookmaker, market, total_line, fetched_at')
        .eq('market', 'totals')
        .is('total_line', null)
        .limit(100);

      // Filter by sport through games join
      const { data: gamesForSport } = await supabase
        .from('games')
        .select('id')
        .eq('sport_id', sport);

      const sportGameIds = new Set(gamesForSport?.map(g => g.id) || []);
      const sportOddsMissing = oddsMissingLine?.filter(o => sportGameIds.has(o.game_id)) || [];

      results.push({
        sport_id: sport,
        check_name: 'odds_totals_have_line',
        status: sportOddsMissing.length === 0 ? 'pass' : 'warn',
        details: `Found ${sportOddsMissing.length} totals odds snapshots with null total_line`,
        count: sportOddsMissing.length,
        examples: sportOddsMissing.slice(0, 5),
      });

      // ========================================
      // CHECK 4: daily_edges with dk_offered but null dk_total_line
      // ========================================
      const { data: edgesMissingLine } = await supabase
        .from('daily_edges')
        .select('id, game_id, dk_offered, dk_total_line, date_local')
        .eq('sport_id', sport)
        .eq('dk_offered', true)
        .is('dk_total_line', null)
        .limit(50);

      results.push({
        sport_id: sport,
        check_name: 'edges_dk_line_when_offered',
        status: (edgesMissingLine?.length || 0) === 0 ? 'pass' : 'fail',
        details: `Found ${edgesMissingLine?.length || 0} edges with dk_offered=true but null dk_total_line`,
        count: edgesMissingLine?.length || 0,
        examples: edgesMissingLine?.slice(0, 5),
      });

      // ========================================
      // CHECK 5: daily_edges percentile sanity (should be 0-100)
      // ========================================
      const { data: badPercentiles } = await supabase
        .from('daily_edges')
        .select('id, game_id, dk_line_percentile')
        .eq('sport_id', sport)
        .not('dk_line_percentile', 'is', null)
        .or('dk_line_percentile.lt.0,dk_line_percentile.gt.100')
        .limit(50);

      results.push({
        sport_id: sport,
        check_name: 'percentiles_in_range',
        status: (badPercentiles?.length || 0) === 0 ? 'pass' : 'fail',
        details: `Found ${badPercentiles?.length || 0} edges with percentile outside 0-100`,
        count: badPercentiles?.length || 0,
        examples: badPercentiles?.slice(0, 5),
      });

      // ========================================
      // CHECK 6: Team seasons with null wins/losses
      // ========================================
      const { data: seasonsNoRecord } = await supabase
        .from('team_seasons')
        .select('id, team_id, season_year, wins, losses')
        .eq('sport_id', sport)
        .or('wins.is.null,losses.is.null')
        .limit(50);

      results.push({
        sport_id: sport,
        check_name: 'team_seasons_have_record',
        status: (seasonsNoRecord?.length || 0) === 0 ? 'pass' : 'warn',
        details: `Found ${seasonsNoRecord?.length || 0} team seasons with null wins or losses`,
        count: seasonsNoRecord?.length || 0,
        examples: seasonsNoRecord?.slice(0, 5),
      });

      // ========================================
      // CHECK 7: Team seasons with missing conference/division
      // ========================================
      const { data: seasonsNoDiv } = await supabase
        .from('team_seasons')
        .select('id, team_id, season_year, conference, division')
        .eq('sport_id', sport)
        .or('conference.is.null,division.is.null')
        .limit(50);

      results.push({
        sport_id: sport,
        check_name: 'team_seasons_have_conf_div',
        status: (seasonsNoDiv?.length || 0) === 0 ? 'pass' : 'warn',
        details: `Found ${seasonsNoDiv?.length || 0} team seasons missing conference or division`,
        count: seasonsNoDiv?.length || 0,
        examples: seasonsNoDiv?.slice(0, 5),
      });

      // ========================================
      // CHECK 8: Teams with missing abbrev
      // ========================================
      const { data: teamsNoAbbrev } = await supabase
        .from('teams')
        .select('id, name, abbrev, city')
        .eq('sport_id', sport)
        .is('abbrev', null)
        .limit(50);

      results.push({
        sport_id: sport,
        check_name: 'teams_have_abbrev',
        status: (teamsNoAbbrev?.length || 0) === 0 ? 'pass' : 'warn',
        details: `Found ${teamsNoAbbrev?.length || 0} teams missing abbreviation`,
        count: teamsNoAbbrev?.length || 0,
        examples: teamsNoAbbrev?.slice(0, 5),
      });

      // ========================================
      // CHECK 9: Matchup stats with insufficient games
      // ========================================
      const { data: matchupStats } = await supabase
        .from('matchup_stats')
        .select('id, team_high_id, team_low_id, n_games, median, p05, p95')
        .eq('sport_id', sport)
        .lt('n_games', 3)
        .limit(50);

      results.push({
        sport_id: sport,
        check_name: 'matchup_stats_sufficient_games',
        status: (matchupStats?.length || 0) < 20 ? 'pass' : 'warn',
        details: `Found ${matchupStats?.length || 0} matchup stats with fewer than 3 historical games`,
        count: matchupStats?.length || 0,
      });

      // ========================================
      // CHECK 10: Orphaned daily_edges (no matching game)
      // Using a different approach: get edges and check if their game exists
      // ========================================
      const { data: edgesWithGameCheck } = await supabase
        .from('daily_edges')
        .select('id, game_id, games!inner(id)')
        .eq('sport_id', sport)
        .limit(1);

      // If we can query with inner join, there are no orphans for sampled edges
      // For a proper count, we check edges without games
      const { count: totalEdgesCount } = await supabase
        .from('daily_edges')
        .select('id', { count: 'exact', head: true })
        .eq('sport_id', sport);

      // Sample check: get some edges and verify their games exist
      const { data: sampleEdges } = await supabase
        .from('daily_edges')
        .select('id, game_id')
        .eq('sport_id', sport)
        .limit(50);

      // Verify each sample edge's game exists
      let orphanedCount = 0;
      const orphanedExamples: any[] = [];
      
      if (sampleEdges) {
        for (const edge of sampleEdges) {
          const { data: gameExists } = await supabase
            .from('games')
            .select('id')
            .eq('id', edge.game_id)
            .maybeSingle();
          
          if (!gameExists) {
            orphanedCount++;
            if (orphanedExamples.length < 5) {
              orphanedExamples.push(edge);
            }
          }
        }
      }

      results.push({
        sport_id: sport,
        check_name: 'edges_have_matching_game',
        status: orphanedCount === 0 ? 'pass' : 'fail',
        details: `Sampled ${sampleEdges?.length || 0} edges, found ${orphanedCount} with no matching game`,
        count: orphanedCount,
        examples: orphanedExamples,
      });

      // ========================================
      // CHECK 11: Verify DK odds consistency with edges
      // ========================================
      const { data: recentEdges } = await supabase
        .from('daily_edges')
        .select('id, game_id, dk_total_line, dk_line_percentile')
        .eq('sport_id', sport)
        .eq('dk_offered', true)
        .not('dk_total_line', 'is', null)
        .order('date_local', { ascending: false })
        .limit(100);

      // Cross-check with odds_snapshots
      const edgeGameIds = recentEdges?.map(e => e.game_id) || [];
      const { data: oddsForEdges } = await supabase
        .from('odds_snapshots')
        .select('game_id, total_line, fetched_at')
        .eq('bookmaker', 'draftkings')
        .in('game_id', edgeGameIds.slice(0, 50))
        .order('fetched_at', { ascending: false });

      // Build latest odds map
      const latestOdds = new Map<string, number>();
      oddsForEdges?.forEach(o => {
        if (o.total_line && !latestOdds.has(o.game_id)) {
          latestOdds.set(o.game_id, o.total_line);
        }
      });

      // Compare
      const lineMismatches: any[] = [];
      recentEdges?.forEach(e => {
        const snapshotLine = latestOdds.get(e.game_id);
        if (snapshotLine !== undefined && Math.abs(snapshotLine - (e.dk_total_line || 0)) > 0.5) {
          lineMismatches.push({
            game_id: e.game_id,
            edge_line: e.dk_total_line,
            snapshot_line: snapshotLine,
            diff: Math.abs(snapshotLine - (e.dk_total_line || 0)),
          });
        }
      });

      results.push({
        sport_id: sport,
        check_name: 'dk_edge_matches_snapshot',
        status: lineMismatches.length === 0 ? 'pass' : 'warn',
        details: `Found ${lineMismatches.length} edges where dk_total_line differs from latest snapshot by >0.5`,
        count: lineMismatches.length,
        examples: lineMismatches.slice(0, 5),
      });

      // ========================================
      // CHECK 12: Playoff results have valid values
      // ========================================
      const validPlayoffResults = [
        'Champion', 'Finals', 'Conf Finals', 'Semis', 'First Round',
        'Super Bowl', 'Conf Champ', 'Div Round', 'Wild Card',
        'World Series', 'LCS', 'LDS', 'Wild Card',
        'Stanley Cup', 'Conf Final', 'Second Round'
      ];

      const { data: playoffData } = await supabase
        .from('team_seasons')
        .select('id, team_id, season_year, playoff_result')
        .eq('sport_id', sport)
        .not('playoff_result', 'is', null);

      const invalidPlayoffs = playoffData?.filter(p => 
        !validPlayoffResults.some(v => p.playoff_result?.includes(v))
      ) || [];

      results.push({
        sport_id: sport,
        check_name: 'playoff_results_valid',
        status: invalidPlayoffs.length === 0 ? 'pass' : 'warn',
        details: `Found ${invalidPlayoffs.length} team seasons with unrecognized playoff_result`,
        count: invalidPlayoffs.length,
        examples: invalidPlayoffs.slice(0, 5),
      });

      console.log(`[audit-data] ${sport.toUpperCase()} complete`);
    }

    const finishedAt = new Date().toISOString();
    
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const warnings = results.filter(r => r.status === 'warn').length;

    const report: AuditReport = {
      started_at: startedAt,
      finished_at: finishedAt,
      sports: sportsToAudit,
      total_checks: results.length,
      passed,
      failed,
      warnings,
      results,
    };

    // Log the report to job_runs
    const { error: insertErr } = await supabase
      .from('job_runs')
      .insert({
        job_name: 'audit-data',
        status: failed > 0 ? 'completed_with_errors' : 'completed',
        started_at: startedAt,
        finished_at: finishedAt,
        details: report,
      });

    if (insertErr) {
      console.error('[audit-data] Failed to insert job run:', insertErr);
    }

    console.log(`[audit-data] Audit complete. Passed: ${passed}, Failed: ${failed}, Warnings: ${warnings}`);

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[audit-data] Error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
