import { pool } from '../db.js'

// Same shape as the frontend's generateReferralCode(): initials +
// 4 random base36 chars, re-rolled on collision.
export async function generateReferralCode(name) {
  const initials = (name || 'USR').trim().split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 3) || 'USR'
  let code
  let exists = true
  while (exists) {
    const random = Math.random().toString(36).slice(2, 6).toUpperCase()
    code = `${initials}${random}`
    const { rows } = await pool.query('SELECT 1 FROM users WHERE referral_code = $1', [code])
    exists = rows.length > 0
  }
  return code
}
