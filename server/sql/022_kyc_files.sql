-- KYC document images, stored ENCRYPTED (AES-256-GCM, see utils/fileCrypto.js)
-- in their own table instead of inline inside users.kyc. The users.kyc column
-- keeps only the status/metadata. One row per user per slot; resubmitting
-- replaces the old image (same rule as before).
CREATE TABLE kyc_files (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot       TEXT NOT NULL CHECK (slot IN ('front', 'back', 'enhanced')),
  mime       TEXT NOT NULL,
  data       BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot)
);
