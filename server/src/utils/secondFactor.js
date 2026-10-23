import { pool } from '../db.js'
import { verifyTotp, decryptSecret, hashRecoveryCode } from './totp.js'

// Checks an authenticator code (or, optionally, a one-time recovery code).
// A code that has been used once can never be used again: the step number is
// stored with a conditional UPDATE, so two simultaneous tries can't both win.
export async function checkSecondFactor(user, code, { allowRecovery = true } = {}) {
  if (!user.totp_secret) return { ok: false }
  let secret
  try { secret = decryptSecret(user.totp_secret) } catch { return { ok: false } }

  const step = verifyTotp(secret, code)
  if (step !== null) {
    const { rowCount } = await pool.query(
      'UPDATE users SET totp_last_step = $1 WHERE id = $2 AND totp_last_step < $1',
      [step, user.id]
    )
    return rowCount ? { ok: true, via: 'app' } : { ok: false }
  }

  if (allowRecovery && /^[0-9a-f]{5}-?[0-9a-f]{5}$/i.test(String(code || '').trim())) {
    const hash = hashRecoveryCode(code)
    // `?` = "array contains this string"; removing it makes the code single-use.
    const { rowCount } = await pool.query(
      'UPDATE users SET totp_recovery = totp_recovery - $2::text WHERE id = $1 AND totp_recovery ? $2::text',
      [user.id, hash]
    )
    if (rowCount) return { ok: true, via: 'recovery' }
  }
  return { ok: false }
}
