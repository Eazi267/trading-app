-- Pulse backend — Migration 3: Settings.
--
-- One row, one JSONB column. Deliberately not a fully-normalized
-- table with a column per setting (depositMin, cryptoDepositInfo,
-- tiers, ...) — SettingsContext.jsx's own shape is a single object
-- with dozens of loosely-related keys that grows over time as
-- features get added, and a JSONB blob mirrors that shape exactly:
-- new settings keys need a frontend change and an API call, not a
-- new migration every time. The tradeoff (no per-field SQL
-- validation, no per-field indexing) is the right one here since
-- nothing in Settings is queried or filtered on — it's always read
-- and written as one whole object, same as the frontend does today.

CREATE TABLE settings (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- enforces exactly one row
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (id, data) VALUES (1, '{}');
