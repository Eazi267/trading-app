-- Pulse backend — Migration 7: transactions.note
--
-- Missing from 002_transactions.sql, caught by a real crash while
-- testing Batch 6 (fee charging tried to INSERT a `note` column that
-- didn't exist) — not caught in review, caught by actually running
-- it against a live database. Used by fee charges (the admin's
-- reason for the charge) and the spillover deposit created when a
-- fee payment overpays ("Excess from fee payment").

ALTER TABLE transactions ADD COLUMN note TEXT;
