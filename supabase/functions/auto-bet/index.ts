import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// AUTOMATED BETTING ALGORITHM
// Executes the 95th percentile limit order strategy
// ============================================================

const KALSHI_BASE_URL = "https://trading-api.kalshi.com/trade-api/v2";
const KALSHI_DEMO_URL = "https://demo-api.kalshi.co/trade-api/v2";

interface BettingConfig {
  enabled: boolean;
  strong_edge_threshold: number;
  moderate_edge_threshold: number;
  weak_edge_threshold: number;
  max_position_size_cents: number;
  strong_position_pct: number;
  moderate_position_pct: number;
  weak_position_pct: number;
  max_daily_loss_cents: number;
  max_open_positions: number;
  min_edge_confidence: number;
  max_limit_price: number;
  min_limit_price: number;
  enabled_sports: string[];
}

interface Signal {
  game_id: string;
  sport_id: string;
  matchup: string;
  dk_line: number;
  percentile: number;
  p05: number;
  p95: number;
  n_h2h: number;
  signal: "OVER" | "UNDER";
  edge_strength: "STRONG" | "MODERATE" | "WEAK";
  start_time_utc: string;
}

interface OrderResult {
  signal: Signal;
  order_placed: boolean;
  order_id?: string;
  ticker?: string;
  side?: string;
  price?: number;
  count?: number;
  error?: string;
  skipped_reason?: string;
}

// ============================================================
// KALSHI API HELPERS
// ============================================================

async function signRequest(
  privateKeyPem: string,
  timestamp: string,
  method: string,
  path: string,
  body: string = ""
): Promise<string> {
  const message = `${timestamp}${method}${path}${body}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  const pemContents = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace("-----BEGIN RSA PRIVATE KEY-----", "")
    .replace("-----END RSA PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    key,
    data
  );

  return base64Encode(new Uint8Array(signature));
}

async function kalshiFetch(
  endpoint: string,
  apiKeyId: string,
  privateKey: string,
  method: string = "GET",
  body?: object,
  useDemo: boolean = false
): Promise<Response> {
  const baseUrl = useDemo ? KALSHI_DEMO_URL : KALSHI_BASE_URL;
  const url = `${baseUrl}${endpoint}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : "";

  const signature = await signRequest(privateKey, timestamp, method, endpoint, bodyStr);

  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "KALSHI-ACCESS-KEY": apiKeyId,
      "KALSHI-ACCESS-SIGNATURE": signature,
      "KALSHI-ACCESS-TIMESTAMP": timestamp,
    },
    body: bodyStr || undefined,
  });
}

// ============================================================
// SIGNAL GENERATION
// ============================================================

function categorizeSignal(percentile: number, config: BettingConfig): { signal: "OVER" | "UNDER" | null; strength: "STRONG" | "MODERATE" | "WEAK" } {
  // OVER: percentile is low (DK line below historical average)
  // UNDER: percentile is high (DK line above historical average)

  if (percentile <= config.strong_edge_threshold) {
    return { signal: "OVER", strength: "STRONG" };
  } else if (percentile <= config.moderate_edge_threshold) {
    return { signal: "OVER", strength: "MODERATE" };
  } else if (percentile <= config.weak_edge_threshold) {
    return { signal: "OVER", strength: "WEAK" };
  } else if (percentile >= 100 - config.strong_edge_threshold) {
    return { signal: "UNDER", strength: "STRONG" };
  } else if (percentile >= 100 - config.moderate_edge_threshold) {
    return { signal: "UNDER", strength: "MODERATE" };
  } else if (percentile >= 100 - config.weak_edge_threshold) {
    return { signal: "UNDER", strength: "WEAK" };
  }

  return { signal: null, strength: "WEAK" };
}

function calculatePositionSize(strength: "STRONG" | "MODERATE" | "WEAK", config: BettingConfig): number {
  const pctMap = {
    STRONG: config.strong_position_pct,
    MODERATE: config.moderate_position_pct,
    WEAK: config.weak_position_pct,
  };

  return Math.floor((config.max_position_size_cents * pctMap[strength]) / 100);
}

function calculateLimitPrice(percentile: number, signal: "OVER" | "UNDER", config: BettingConfig): number {
  // The further from 50, the more edge we have, the more we're willing to pay
  // But never exceed max_limit_price

  const distanceFrom50 = Math.abs(50 - percentile);
  // Scale: 0 distance = 50 cents, 50 distance = max_limit_price
  const basePrice = 50 + (distanceFrom50 / 50) * (config.max_limit_price - 50);

  return Math.min(Math.max(Math.round(basePrice), config.min_limit_price), config.max_limit_price);
}

// ============================================================
// MAIN ALGORITHM
// ============================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const results: OrderResult[] = [];
  const counters = {
    signals_found: 0,
    signals_with_edge: 0,
    orders_attempted: 0,
    orders_placed: 0,
    orders_skipped: 0,
    errors: 0,
  };

  let jobRunId: number | null = null;

  try {
    // Get Kalshi credentials
    const kalshiKeyId = Deno.env.get("KALSHI_API_KEY_ID");
    const kalshiPrivateKey = Deno.env.get("KALSHI_PRIVATE_KEY");
    const useDemo = Deno.env.get("KALSHI_USE_DEMO") === "true";

    if (!kalshiKeyId || !kalshiPrivateKey) {
      return new Response(
        JSON.stringify({ error: "Kalshi credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let requestBody: { dry_run?: boolean; sport_id?: string } = {};
    try {
      requestBody = await req.json();
    } catch {
      // Empty body OK
    }

    const dryRun = requestBody.dry_run ?? false;
    const sportFilter = requestBody.sport_id;

    // Create job run
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "auto-bet",
        details: { dry_run: dryRun, sport_filter: sportFilter, use_demo: useDemo },
      })
      .select()
      .single();

    jobRunId = jobRun?.id || null;

    // Load betting config
    const { data: configData } = await supabase
      .from("betting_config")
      .select("*")
      .eq("name", "default")
      .single();

    const config: BettingConfig = configData || {
      enabled: true,
      strong_edge_threshold: 5,
      moderate_edge_threshold: 15,
      weak_edge_threshold: 25,
      max_position_size_cents: 1000,
      strong_position_pct: 100,
      moderate_position_pct: 50,
      weak_position_pct: 25,
      max_daily_loss_cents: 5000,
      max_open_positions: 10,
      min_edge_confidence: 5,
      max_limit_price: 70,
      min_limit_price: 30,
      enabled_sports: ["nba", "nfl", "nhl", "mlb"],
    };

    if (!config.enabled && !dryRun) {
      return new Response(
        JSON.stringify({ success: true, message: "Auto-betting is disabled", counters }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check daily P&L limit
    const today = new Date().toISOString().split("T")[0];
    const { data: dailyPnl } = await supabase
      .from("daily_pnl")
      .select("net_pnl_cents")
      .eq("date_local", today)
      .single();

    if (dailyPnl && dailyPnl.net_pnl_cents < -config.max_daily_loss_cents && !dryRun) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Daily loss limit reached",
          daily_pnl: dailyPnl.net_pnl_cents,
          limit: -config.max_daily_loss_cents,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current open positions count
    const { count: openPositions } = await supabase
      .from("kalshi_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "filled")
      .is("result", null);

    if ((openPositions || 0) >= config.max_open_positions && !dryRun) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Max open positions reached",
          open_positions: openPositions,
          limit: config.max_open_positions,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch today's edges with signals
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayLocal = formatter.format(now);

    let query = supabase
      .from("daily_edges")
      .select(`
        game_id,
        sport_id,
        dk_total_line,
        dk_line_percentile,
        p05,
        p95,
        n_h2h,
        games!inner(
          id,
          start_time_utc,
          status,
          home_team:teams!games_home_team_id_fkey(name, abbrev),
          away_team:teams!games_away_team_id_fkey(name, abbrev)
        )
      `)
      .eq("date_local", todayLocal)
      .not("dk_line_percentile", "is", null)
      .gte("n_h2h", config.min_edge_confidence);

    if (sportFilter) {
      query = query.eq("sport_id", sportFilter);
    } else {
      query = query.in("sport_id", config.enabled_sports);
    }

    const { data: edges, error: edgeError } = await query;

    if (edgeError) {
      throw new Error(`Failed to fetch edges: ${edgeError.message}`);
    }

    counters.signals_found = edges?.length || 0;

    // Process each edge
    for (const edge of edges || []) {
      const game = edge.games as any;
      if (!game || game.status === "final") continue;

      // Check if game starts soon (within 6 hours)
      const gameStart = new Date(game.start_time_utc);
      const hoursUntilStart = (gameStart.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilStart < 0 || hoursUntilStart > 6) {
        continue; // Skip games that already started or are too far out
      }

      const percentile = edge.dk_line_percentile;
      const { signal, strength } = categorizeSignal(percentile, config);

      if (!signal) continue;

      counters.signals_with_edge++;

      const signalData: Signal = {
        game_id: edge.game_id,
        sport_id: edge.sport_id,
        matchup: `${game.away_team?.abbrev || "Away"} @ ${game.home_team?.abbrev || "Home"}`,
        dk_line: edge.dk_total_line,
        percentile,
        p05: edge.p05,
        p95: edge.p95,
        n_h2h: edge.n_h2h,
        signal,
        edge_strength: strength,
        start_time_utc: game.start_time_utc,
      };

      // Check if we already have an order for this game
      const { data: existingOrder } = await supabase
        .from("kalshi_orders")
        .select("id")
        .eq("game_id", edge.game_id)
        .not("status", "eq", "cancelled")
        .maybeSingle();

      if (existingOrder) {
        results.push({
          signal: signalData,
          order_placed: false,
          skipped_reason: "Already have order for this game",
        });
        counters.orders_skipped++;
        continue;
      }

      // Calculate position size and limit price
      const positionSizeCents = calculatePositionSize(strength, config);
      const limitPrice = calculateLimitPrice(percentile, signal, config);
      const contractCount = Math.floor(positionSizeCents / limitPrice);

      if (contractCount < 1) {
        results.push({
          signal: signalData,
          order_placed: false,
          skipped_reason: "Position size too small for limit price",
        });
        counters.orders_skipped++;
        continue;
      }

      // Build Kalshi ticker (this would need to be matched to actual Kalshi market tickers)
      // For now, we'll construct a placeholder - in production this needs market matching
      const sportPrefix = edge.sport_id.toUpperCase();
      const ticker = `KX${sportPrefix}TOTAL-${todayLocal.replace(/-/g, "")}`;

      counters.orders_attempted++;

      if (dryRun) {
        // Don't actually place the order in dry run mode
        results.push({
          signal: signalData,
          order_placed: false,
          ticker,
          side: signal === "OVER" ? "yes" : "no",
          price: limitPrice,
          count: contractCount,
          skipped_reason: "DRY RUN - Order not placed",
        });
        counters.orders_skipped++;
        continue;
      }

      // Place the order
      try {
        const orderBody = {
          ticker,
          action: "buy",
          side: signal === "OVER" ? "yes" : "no",
          type: "limit",
          count: contractCount,
          yes_price: signal === "OVER" ? limitPrice : undefined,
          no_price: signal === "UNDER" ? limitPrice : undefined,
        };

        const response = await kalshiFetch(
          "/portfolio/orders",
          kalshiKeyId,
          kalshiPrivateKey,
          "POST",
          orderBody,
          useDemo
        );

        const data = await response.json();

        if (response.ok && data.order) {
          // Log successful order
          await supabase.from("kalshi_orders").insert({
            ticker,
            side: signal === "OVER" ? "yes" : "no",
            count: contractCount,
            price: limitPrice,
            order_type: "limit",
            order_id: data.order.order_id,
            success: true,
            game_id: edge.game_id,
            edge_percentile: percentile,
            signal_type: signal,
            edge_strength: strength,
            is_demo: useDemo,
            status: "pending",
          });

          results.push({
            signal: signalData,
            order_placed: true,
            order_id: data.order.order_id,
            ticker,
            side: signal === "OVER" ? "yes" : "no",
            price: limitPrice,
            count: contractCount,
          });
          counters.orders_placed++;
        } else {
          // Log failed order
          await supabase.from("kalshi_orders").insert({
            ticker,
            side: signal === "OVER" ? "yes" : "no",
            count: contractCount,
            price: limitPrice,
            order_type: "limit",
            success: false,
            error: data.error || "Order failed",
            game_id: edge.game_id,
            edge_percentile: percentile,
            signal_type: signal,
            edge_strength: strength,
            is_demo: useDemo,
          });

          results.push({
            signal: signalData,
            order_placed: false,
            ticker,
            error: data.error || "Order failed",
          });
          counters.errors++;
        }
      } catch (err) {
        results.push({
          signal: signalData,
          order_placed: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        counters.errors++;
      }
    }

    // Update job run
    if (jobRunId) {
      await supabase
        .from("job_runs")
        .update({
          status: counters.errors > 0 ? "partial" : "success",
          finished_at: new Date().toISOString(),
          details: {
            dry_run: dryRun,
            use_demo: useDemo,
            counters,
            results_count: results.length,
          },
        })
        .eq("id", jobRunId);
    }

    console.log(`[AUTO-BET] Complete: ${JSON.stringify(counters)}`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        environment: useDemo ? "demo" : "production",
        counters,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[AUTO-BET] Fatal error:", error);

    if (jobRunId) {
      await supabase
        .from("job_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          details: { error: error instanceof Error ? error.message : "Unknown error", counters },
        })
        .eq("id", jobRunId);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", counters }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
