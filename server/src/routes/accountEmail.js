import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'
import { checkPassword } from '../utils/passwordPolicy.js'
import { checkCode, invalidateAll } from '../utils/emailCodes.js'
import { sendVerificationCode, sendPasswordResetCode, sendPasswordChangedNotice } from '../utils/accountEmails.js'

const router = Router()

const limiter = (limit, message) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { error: message } })
const resetRequestLimiter = limiter(5, 'Too many requests. Try again in a few minutes.')
const resetConfirmLimiter = limiter(10, 'Too many attempts. Try again in a few minutes.')
const verifyLimiter = limiter(20, 'Too many attempts. Try again in a few minutes.')

// ---- Email verification (logged-in user) -------------------------------

router.post('/verify-email/send', verifyLimiter, requireAuth, async (req, res) => {
  if (req.user.email_verified_at) return res.status(400).json({ error: 'Your email is already verified.' })
  const sent = await sendVerificationCode(req.user)
  if (!sent) return res.status(429).json({ error: 'A code was sent recently. Wait a minute before asking for another.' })
  res.json({ ok: true })
})

router.post('/verify-email/confirm', verifyLimiter, requireAuth, async (req, res) => {
  if (req.user.email_verified_at) return res.json({ ok: true })
  if (!(await checkCode(req.user.id, 'verify_email', req.body?.code))) {
    return res.status(400).json({ error: 'That code is wrong or has expired. Check it or ask for a new one.' })
  }
  await pool.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [req.user.id])
  await logAudit({ action: 'email_verified', actor: req.user, targetUserId: req.user.id, targetUserName: req.user.name })
  res.json({ ok: true })
})

// ---- Forgotten password (not logged in) --------------------------------

// Always answers the same thing, whether or not the email has an account, so
// this can't be used to find out who is registered.
router.post('/password-reset/request', resetRequestLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const generic = { ok: true, message: "If an account with that email exists, we've sent it a code." }
  if (email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = rows[0]
    if (user && !user.deactivated_at) {
      // Not awaited: replying takes the same time either way.
      sendPasswordResetCode(user).catch((err) => console.error('reset code failed:', err.message))
    }
  }
  res.json(generic)
})

router.post('/password-reset/confirm', resetConfirmLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body || {}
  const bad = { error: 'That code is wrong or has expired. Check it or ask for a new one.' }
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'Email, code and new password are required.' })

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [String(email).trim().toLowerCase()])
  const user = rows[0]
  if (!user || user.deactivated_at) return res.status(400).json(bad)

  // Check the password rules BEFORE using up the code, so a too-weak password doesn't waste it.
  const problem = checkPassword(newPassword, { email: user.email, name: user.name })
  if (problem) return res.status(400).json({ error: problem })

  if (!(await checkCode(user.id, 'password_reset', code))) return res.status(400).json(bad)

  const hash = await bcrypt.hash(newPassword, 12)
  // token_version + 1 signs out every existing session (a thief included).
  // Being able to read the code also proves the email is theirs.
  await pool.query(
    'UPDATE users SET password_hash = $1, token_version = token_version + 1, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $2',
    [hash, user.id]
  )
  await invalidateAll(user.id, 'password_reset')
  await logAudit({ action: 'password_reset', actor: user, targetUserId: user.id, targetUserName: user.name })
  sendPasswordChangedNotice(user).catch(() => {})
  res.json({ ok: true })
})

export default router
