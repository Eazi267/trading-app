-- Pulse backend — Migration 1: Auth + Audit only.
--
-- Same reasoning as before: auth is the foundation everything else
-- depends on, so it ships first, tested end-to-end, before Transaction,
-- Session, Position, Settings, SupportCase, Notification, or
-- ReferralCampaign tables get added in later batches.
--
-- Field-by-field, this mirrors src/context/AuthContext.jsx's
-- SEED_USERS shape as closely as a real schema reasonably can, with
-- two deliberate deviations:
--   1. password_hash, not a plaintext password column — the frontend
--      stores real passwords in localStorage in the open, fine for a
--      client-only demo, not fine for a real backend.
--   2. No UID-as-password field or login path. The frontend lets a
--      client type their UID into the password field as a working
--      alternate login (see generateUid()'s comment in AuthContext.jsx
--      — meant only for support-assisted recovery, deliberately never
--      shown as an option in Login.jsx). That's a real vulnerability
--      once this is a real backend: the UID is visible to every admin
--      and shown in the client's own Settings — anyone who learns it
--      could log straight into that account with no password at all.
--      Real support-assisted recovery becomes a proper reset-token
--      flow in a later batch (support verifies identity out-of-band,
--      then issues a one-time reset link), not a static always-valid
--      second password.

CREATE TYPE user_role AS ENUM ('user', 'admin');

-- Mirrors config/adminTiers.js. NULL for role = 'user'.
CREATE TYPE admin_tier AS ENUM ('super_admin', 'finance_admin', 'trading_admin', 'support_admin');

CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  uid               CHAR(9) UNIQUE NOT NULL,

  name              TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,

  role              user_role NOT NULL DEFAULT 'user',
  admin_tier        admin_tier,

  referral_code     TEXT UNIQUE NOT NULL,
  referred_by       INTEGER REFERENCES users(id),

  tier              TEXT,              -- investment tier id, e.g. 'tier1' — validated against a settings table once that exists
  flagged_for_review BOOLEAN NOT NULL DEFAULT false,
  vip_unlocked      TEXT,

  country           TEXT,
  currency_code     TEXT,

  deactivated_at    TIMESTAMPTZ,       -- deactivate, never delete — see principles-and-architecture

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_uid ON users (uid);

CREATE TABLE audit_log (
  id               TEXT PRIMARY KEY,
  action           TEXT NOT NULL,

  actor_id         INTEGER REFERENCES users(id),
  -- actor_name is denormalized on purpose, matching AuditContext.jsx's
  -- logAudit(): an entry has to keep reading correctly even if the
  -- actor is later deactivated or renamed — the log is a record of
  -- what happened, not a live join to the user's current name.
  actor_name       TEXT NOT NULL,

  target_user_id   INTEGER REFERENCES users(id),
  target_user_name TEXT,

  details          JSONB NOT NULL DEFAULT '{}',
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_action ON audit_log (action);
CREATE INDEX idx_audit_target ON audit_log (target_user_id);
CREATE INDEX idx_audit_timestamp ON audit_log (timestamp);
