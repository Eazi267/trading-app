-- Pulse backend — Migration 9: fix transactions.amount CHECK constraint.
--
-- Migration 2's `CHECK (amount > 0)` was written back when every
-- transaction type was inherently positive (deposit, withdrawal,
-- fee, fee_payment). session_settlement (Migration 8) broke that
-- assumption: a session's payout is a SIGNED result — zero on a
-- breakeven session, negative on a loss. The old constraint silently
-- blocked every non-profitable session's settlement from ever being
-- recorded, which surfaced as a real failure in the auto-expiry
-- sweep's error log while testing Batch 7, not from reading the code.
--
-- The fix keeps positivity enforced at the database level (not just
-- in application code) for the types where it's actually true, and
-- allows any value — including 0 or negative — for the settlement
-- types where a signed result is the whole point.

ALTER TABLE transactions DROP CONSTRAINT transactions_amount_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_amount_check CHECK (
  (type IN ('deposit', 'withdrawal', 'fee', 'fee_payment') AND amount > 0)
  OR type IN ('session_settlement', 'capped_profit_release')
);
