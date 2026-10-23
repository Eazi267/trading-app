-- Two-factor login (authenticator app). The secret is stored ENCRYPTED
-- (see utils/totp.js). totp_last_step stops a used code being replayed.
-- totp_recovery holds SHA-256 hashes of one-time recovery codes.
ALTER TABLE users
  ADD COLUMN totp_secret TEXT,
  ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN totp_last_step BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN totp_recovery JSONB NOT NULL DEFAULT '[]'::jsonb;
