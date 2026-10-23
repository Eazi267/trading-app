-- A user can only ever hold ONE signup bonus. Enforced by the database, so
-- even two signups racing each other (or a bug) can't double-grant.
CREATE UNIQUE INDEX uniq_signup_bonus_per_user
  ON transactions (user_id)
  WHERE type = 'signup_bonus';
