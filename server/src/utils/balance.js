import { pool } from '../db.js'

// Shared with routes/users.js's /me/balance endpoint AND
// routes/sessions.js's session-funding check — one balance
// calculation, not two copies that could drift. Mirrors
// getAccountBalance()/getBalanceBreakdown() in AppContext.jsx:
// approved deposit/withdrawal/session_settlement/capped_profit_release/
// referral_bonus make up the real, certified balance. ('signup_bonus'
// also counts on the frontend but has no creation logic anywhere to
// mirror — see sql/011_referrals.sql's header comment — so it's
// omitted here rather than guessed at.)
//
// This function itself was the source of a real bug caught while
// testing Batch 8: referral_bonus was missing from this SUM entirely
// — the transaction recorded correctly and showed up in campaign
// stats, but silently never reached the referrer's actual balance.
// Caught by checking the balance endpoint after a real payout, not
// by reading the code.
export async function getAccountBalance(userId) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type = 'deposit'), 0) AS deposited,
       COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal'), 0) AS withdrawn,
       COALESCE(SUM(amount) FILTER (WHERE type = 'session_settlement'), 0) AS settled,
       COALESCE(SUM(amount) FILTER (WHERE type = 'capped_profit_release'), 0) AS released,
       COALESCE(SUM(amount) FILTER (WHERE type = 'referral_bonus'), 0) AS referred
     FROM transactions
     WHERE user_id = $1 AND status = 'approved'`,
    [userId]
  )
  const { deposited, withdrawn, settled, released, referred } = rows[0]
  return Number(deposited) - Number(withdrawn) + Number(settled) + Number(released) + Number(referred)
}

// available = what a client can actually withdraw or commit to a NEW
// session — deliberately excludes capital already tied up in an
// active or awaiting_start session, same as getBalanceBreakdown()'s
// `pending` on the frontend.
export async function getAvailableBalance(userId) {
  const total = await getAccountBalance(userId)
  const { rows } = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS pending FROM trading_sessions WHERE user_id = $1 AND status IN ('active', 'awaiting_start')",
    [userId]
  )
  const pending = Number(rows[0].pending)
  return { total, available: total - pending, pending }
}
