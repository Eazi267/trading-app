-- Pulse backend — Migration 11: Referral campaigns.
--
-- Mirrors AppContext.jsx's referral system. Bonus payout is wired
-- into the EXISTING /api/transactions/:id/approve route (deposit
-- branch), same trigger point as the frontend: a referral bonus pays
-- out automatically the moment the REFERRED user's first-ever deposit
-- gets approved — no separate approval step, since the qualifying
-- deposit already went through one.
--
-- 'signup_bonus' (referenced in the frontend's getAccountBalance type
-- list) is NOT added here — no creation logic for it was found
-- anywhere in AppContext.jsx to mirror, so adding the type without
-- anything that ever produces it would be a dead enum value, not a
-- real feature.

ALTER TYPE transaction_type ADD VALUE 'referral_bonus';

-- referral_bonus is the first transaction type that needs to carry
-- structured metadata beyond the existing purpose-built columns
-- (which campaign, which referred user) — a generic JSONB column is
-- more honest than bolting on 4 more single-purpose columns for one
-- transaction type.
ALTER TABLE transactions ADD COLUMN details JSONB NOT NULL DEFAULT '{}';

CREATE TABLE referral_campaigns (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  bonus_amount   NUMERIC(18, 2) NOT NULL CHECK (bonus_amount > 0),
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  note           TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_by_id  INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
