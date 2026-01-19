-- Enable RLS on Kalshi tables
ALTER TABLE kalshi_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE betting_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_pnl ENABLE ROW LEVEL SECURITY;

-- Public read access for these operational tables (no user data)
CREATE POLICY "Allow public read on kalshi_orders" ON kalshi_orders FOR SELECT USING (true);
CREATE POLICY "Allow public read on betting_config" ON betting_config FOR SELECT USING (true);
CREATE POLICY "Allow public read on daily_pnl" ON daily_pnl FOR SELECT USING (true);

-- Fix search_path on update_daily_pnl function
CREATE OR REPLACE FUNCTION update_daily_pnl()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
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