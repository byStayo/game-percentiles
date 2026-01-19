import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Kalshi API Configuration
const KALSHI_BASE_URL = "https://trading-api.kalshi.com/trade-api/v2";
const KALSHI_DEMO_URL = "https://demo-api.kalshi.co/trade-api/v2";

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  status: string;
  result: string | null;
  close_time: string;
  expiration_time: string;
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  sub_title: string;
  markets: KalshiMarket[];
}

interface EdgeGame {
  game_id: string;
  sport_id: string;
  home_team: string;
  away_team: string;
  dk_total_line: number;
  dk_line_percentile: number;
  p05: number;
  p95: number;
  start_time_utc: string;
}

interface BetSignal {
  game_id: string;
  sport_id: string;
  matchup: string;
  dk_line: number;
  percentile: number;
  p05: number;
  p95: number;
  signal: "OVER" | "UNDER" | "NO_EDGE";
  edge_strength: "STRONG" | "MODERATE" | "WEAK";
  recommended_price: number;
  kalshi_ticker: string | null;
  kalshi_market_price: number | null;
}

// ============================================================
// KALSHI API AUTHENTICATION (RSA-PSS Signature)
// ============================================================

async function signRequest(
  privateKeyPem: string,
  timestamp: string,
  method: string,
  path: string,
  body: string = ""
): Promise<string> {
  // Create the message to sign: timestamp + method + path + body
  const message = `${timestamp}${method}${path}${body}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // Import the private key
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
    {
      name: "RSA-PSS",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Sign the message
  const signature = await crypto.subtle.sign(
    {
      name: "RSA-PSS",
      saltLength: 32,
    },
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

  const signature = await signRequest(
    privateKey,
    timestamp,
    method,
    endpoint,
    bodyStr
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "KALSHI-ACCESS-KEY": apiKeyId,
    "KALSHI-ACCESS-SIGNATURE": signature,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  return response;
}

// ============================================================
// KALSHI MARKET DATA
// ============================================================

async function fetchKalshiSportsMarkets(
  apiKeyId: string,
  privateKey: string,
  useDemo: boolean = false
): Promise<KalshiEvent[]> {
  const events: KalshiEvent[] = [];
  let cursor: string | null = null;

  // Fetch sports-related events
  const sportCategories = ["sports", "nfl", "nba", "mlb", "nhl"];

  for (const category of sportCategories) {
    try {
      const endpoint = `/events?status=open&series_ticker=${category}&limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const response = await kalshiFetch(endpoint, apiKeyId, privateKey, "GET", undefined, useDemo);

      if (response.ok) {
        const data = await response.json();
        events.push(...(data.events || []));
      }
    } catch (err) {
      console.log(`[KALSHI] Error fetching ${category} events:`, err);
    }
  }

  return events;
}

async function fetchMarketDetails(
  ticker: string,
  apiKeyId: string,
  privateKey: string,
  useDemo: boolean = false
): Promise<KalshiMarket | null> {
  try {
    const endpoint = `/markets/${ticker}`;
    const response = await kalshiFetch(endpoint, apiKeyId, privateKey, "GET", undefined, useDemo);

    if (response.ok) {
      const data = await response.json();
      return data.market;
    }
  } catch (err) {
    console.log(`[KALSHI] Error fetching market ${ticker}:`, err);
  }
  return null;
}

// ============================================================
// ORDER PLACEMENT
// ============================================================

interface PlaceOrderParams {
  ticker: string;
  side: "yes" | "no";
  type: "limit" | "market";
  count: number;  // Number of contracts
  yes_price?: number;  // Price in cents (1-99)
  no_price?: number;
  expiration_ts?: number;  // Unix timestamp for order expiration
}

async function placeOrder(
  params: PlaceOrderParams,
  apiKeyId: string,
  privateKey: string,
  useDemo: boolean = false
): Promise<{ success: boolean; order_id?: string; error?: string }> {
  const endpoint = "/portfolio/orders";

  const orderBody = {
    ticker: params.ticker,
    action: "buy",
    side: params.side,
    type: params.type,
    count: params.count,
    ...(params.yes_price && { yes_price: params.yes_price }),
    ...(params.no_price && { no_price: params.no_price }),
    ...(params.expiration_ts && { expiration_ts: params.expiration_ts }),
  };

  try {
    const response = await kalshiFetch(endpoint, apiKeyId, privateKey, "POST", orderBody, useDemo);
    const data = await response.json();

    if (response.ok) {
      return { success: true, order_id: data.order?.order_id };
    } else {
      return { success: false, error: data.error || "Order failed" };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function getPortfolio(
  apiKeyId: string,
  privateKey: string,
  useDemo: boolean = false
): Promise<{ balance: number; positions: any[] }> {
  try {
    const [balanceRes, positionsRes] = await Promise.all([
      kalshiFetch("/portfolio/balance", apiKeyId, privateKey, "GET", undefined, useDemo),
      kalshiFetch("/portfolio/positions", apiKeyId, privateKey, "GET", undefined, useDemo),
    ]);

    const balance = balanceRes.ok ? (await balanceRes.json()).balance : 0;
    const positions = positionsRes.ok ? (await positionsRes.json()).market_positions : [];

    return { balance, positions };
  } catch (err) {
    console.log("[KALSHI] Error fetching portfolio:", err);
    return { balance: 0, positions: [] };
  }
}

// ============================================================
// EDGE DETECTION & SIGNAL GENERATION
// ============================================================

function generateBetSignal(edge: EdgeGame): BetSignal {
  const percentile = edge.dk_line_percentile;
  const p05 = edge.p05;
  const p95 = edge.p95;

  let signal: "OVER" | "UNDER" | "NO_EDGE" = "NO_EDGE";
  let edgeStrength: "STRONG" | "MODERATE" | "WEAK" = "WEAK";
  let recommendedPrice = 50; // Default to 50 cents (fair value)

  // OVER signal: DK line is near or below p05 (historically low)
  // UNDER signal: DK line is near or above p95 (historically high)

  if (percentile <= 5) {
    signal = "OVER";
    edgeStrength = "STRONG";
    recommendedPrice = 70; // Willing to pay up to 70 cents for YES on over
  } else if (percentile <= 15) {
    signal = "OVER";
    edgeStrength = "MODERATE";
    recommendedPrice = 60;
  } else if (percentile <= 25) {
    signal = "OVER";
    edgeStrength = "WEAK";
    recommendedPrice = 55;
  } else if (percentile >= 95) {
    signal = "UNDER";
    edgeStrength = "STRONG";
    recommendedPrice = 70;
  } else if (percentile >= 85) {
    signal = "UNDER";
    edgeStrength = "MODERATE";
    recommendedPrice = 60;
  } else if (percentile >= 75) {
    signal = "UNDER";
    edgeStrength = "WEAK";
    recommendedPrice = 55;
  }

  return {
    game_id: edge.game_id,
    sport_id: edge.sport_id,
    matchup: `${edge.away_team} @ ${edge.home_team}`,
    dk_line: edge.dk_total_line,
    percentile,
    p05,
    p95,
    signal,
    edge_strength: edgeStrength,
    recommended_price: recommendedPrice,
    kalshi_ticker: null, // Will be matched later
    kalshi_market_price: null,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Get Kalshi credentials from environment
    const kalshiKeyId = Deno.env.get("KALSHI_API_KEY_ID");
    const kalshiPrivateKey = Deno.env.get("KALSHI_PRIVATE_KEY");
    const useDemo = Deno.env.get("KALSHI_USE_DEMO") === "true";

    if (!kalshiKeyId || !kalshiPrivateKey) {
      return new Response(
        JSON.stringify({
          error: "Kalshi credentials not configured",
          setup_instructions: {
            step1: "Create Kalshi account at https://kalshi.com",
            step2: "Generate API keys in Settings -> API",
            step3: "Add KALSHI_API_KEY_ID and KALSHI_PRIVATE_KEY to Supabase secrets",
            step4: "Optionally set KALSHI_USE_DEMO=true for testing",
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let requestBody: {
      action?: "scan" | "place_order" | "get_signals" | "get_portfolio";
      ticker?: string;
      side?: "yes" | "no";
      count?: number;
      price?: number;
      sport_id?: string;
    } = {};

    try {
      requestBody = await req.json();
    } catch {
      requestBody = { action: "get_signals" };
    }

    const action = requestBody.action || "get_signals";

    // ============================================================
    // ACTION: GET PORTFOLIO
    // ============================================================
    if (action === "get_portfolio") {
      const portfolio = await getPortfolio(kalshiKeyId, kalshiPrivateKey, useDemo);

      return new Response(
        JSON.stringify({ success: true, portfolio }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ACTION: SCAN KALSHI MARKETS
    // ============================================================
    if (action === "scan") {
      const events = await fetchKalshiSportsMarkets(kalshiKeyId, kalshiPrivateKey, useDemo);

      return new Response(
        JSON.stringify({
          success: true,
          events_count: events.length,
          events: events.slice(0, 50), // Limit response size
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ACTION: PLACE ORDER
    // ============================================================
    if (action === "place_order") {
      if (!requestBody.ticker || !requestBody.side || !requestBody.count) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: ticker, side, count" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await placeOrder(
        {
          ticker: requestBody.ticker,
          side: requestBody.side,
          type: requestBody.price ? "limit" : "market",
          count: requestBody.count,
          yes_price: requestBody.side === "yes" ? requestBody.price : undefined,
          no_price: requestBody.side === "no" ? requestBody.price : undefined,
        },
        kalshiKeyId,
        kalshiPrivateKey,
        useDemo
      );

      // Log the order to database
      await supabase.from("kalshi_orders").insert({
        ticker: requestBody.ticker,
        side: requestBody.side,
        count: requestBody.count,
        price: requestBody.price,
        order_id: result.order_id,
        success: result.success,
        error: result.error,
        is_demo: useDemo,
      });

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ACTION: GET SIGNALS (Default)
    // ============================================================

    // Get today's date in ET
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const today = formatter.format(now);

    // Fetch edges with strong signals
    const sportFilter = requestBody.sport_id;
    let query = supabase
      .from("daily_edges")
      .select(`
        game_id,
        sport_id,
        dk_total_line,
        dk_line_percentile,
        p05,
        p95,
        games!inner(
          id,
          start_time_utc,
          status,
          home_team:teams!games_home_team_id_fkey(name, abbrev),
          away_team:teams!games_away_team_id_fkey(name, abbrev)
        )
      `)
      .eq("date_local", today)
      .not("dk_line_percentile", "is", null)
      .or("dk_line_percentile.lte.25,dk_line_percentile.gte.75");

    if (sportFilter) {
      query = query.eq("sport_id", sportFilter);
    }

    const { data: edges, error: edgeError } = await query;

    if (edgeError) {
      console.error("[KALSHI] Error fetching edges:", edgeError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch edge data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signals for each edge
    const signals: BetSignal[] = [];

    for (const edge of edges || []) {
      const game = edge.games as any;
      if (!game || game.status === "final") continue;

      const signal = generateBetSignal({
        game_id: edge.game_id,
        sport_id: edge.sport_id,
        home_team: game.home_team?.name || game.home_team?.abbrev || "Home",
        away_team: game.away_team?.name || game.away_team?.abbrev || "Away",
        dk_total_line: edge.dk_total_line,
        dk_line_percentile: edge.dk_line_percentile,
        p05: edge.p05,
        p95: edge.p95,
        start_time_utc: game.start_time_utc,
      });

      if (signal.signal !== "NO_EDGE") {
        signals.push(signal);
      }
    }

    // Sort by edge strength (STRONG first, then MODERATE, then WEAK)
    const strengthOrder = { STRONG: 0, MODERATE: 1, WEAK: 2 };
    signals.sort((a, b) => strengthOrder[a.edge_strength] - strengthOrder[b.edge_strength]);

    // Fetch Kalshi portfolio for context
    const portfolio = await getPortfolio(kalshiKeyId, kalshiPrivateKey, useDemo);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        signals_count: signals.length,
        signals,
        portfolio: {
          balance: portfolio.balance,
          open_positions: portfolio.positions.length,
        },
        strong_signals: signals.filter(s => s.edge_strength === "STRONG").length,
        moderate_signals: signals.filter(s => s.edge_strength === "MODERATE").length,
        environment: useDemo ? "demo" : "production",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[KALSHI] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
