-- Kalshi Integration Tables
-- Tracks orders placed on Kalshi prediction markets

-- Table to store Kalshi orders
CREATE TABLE IF NOT EXISTS kalshi_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Order details
  ticker TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  count INTEGER NOT NULL,
  price INTEGER, -- Price in cents (1-99)
  order_type TEXT DEFAULT 'limit' CHECK (order_type IN ('limit', 'market')),

  -- Kalshi response
  order_id TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  error TEXT,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partial', 'cancelled', 'expired')),
  filled_count INTEGER DEFAULT 0,
  fill_price INTEGER,

  -- Linked game/edge data
  game_id UUID REFERENCES games(id),
  edge_percentile NUMERIC,
  signal_type TEXT CHECK (signal_type IN ('OVER', 'UNDER')),
  edge_strength TEXT CHECK (edge_strength IN ('STRONG', 'MODERATE', 'WEAK')),

  -- Environment
  is_demo BOOLEAN DEFAULT false,

  -- Result tracking (after market settles)
  result TEXT CHECK (result IN ('win', 'loss', 'push', 'pending')),
  pnl_cents INTEGER,
  settled_at TIMESTAMPTZ
);

-- Table to store betting algorithm configuration
CREATE TABLE IF NOT EXISTS betting_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Algorithm parameters
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,

  -- Thresholds
  strong_edge_threshold INTEGER DEFAULT 5,
  moderate_edge_threshold INTEGER DEFAULT 15,
  weak_edge_threshold INTEGER DEFAULT 25,

  -- Position sizing
  max_position_size_cents INTEGER DEFAULT 1000,
  strong_position_pct INTEGER DEFAULT 100,
  moderate_position_pct INTEGER DEFAULT 50,
  weak_position_pct INTEGER DEFAULT 25,

  -- Risk limits
  max_daily_loss_cents INTEGER DEFAULT 5000,
  max_open_positions INTEGER DEFAULT 10,
  min_edge_confidence INTEGER DEFAULT 5,

  -- Price limits
  max_limit_price INTEGER DEFAULT 70,
  min_limit_price INTEGER DEFAULT 30,

  -- Sports filters
  enabled_sports TEXT[] DEFAULT ARRAY['nba', 'nfl', 'nhl', 'mlb']
);

-- Insert default config
INSERT INTO betting_config (name) VALUES ('default')
ON CONFLICT (name) DO NOTHING;

-- Table to track daily P&L
CREATE TABLE IF NOT EXISTS daily_pnl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_local DATE NOT NULL UNIQUE,

  -- Order counts
  orders_placed INTEGER DEFAULT 0,
  orders_filled INTEGER DEFAULT 0,
  orders_won INTEGER DEFAULT 0,
  orders_lost INTEGER DEFAULT 0,

  -- P&L
  gross_pnl_cents INTEGER DEFAULT 0,
  fees_cents INTEGER DEFAULT 0,
  net_pnl_cents INTEGER DEFAULT 0,

  -- Stats
  win_rate NUMERIC,
  avg_edge_percentile NUMERIC,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_created_at ON kalshi_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_ticker ON kalshi_orders(ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_game_id ON kalshi_orders(game_id);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_status ON kalshi_orders(status);
CREATE INDEX IF NOT EXISTS idx_daily_pnl_date ON daily_pnl(date_local DESC);

-- Function to update daily P&L
CREATE OR REPLACE FUNCTION update_daily_pnl()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_pnl (date_local, orders_placed)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (date_local) DO UPDATE
  SET
    orders_placed = daily_pnl.orders_placed + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update daily P&L on new orders
DROP TRIGGER IF EXISTS trg_update_daily_pnl ON kalshi_orders;
CREATE TRIGGER trg_update_daily_pnl
  AFTER INSERT ON kalshi_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_pnl();