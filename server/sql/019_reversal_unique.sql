-- A transaction can be reversed only once — enforced by the database, so two
-- admins clicking at the same moment can't both succeed.
CREATE UNIQUE INDEX uniq_reversal_per_transaction
  ON transactions ((details->>'reversesTransactionId'))
  WHERE type = 'reversal';
