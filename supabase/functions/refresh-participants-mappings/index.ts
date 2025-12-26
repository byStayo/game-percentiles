import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sport key mappings
const SPORT_CONFIGS: Record<string, { oddsKey: string; isSoccer: boolean }> = {
  nfl: { oddsKey: 'americanfootball_nfl', isSoccer: false },
  nba: { oddsKey: 'basketball_nba', isSoccer: false },
  mlb: { oddsKey: 'baseball_mlb', isSoccer: false },
  nhl: { oddsKey: 'icehockey_nhl', isSoccer: false },
  soccer: { oddsKey: 'soccer_usa_mls', isSoccer: true },
}

// Abbreviation expansions for US sports
const ABBREV_EXPANSIONS: Record<string, string> = {
  'la': 'los angeles',
  'ny': 'new york',
  'nj': 'new jersey',
  'sf': 'san francisco',
  'kc': 'kansas city',
  'tb': 'tampa bay',
  'gb': 'green bay',
  'okc': 'oklahoma city',
  'no': 'new orleans',
  'dc': 'washington dc',
  'd.c.': 'washington dc',
}

// Soccer tokens to strip
const SOCCER_STRIP_TOKENS = ['fc', 'cf', 'sc', 'afc', 'c.f.', 'f.c.', 's.c.', 'a.f.c.', 'united', 'utd', 'city']

// Normalize team name for comparison
function normalizeTeamName(name: string, isSoccer: boolean = false): string {
  let normalized = name.toLowerCase().trim()
  
  // Remove punctuation except spaces
  normalized = normalized.replace(/[^\w\s]/g, ' ')
  
  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  // For soccer, strip common tokens
  if (isSoccer) {
    for (const token of SOCCER_STRIP_TOKENS) {
      normalized = normalized.replace(new RegExp(`\\b${token}\\b`, 'gi'), '')
    }
    normalized = normalized.replace(/\s+/g, ' ').trim()
  }
  
  return normalized
}

// Generate aliases for a team
function generateAliases(team: { name: string; abbrev?: string | null }, isSoccer: boolean): string[] {
  const aliases: string[] = []
  const name = team.name || ''
  
  // Add the full name
  aliases.push(normalizeTeamName(name, isSoccer))
  
  if (!isSoccer) {
    // For US sports, the name format is usually just the team name (e.g., "Lakers", "Knicks")
    // or "City TeamName" format
    const parts = name.split(' ')
    
    // If it looks like "City TeamName", add just the team name
    if (parts.length >= 2) {
      aliases.push(normalizeTeamName(parts[parts.length - 1], false))
      // Also add last two words for names like "Trail Blazers"
      if (parts.length >= 3) {
        aliases.push(normalizeTeamName(parts.slice(-2).join(' '), false))
      }
    }
    
    // Add abbreviation if available
    if (team.abbrev) {
      aliases.push(normalizeTeamName(team.abbrev, false))
      // Expand abbreviation
      const abbrevLower = team.abbrev.toLowerCase()
      if (ABBREV_EXPANSIONS[abbrevLower]) {
        aliases.push(normalizeTeamName(ABBREV_EXPANSIONS[abbrevLower], false))
      }
    }
  } else {
    // For soccer, also add stripped version
    aliases.push(normalizeTeamName(name, true))
    
    // Add individual significant words
    const words = name.split(' ').filter(w => w.length > 2 && !SOCCER_STRIP_TOKENS.includes(w.toLowerCase()))
    for (const word of words) {
      aliases.push(normalizeTeamName(word, true))
    }
  }
  
  // Remove duplicates and empty strings
  return [...new Set(aliases)].filter(a => a.length > 0)
}

// Calculate similarity between two strings (Jaccard similarity on character trigrams)
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  if (!str1 || !str2) return 0
  
  const getTrigrams = (s: string): Set<string> => {
    const trigrams = new Set<string>()
    const padded = `  ${s}  `
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.add(padded.slice(i, i + 3))
    }
    return trigrams
  }
  
  const trigrams1 = getTrigrams(str1)
  const trigrams2 = getTrigrams(str2)
  
  const intersection = new Set([...trigrams1].filter(t => trigrams2.has(t)))
  const union = new Set([...trigrams1, ...trigrams2])
  
  return intersection.size / union.size
}

// Find best match for an Odds API team name
function findBestMatch(
  oddsTeamName: string,
  teams: Array<{ id: string; name: string; abbrev: string | null }>,
  isSoccer: boolean
): { teamId: string; confidence: number; method: string } | null {
  const normalizedOdds = normalizeTeamName(oddsTeamName, isSoccer)
  
  let bestMatch: { teamId: string; confidence: number; method: string } | null = null
  
  for (const team of teams) {
    const aliases = generateAliases(team, isSoccer)
    
    // Check for exact match first
    if (aliases.includes(normalizedOdds)) {
      return { teamId: team.id, confidence: 1.0, method: 'exact' }
    }
    
    // Check for alias containment
    for (const alias of aliases) {
      if (normalizedOdds.includes(alias) || alias.includes(normalizedOdds)) {
        const confidence = Math.min(alias.length, normalizedOdds.length) / Math.max(alias.length, normalizedOdds.length)
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { teamId: team.id, confidence: Math.max(0.85, confidence), method: 'alias' }
        }
      }
    }
    
    // Fuzzy match on all aliases
    for (const alias of aliases) {
      const similarity = calculateSimilarity(normalizedOdds, alias)
      if (similarity > 0.7 && (!bestMatch || similarity > bestMatch.confidence)) {
        bestMatch = { teamId: team.id, confidence: similarity, method: 'fuzzy' }
      }
    }
  }
  
  return bestMatch
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let jobRunId: number | null = null

  try {
    const oddsApiKey = Deno.env.get('ODDS_API_KEY')
    if (!oddsApiKey) {
      throw new Error('ODDS_API_KEY not configured')
    }

    const body = await req.json().catch(() => ({}))
    const targetSportId = body.sport_id

    console.log(`Refreshing participant mappings${targetSportId ? ` for ${targetSportId}` : ' for all sports'}`)

    // Create job run
    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ job_name: 'participants_mapping', details: { sport_id: targetSportId || 'all' } })
      .select()
      .single()

    jobRunId = jobRun?.id || null

    const results: Record<string, { total: number; mapped: number; failed: string[] }> = {}

    const sportsToProcess = targetSportId 
      ? { [targetSportId]: SPORT_CONFIGS[targetSportId] }
      : SPORT_CONFIGS

    for (const [sportId, config] of Object.entries(sportsToProcess)) {
      if (!config) continue

      console.log(`Processing ${sportId} (${config.oddsKey})`)

      // Fetch participants from Odds API
      const participantsUrl = `https://api.the-odds-api.com/v4/sports/${config.oddsKey}/participants?apiKey=${oddsApiKey}`
      
      const response = await fetch(participantsUrl)
      if (!response.ok) {
        console.error(`Participants API error for ${sportId}:`, response.status)
        results[sportId] = { total: 0, mapped: 0, failed: [`API error: ${response.status}`] }
        continue
      }

      const participants = await response.json()
      console.log(`Found ${participants.length} participants for ${sportId}`)

      // Get all teams for this sport from our database
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, abbrev')
        .eq('sport_id', sportId)

      if (!teams || teams.length === 0) {
        console.log(`No teams found in database for ${sportId}`)
        results[sportId] = { total: participants.length, mapped: 0, failed: ['No teams in database'] }
        continue
      }

      const sportResults = { total: participants.length, mapped: 0, failed: [] as string[] }

      for (const participant of participants) {
        const participantName = participant.name || participant
        if (typeof participantName !== 'string') continue

        const match = findBestMatch(participantName, teams, config.isSoccer)

        if (match && match.confidence >= 0.75) {
          // Upsert mapping
          await supabase
            .from('provider_mappings')
            .upsert({
              sport_id: sportId,
              team_id: match.teamId,
              odds_api_team_name: participantName,
              odds_sport_key: config.oddsKey,
              confidence: match.confidence,
              method: match.method,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'sport_id,league_id,team_id' })

          sportResults.mapped++
        } else {
          sportResults.failed.push(participantName)
          console.log(`Could not match: ${participantName} (best confidence: ${match?.confidence || 0})`)
        }
      }

      results[sportId] = sportResults
    }

    // Calculate overall coverage
    const totalTeams = Object.values(results).reduce((sum, r) => sum + r.total, 0)
    const mappedTeams = Object.values(results).reduce((sum, r) => sum + r.mapped, 0)
    const coverage = totalTeams > 0 ? (mappedTeams / totalTeams) * 100 : 0

    // Update job run
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          details: { 
            sport_id: targetSportId || 'all',
            results,
            coverage_percent: coverage.toFixed(1)
          }
        })
        .eq('id', jobRunId)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        coverage_percent: coverage.toFixed(1)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Participants mapping error:', error)
    
    if (jobRunId) {
      await supabase
        .from('job_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'fail',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        })
        .eq('id', jobRunId)
    }
    
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
