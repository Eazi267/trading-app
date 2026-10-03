-- Pulse backend — Migration 5: Support Cases.
--
-- Mirrors SupportContext.jsx: real case files, not one flat thread
-- per client. A client can have several independent cases open at
-- once (an appeal about one deposit, an unrelated question about
-- their tier), each with its own status and message thread.
--
-- This also completes what Batch 4's transaction /:id/appeal
-- endpoint deliberately left unfinished — appealing a correction now
-- actually opens a linked case here, closing that gap rather than
-- leaving it as a permanent shortcut.

CREATE TYPE case_status AS ENUM ('open', 'resolved');
CREATE TYPE case_category AS ENUM ('appeal', 'account', 'general', 'other');

CREATE TABLE support_cases (
  id                     SERIAL PRIMARY KEY,
  user_id                INTEGER NOT NULL REFERENCES users(id),

  subject                TEXT NOT NULL,
  category               case_category NOT NULL,
  related_transaction_id INTEGER REFERENCES transactions(id),

  status                 case_status NOT NULL DEFAULT 'open',
  unread_for_admin       BOOLEAN NOT NULL DEFAULT true,
  unread_for_client      BOOLEAN NOT NULL DEFAULT false,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE support_messages (
  id          SERIAL PRIMARY KEY,
  case_id     INTEGER NOT NULL REFERENCES support_cases(id),

  sender_id   INTEGER NOT NULL REFERENCES users(id),
  -- Denormalized, same reasoning as audit_log's actor_name: a
  -- message has to keep reading correctly even if the sender is
  -- later renamed or deactivated.
  sender_role TEXT NOT NULL, -- 'client' | 'admin'
  sender_name TEXT NOT NULL,

  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_cases_user ON support_cases (user_id);
CREATE INDEX idx_support_cases_status ON support_cases (status);
CREATE INDEX idx_support_messages_case ON support_messages (case_id);
