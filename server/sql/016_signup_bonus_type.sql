-- Batch 10: signup bonus becomes a real server-side transaction type.
-- (Enum values can't be used in the same transaction that adds them, so the
-- one-per-user guarantee is its own migration, 017.)
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'signup_bonus';
