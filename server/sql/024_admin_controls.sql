-- Switches a super admin flips from the website (kept apart from the big
-- settings document the frontend saves, so a normal settings save can't wipe them).
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Every email the platform sends to a client on an admin's behalf or
-- automatically. sent_by is NULL for automatic emails. status:
--   sent    = handed to the email provider
--   logged  = test mode, printed in the server log only
--   skipped = no email provider configured
--   failed  = the provider refused it
CREATE TABLE sent_emails (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,
  subject        TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('sent', 'logged', 'skipped', 'failed')),
  error          TEXT,
  sent_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sent_emails_user ON sent_emails (user_id, created_at DESC);
