-- Omen Prediction Market Integration
-- Tracks markets created on Omen (Gnosis Chain)

-- Table to store Omen markets we've created
CREATE TABLE IF NOT EXISTS omen_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Linked game
  game_id UUID REFERENCES games(id),
  
  -- Market details
  question TEXT NOT NULL,
  category TEXT,
  
  -- On-chain identifiers
  condition_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  fpmm_address TEXT NOT NULL,
  collateral_token TEXT NOT NULL,
  
  -- Market parameters
  initial_liquidity NUMERIC,
  fee_bps INTEGER,
  resolution_date TIMESTAMPTZ,
  
  -- Edge signal data
  signal_type TEXT CHECK (signal_type IN ('OVER', 'UNDER')),
  edge_percentile NUMERIC,
  dk_line NUMERIC,
  
  -- Transaction
  tx_hash TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'invalid')),
  resolved_at TIMESTAMPTZ,
  resolution_outcome TEXT CHECK (resolution_outcome IN ('yes', 'no', 'invalid')),
  
  -- P&L tracking
  our_position TEXT CHECK (our_position IN ('yes', 'no')),
  position_size NUMERIC,
  pnl_xdai NUMERIC
);

-- Table to track Omen wallet transactions
CREATE TABLE IF NOT EXISTS omen_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Transaction details
  tx_hash TEXT NOT NULL UNIQUE,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('create_market', 'add_liquidity', 'remove_liquidity', 'buy', 'sell')),
  
  -- Related entities
  market_id UUID REFERENCES omen_markets(id),
  fpmm_address TEXT,
  
  -- Amounts
  amount_xdai NUMERIC,
  gas_used NUMERIC,
  gas_price_gwei NUMERIC,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  block_number BIGINT,
  error TEXT
);

-- Table to track Omen positions
CREATE TABLE IF NOT EXISTS omen_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Market reference
  market_id UUID REFERENCES omen_markets(id),
  fpmm_address TEXT NOT NULL,
  
  -- Position details
  outcome TEXT NOT NULL CHECK (outcome IN ('yes', 'no')),
  shares NUMERIC NOT NULL,
  avg_price NUMERIC,
  total_cost NUMERIC,
  
  -- Current value
  current_price NUMERIC,
  current_value NUMERIC,
  unrealized_pnl NUMERIC
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_omen_markets_game_id ON omen_markets(game_id);
CREATE INDEX IF NOT EXISTS idx_omen_markets_fpmm_address ON omen_markets(fpmm_address);
CREATE INDEX IF NOT EXISTS idx_omen_markets_status ON omen_markets(status);
CREATE INDEX IF NOT EXISTS idx_omen_markets_created_at ON omen_markets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omen_transactions_tx_hash ON omen_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_omen_positions_market_id ON omen_positions(market_id);

-- Enable RLS
ALTER TABLE omen_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE omen_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE omen_positions ENABLE ROW LEVEL SECURITY;

-- RLS policies for public read access
CREATE POLICY "Public can read omen_markets" ON omen_markets FOR SELECT USING (true);
CREATE POLICY "Public can read omen_transactions" ON omen_transactions FOR SELECT USING (true);
CREATE POLICY "Public can read omen_positions" ON omen_positions FOR SELECT USING (true);

-- Add Omen configuration to betting_config
ALTER TABLE betting_config
ADD COLUMN IF NOT EXISTS omen_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS omen_initial_liquidity_xdai NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS omen_fee_bps INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS omen_min_edge_strength TEXT DEFAULT 'STRONG';

-- Update default config
UPDATE betting_config
SET omen_enabled = false,
    omen_initial_liquidity_xdai = 10,
    omen_fee_bps = 200,
    omen_min_edge_strength = 'STRONG'
WHERE name = 'default';