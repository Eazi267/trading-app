-- Pulse backend — Migration 2: Transactions.
--
-- Covers the core deposit/withdrawal/fee-payment lifecycle: client
-- creates a request, optionally submits proof (the self-report flow
-- built into the frontend), admin approves or rejects. Money is
-- NUMERIC, never FLOAT/DOUBLE — floats can't represent currency
-- exactly (0.1 + 0.2 != 0.3 in binary float), which is exactly the
-- kind of drift a "balances are always calculated, never hand-edited"
-- platform can't tolerate anywhere in the chain.
--
-- NOT included yet (deliberately — see server/README.md's batch
-- notes): amount correction (requested_amount vs corrected amount,
-- with evidence + appeal), fee-balance pooling, trading
-- sessions/positions. Those are real, separate pieces of frontend
-- logic worth their own tested batch rather than guessed at here
-- alongside the basic request/approve/reject flow.

CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'fee_payment');
CREATE TYPE transaction_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE transactions (
  id                     SERIAL PRIMARY KEY,
  user_id                INTEGER NOT NULL REFERENCES users(id),

  type                   transaction_type NOT NULL,
  amount                 NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  method                 TEXT,   -- 'usdt' | 'btc' | 'bank', matches config/paymentMethods.js
  chain                  TEXT,   -- network name for crypto methods, null for bank

  status                 transaction_status NOT NULL DEFAULT 'pending',

  -- Client self-report flow (submitDepositProof in AppContext.jsx):
  -- deliberately does NOT touch `status` — same reasoning as the
  -- frontend version, stays 'pending' the whole time so nothing
  -- keyed on the 3 status values needs a 4th case.
  client_confirmed       BOOLEAN NOT NULL DEFAULT false,
  client_proof_evidence  JSONB NOT NULL DEFAULT '[]',
  client_confirmed_at    TIMESTAMPTZ,

  reviewed_by            INTEGER REFERENCES users(id),
  reviewed_at            TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user ON transactions (user_id);
CREATE INDEX idx_transactions_status ON transactions (status);
