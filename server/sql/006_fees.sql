-- Pulse backend — Migration 6: Fee-balance pooling.
--
-- Mirrors AppContext.jsx's fee system closely, including its most
-- important subtlety: getFeeOwedAmount() treats feeStatus = 'paid'
-- as PERMANENT, even if a discount later expires. Without that,
-- a fee paid in full while a discount was active would silently
-- become "owed again" once the discount's window passed — this was
-- a real fixed bug on the frontend (see principles-and-architecture),
-- and the server-side equivalent (in src/utils/fees.js, added
-- alongside this migration) makes the same check first.
--
-- ALTER TYPE ... ADD VALUE is committed in its own migration/
-- transaction, separate from any INSERT that uses the new value —
-- Postgres doesn't reliably allow using a newly-added enum value in
-- the same transaction that added it.

ALTER TYPE transaction_type ADD VALUE 'fee';

ALTER TABLE transactions
  ADD COLUMN fee_status         TEXT CHECK (fee_status IN ('outstanding', 'paid')),
  ADD COLUMN amount_paid        NUMERIC(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN discount_amount    NUMERIC(18, 2),
  ADD COLUMN discount_expires_at TIMESTAMPTZ,
  -- No FK — trading sessions don't exist as a table yet (see
  -- server/README.md's "not built yet" list). Left as a bare
  -- reference so a fee can still record which session it was linked
  -- to on the frontend; add the FK once that table exists.
  ADD COLUMN linked_session_id  INTEGER,
  ADD COLUMN charged_by         INTEGER REFERENCES users(id),
  -- fee_payment-only: the allocation locked in at submission time
  -- (see allocateAgainstOutstandingFees's comment on why it's locked
  -- then, not recomputed at approval) and any genuine excess that
  -- becomes a real deposit.
  ADD COLUMN fee_allocations    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN spillover_amount   NUMERIC(18, 2);
