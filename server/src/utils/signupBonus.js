import { pool } from '../db.js'
import { logAudit } from './auditLog.js'
import { notify } from './notifications.js'

// Largest bonus an admin can configure — a typo like 5000000 is refused
// rather than silently handing every new signup millions.
export const MAX_SIGNUP_BONUS = 100000

// Grants the one-time signup bonus to a freshly created real client, as a
// real, already-approved transaction (so it shows in their history and
// balance like any other credit). Does nothing when the bonus is off, the
// amount is 0, or the user is an admin/demo account. The unique index in
// migration 017 makes a second grant for the same user impossible.
// Never throws: a bonus problem must not break signup itself.
export async function grantSignupBonus(user) {
  try {
    if (user.role === 'admin' || user.is_demo_generated) return null
    const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
    const data = rows[0]?.data || {}
    const amount = Number(data.signupBonusAmount)
    if (data.signupBonusEnabled !== true || !Number.isFinite(amount) || amount <= 0 || amount > MAX_SIGNUP_BONUS) return null

    const { rows: inserted } = await pool.query(
      `INSERT INTO transactions (user_id, type, amount, status, note, details)
       VALUES ($1, 'signup_bonus', $2, 'approved', 'Signup bonus', '{"source":"signup"}')
       ON CONFLICT DO NOTHING RETURNING id`,
      [user.id, amount.toFixed(2)]
    )
    if (inserted.length === 0) return null // already has one

    await logAudit({
      action: 'signup_bonus_granted',
      actor: null,
      targetUserId: user.id,
      targetUserName: user.name,
      details: { amount, transactionId: inserted[0].id }
    })
    await notify(user.id, 'signup_bonus', 'Welcome bonus added', `A one-time $${amount.toFixed(2)} welcome bonus has been added to your balance.`, { amount })
    return { amount }
  } catch (err) {
    console.error('Signup bonus failed (signup still succeeded):', err.message)
    return null
  }
}
