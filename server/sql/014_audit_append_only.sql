-- Pulse backend — Migration 14: make audit_log truly append-only.
--
-- The audit log is the record of "who did what to whom, and when".
-- The app never edits or deletes entries, but "the app never does it"
-- is a promise, not a guarantee: a future bug, a manual SQL session or
-- a copy-pasted cleanup query could quietly rewrite history. These
-- triggers make the DATABASE itself refuse. INSERT (new entries) is
-- untouched; UPDATE, DELETE and TRUNCATE all fail with a clear message.
--
-- If you ever genuinely need to clear TEST data in a dev database:
--   ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only;
--   ...delete what you need to...
--   ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only;
-- Never do that on a database holding real client history.

CREATE FUNCTION audit_log_block_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_changes();

CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_changes();
