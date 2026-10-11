-- Trade history lives on the server (Batch 9). Positions already keep one
-- row per trade (never deleted); these columns record how each one ended
-- and who acted, so GET /api/trades can rebuild the full history.
--
-- Positions closed BEFORE this migration have no recorded exit price/P&L
-- (it was never stored). They stay NULL rather than being invented, so they
-- show as "closed" without a result and are left out of win-rate stats.
ALTER TABLE positions
  ADD COLUMN opened_by_id INTEGER REFERENCES users(id),
  ADD COLUMN closed_by_id INTEGER REFERENCES users(id),
  ADD COLUMN exit_price   NUMERIC(18, 6),
  ADD COLUMN pnl          NUMERIC(18, 2);

CREATE INDEX idx_positions_opened_at ON positions (opened_at DESC);
