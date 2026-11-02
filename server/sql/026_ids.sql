-- New ID system.
--  * Account IDs  PM-C-2611-0042 : company prefix, C=client / A=admin, joined YYMM, running number
--    (two sequences, so client and admin numbers never reuse a value).
--  * Transaction IDs PM-D-261101-00040 : company prefix, type letter, date YYMMDD, running number.
-- The prefix comes from Business Settings (settings.data.idPrefix); the server fills it in on first start.
-- The old ID column held exactly 9 characters; the new IDs are longer.
ALTER TABLE users ALTER COLUMN uid TYPE TEXT;

CREATE SEQUENCE IF NOT EXISTS uid_client_seq;
CREATE SEQUENCE IF NOT EXISTS uid_admin_seq;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_ref_unique ON transactions (ref) WHERE ref IS NOT NULL;

CREATE OR REPLACE FUNCTION transaction_ref(prefix TEXT, kind TEXT, made TIMESTAMPTZ, n INTEGER)
RETURNS TEXT AS $$
  SELECT prefix || '-' ||
    CASE kind
      WHEN 'deposit' THEN 'D' WHEN 'withdrawal' THEN 'W' WHEN 'fee' THEN 'F' WHEN 'fee_payment' THEN 'P'
      WHEN 'session_settlement' THEN 'S' WHEN 'capped_profit_release' THEN 'R'
      WHEN 'referral_bonus' THEN 'B' WHEN 'signup_bonus' THEN 'G' WHEN 'reversal' THEN 'V' ELSE 'X'
    END || '-' || to_char(made AT TIME ZONE 'UTC', 'YYMMDD') || '-' || lpad(n::text, 5, '0')
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION set_transaction_ref() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ref IS NULL THEN
    NEW.ref := transaction_ref(
      COALESCE(NULLIF((SELECT data->>'idPrefix' FROM settings WHERE id = 1), ''), 'PU'),
      NEW.type::text, NEW.created_at, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_set_ref ON transactions;
CREATE TRIGGER transactions_set_ref BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_transaction_ref();
