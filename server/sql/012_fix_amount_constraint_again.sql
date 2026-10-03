-- Pulse backend — Migration 12: fix transactions.amount CHECK constraint, again.
--
-- Migration 9 fixed this constraint by listing which types must be
-- positive: deposit, withdrawal, fee, fee_payment. Migration 11 then
-- added referral_bonus without updating that list — caught for real
-- while testing this batch (every referral bonus silently failed to
-- insert with a constraint violation, logged by the
-- express-async-errors safety net rather than crashing, same
-- pattern as the last two bugs this session).
--
-- The actual fix: stop listing "which types must be positive" (an
-- allowlist that has to be remembered on every new type, and wasn't)
-- and instead list "which types are allowed to be signed" — a
-- denylist of exactly the two types where a negative/zero result is
-- the whole point (session_settlement, capped_profit_release). Any
-- new transaction type added later defaults to "must be positive"
-- automatically, without needing to remember to update this
-- constraint — the safe default, not an opt-in one.

ALTER TABLE transactions DROP CONSTRAINT transactions_amount_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_amount_check CHECK (
  type IN ('session_settlement', 'capped_profit_release') OR amount > 0
);
