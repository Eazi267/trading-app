-- Batch 14: lets the server cancel every login token a user already holds.
-- Each token carries the user's token_version; changing the password raises
-- it, so tokens issued before the change (e.g. one a thief copied) stop working.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
