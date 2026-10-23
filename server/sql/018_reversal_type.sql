-- Batch 13: reversing entries. A mistake on an APPROVED deposit/withdrawal is
-- never edited or deleted (that would rewrite history); an admin adds an
-- offsetting 'reversal' entry instead. The amount stays positive (new types
-- must be > 0); details.direction says whether it adds ('credit') or removes
-- ('debit') money.
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'reversal';
