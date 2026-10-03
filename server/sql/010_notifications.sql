-- Pulse backend — Migration 10: Notifications.
--
-- Mirrors NotificationContext.jsx's persistent history (not the
-- transient client-side "toast" — that's purely a UI concept, has no
-- server-side equivalent and doesn't need one). One entry point
-- (utils/notifications.js's notify()) that every route below calls
-- at the same points the frontend already does, so a real event
-- always produces a real notification, not sometimes.

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  meta       JSONB NOT NULL DEFAULT '{}',
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications (user_id);
CREATE INDEX idx_notifications_unread ON notifications (user_id, read);
