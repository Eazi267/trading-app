-- Pulse backend — Migration 8: Trading sessions + positions.
--
-- Mirrors AppContext.jsx's session/position model. Scope cuts made
-- deliberately, not by accident — each is a real feature the
-- frontend has that this migration does NOT port, because building
-- it now would mean guessing at behavior rather than testing it:
--   - Per-session scenario control (admin demo/testing bias tool) —
--     not core trading logic, positions always read the real global
--     price engine here, never a per-session override.
--   - Investment tiers are NOT settings-driven server-side yet —
--     config/tiers.js is a static server copy (same "duplicated but
--     flagged" pattern as config/adminTiers.js), not wired to the
--     settings table's admin-editable tier list from Batch 3.
--   - Referral bonuses on a session's underlying deposit — referral
--     campaigns don't exist server-side yet.

CREATE TYPE session_status AS ENUM ('awaiting_start', 'active', 'closed', 'cancelled');
CREATE TYPE position_direction AS ENUM ('long', 'short');

-- 'fee' was added to transaction_type in Migration 6; these two are
-- the other transaction types a session produces on close.
ALTER TYPE transaction_type ADD VALUE 'session_settlement';
ALTER TYPE transaction_type ADD VALUE 'capped_profit_release';

CREATE TABLE trading_sessions (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id),

  tier_id             TEXT NOT NULL,
  amount              NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  -- Uncommitted cash inside the session — starts equal to `amount`,
  -- decreases when a position opens (margin taken out), increases
  -- when one closes (margin +/- P&L returned). Never the client's
  -- wider account balance; a position can only ever spend what this
  -- session itself was funded with.
  cash                NUMERIC(18, 2) NOT NULL,
  leverage            NUMERIC(10, 2) NOT NULL,
  duration_days       INTEGER NOT NULL,

  status              session_status NOT NULL DEFAULT 'active',
  committed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  closed_reason       TEXT,

  end_value           NUMERIC(18, 2),
  raw_pnl             NUMERIC(18, 2),
  payout              NUMERIC(18, 2),
  excess_pending      NUMERIC(18, 2),

  initiated_by_id     INTEGER REFERENCES users(id),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE positions (
  id             SERIAL PRIMARY KEY,
  session_id     INTEGER NOT NULL REFERENCES trading_sessions(id),

  symbol         TEXT NOT NULL,
  direction      position_direction NOT NULL DEFAULT 'long',
  entry_price    NUMERIC(18, 6) NOT NULL,
  margin_amount  NUMERIC(18, 2) NOT NULL CHECK (margin_amount > 0),
  leverage       NUMERIC(10, 2) NOT NULL,

  opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at      TIMESTAMPTZ -- NULL while open; kept as a row (not deleted) once closed, for trade history
);

CREATE INDEX idx_sessions_user ON trading_sessions (user_id);
CREATE INDEX idx_sessions_status ON trading_sessions (status);
CREATE INDEX idx_positions_session ON positions (session_id);

-- Deferred from Migration 6's comment: linked_session_id (used by
-- fees, and now by session_settlement/capped_profit_release
-- transactions too, via the same column) can finally get its real FK
-- now that trading_sessions exists.
ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_linked_session
  FOREIGN KEY (linked_session_id) REFERENCES trading_sessions(id);
