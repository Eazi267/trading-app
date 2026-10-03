-- Pulse backend — Migration 4: Transaction correction + appeal.
--
-- Scoped to deposit/withdrawal only. The frontend's
-- correctTransactionAmount() also handles fee_payment corrections by
-- recomputing fee allocations via allocateAgainstOutstandingFees() —
-- that depends on the fee-balance pooling system, which doesn't
-- exist server-side yet (see server/README.md's "not built yet"
-- list). Porting fee correction here would mean either skipping that
-- recompute (silently wrong — a corrected fee payment would keep its
-- stale allocation) or guessing at pooling logic that hasn't been
-- built and tested on its own. Neither is acceptable, so fee_payment
-- correction waits for that batch; deposit/withdrawal correction
-- doesn't depend on anything unbuilt and ships now.
--
-- Similarly, appeal here records the appeal (appealed, appealed_at)
-- and audit-logs it, but does NOT create a linked support case the
-- way the frontend's appealTransaction() does — that needs a real
-- Support Cases system, which is its own batch, not a shortcut built
-- alongside this one.

ALTER TABLE transactions
  ADD COLUMN requested_amount    NUMERIC(18, 2),
  ADD COLUMN correction_evidence JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN correction_note     TEXT,
  ADD COLUMN corrected_at        TIMESTAMPTZ,
  ADD COLUMN appealed            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN appealed_at         TIMESTAMPTZ;
