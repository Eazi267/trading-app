-- Pulse backend — Migration 13: User profile fields.
--
-- Batch 9 exists because wiring the frontend surfaced a real scope
-- gap: AuthContext.jsx is 654 lines and only ~15% of it (login,
-- signup, session) had a backend counterpart. Admin pages read
-- straight from AuthContext's local user roster, so wiring auth
-- alone without this would mean a real, authenticated user is
-- invisible to every admin panel — a broken middle state, not a
-- partial win. This migration adds what the rest of AuthContext
-- needs to have a real backend home.

ALTER TABLE users
  ADD COLUMN phone               TEXT,
  ADD COLUMN avatar               TEXT, -- data URL, same storage mechanism as the frontend already uses
  ADD COLUMN kyc                  JSONB,
  ADD COLUMN kyc_enhanced         JSONB,
  ADD COLUMN kyc_required         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN bound_wallet         JSONB,
  ADD COLUMN is_demo_generated    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN preferred_currency   TEXT,
  ADD COLUMN created_by_admin_id  INTEGER REFERENCES users(id);
