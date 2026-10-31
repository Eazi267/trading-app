-- Emailed one-time codes can now also confirm sensitive client actions
-- (switched on per action by a super admin): purposes op_withdrawal etc.
ALTER TABLE email_codes DROP CONSTRAINT email_codes_purpose_check;
ALTER TABLE email_codes ADD CONSTRAINT email_codes_purpose_check
  CHECK (purpose IN ('verify_email', 'password_reset', 'op_withdrawal', 'op_deposit', 'op_wallet', 'op_session', 'op_password'));
