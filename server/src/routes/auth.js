import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { pool } from '../db.js'
import { generateUid } from '../utils/uid.js'
import { generateReferralCode } from '../utils/referralCode.js'
import { requireAuth } from '../middleware/auth.js'
import { publicUser } from '../utils/publicUser.js'
import { grantSignupBonus } from '../utils/signupBonus.js'
import { checkPassword } from '../utils/passwordPolicy.js'
import { logAudit } from '../utils/auditLog.js'
import { checkSecondFactor } from '../utils/secondFactor.js'
import { sendVerificationCode, sendPasswordChangedNotice } from '../utils/accountEmails.js'
import { setAuthCookie, clearAuthCookie, CSRF_HEADER, CSRF_VALUE } from '../utils/authCookie.js'
import { requireOtp } from '../middleware/otp.js'

const router = Router()

function signToken(user) {
  // v = the user's token_version: raising it in the DB cancels every older token.
  return jwt.sign({ sub: user.id, v: user.token_version ?? 0 }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// Starts a session: sets the HttpOnly cookie. The website identifies itself with
// the X-Requested-With header and then gets NO token in the response body (so
// nothing a script can read). Other clients (scripts, tests) still get the
// token in the body and can send it as a Bearer header.
function startSession(req, res, user, extra = {}, status = 200) {
  const token = signToken(user)
  setAuthCookie(res, token)
  const body = { ...extra }
  if (req.get(CSRF_HEADER) !== CSRF_VALUE) body.token = token
  return res.status(status).json(body)
}

// Maps a DB row (snake_case, includes password_hash) to the shape the
// frontend actually expects (camelCase, matching AuthContext.jsx's
// user objects) — and is the one place password_hash gets stripped,
// so it can never leak via a wide `...user` spread somewhere later.
// publicUser() is now shared — see utils/publicUser.js. Kept as one
// mapper instead of two copies once Batch 9 needed ~10 more fields.

// Brute-force guard on login specifically — signup is naturally
// rate-limited by requiring a unique email each time, login isn't.
// 10 attempts / 15 min per IP; generous enough for a genuine user who
// mistypes a password a few times, tight enough to make credential
// stuffing impractical.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' }
})

// Separate bucket for the 6-digit code step, so a normal two-factor login
// (password, then code) doesn't use up the password attempts.
const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' }
})

// Stops someone creating thousands of accounts from one address.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.SIGNUP_RATE_LIMIT) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-ups from this connection. Try again later.' }
})

router.post('/signup', signupLimiter, async (req, res) => {
  const { name, email, password, country, referredBy } = req.body || {}
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' })
  }
  const passwordProblem = checkPassword(password, { email, name })
  if (passwordProblem) return res.status(400).json({ error: passwordProblem })

  const normalizedEmail = email.trim().toLowerCase()
  const { rows: existingRows } = await pool.query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail])
  if (existingRows.length) return res.status(409).json({ error: 'An account with that email already exists.' })

  const passwordHash = await bcrypt.hash(password, 12)
  const uid = await generateUid()
  const referralCode = await generateReferralCode(name)

  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, uid, referral_code, referred_by, country)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name.trim(), normalizedEmail, passwordHash, uid, referralCode, referredBy || null, country || null]
  )
  const user = rows[0]
  await grantSignupBonus(user)
  // Email them a verification code. Not awaited and failures ignored: a broken
  // mail provider must never stop someone signing up.
  sendVerificationCode(user).catch((err) => console.error('verification email failed:', err.message))

  startSession(req, res, user, { user: publicUser(user) }, 201)
})

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()])
  const user = rows[0]

  // Same generic error whether the email doesn't exist or the
  // password is wrong — a distinct "no account with that email"
  // message would let an attacker enumerate which emails are
  // registered.
  const genericError = { error: "That email and password combination wasn't found." }
  if (!user || user.deactivated_at) return res.status(401).json(genericError)

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json(genericError)

  // Two-factor accounts don't get a session yet: they get a short-lived
  // "challenge" that is worthless on its own (it has no `sub`, so requireAuth
  // rejects it) and must be exchanged together with a valid code.
  if (user.totp_enabled) {
    const challenge = jwt.sign({ mfa: user.id, v: user.token_version }, process.env.JWT_SECRET, { expiresIn: '5m' })
    return res.json({ twoFactorRequired: true, challenge })
  }

  startSession(req, res, user, { user: publicUser(user) })
})

router.post('/login/2fa', twoFactorLimiter, async (req, res) => {
  const { challenge, code } = req.body || {}
  const bad = { error: 'That code is not right, or the sign-in timed out. Go back and log in again.' }
  let payload
  try { payload = jwt.verify(String(challenge || ''), process.env.JWT_SECRET) } catch { return res.status(401).json(bad) }
  if (!payload.mfa) return res.status(401).json(bad)

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.mfa])
  const user = rows[0]
  if (!user || user.deactivated_at || !user.totp_enabled || (payload.v ?? 0) !== user.token_version) return res.status(401).json(bad)

  const check = await checkSecondFactor(user, code)
  if (!check.ok) return res.status(401).json(bad)
  if (check.via === 'recovery') {
    await logAudit({ action: 'two_factor_recovery_used', actor: user, targetUserId: user.id, targetUserName: user.name })
  }
  startSession(req, res, user, { user: publicUser(user) })
})

// Signing out must clear the cookie from the server side: the page cannot
// delete an HttpOnly cookie itself.
router.post('/logout', (req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

// Requires the current password before allowing a change — same
// basic safeguard as changePassword() on the frontend: anyone
// briefly at an unlocked session can't lock the real owner out
// without knowing the existing password.
router.post('/change-password', requireAuth, requireOtp('password'), async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required.' })
  const passwordProblem = checkPassword(newPassword, { email: req.user.email, name: req.user.name })
  if (passwordProblem) return res.status(400).json({ error: passwordProblem })

  const valid = await bcrypt.compare(currentPassword, req.user.password_hash)
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' })

  const newHash = await bcrypt.hash(newPassword, 12)
  // Raising token_version signs this user out everywhere else; the new token
  // returned here keeps THIS browser signed in.
  const { rows: updated } = await pool.query(
    'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING *',
    [newHash, req.user.id]
  )
  await logAudit({ action: 'password_changed', actor: req.user, targetUserId: req.user.id, targetUserName: req.user.name })
  sendPasswordChangedNotice(req.user).catch(() => {})
  startSession(req, res, updated[0], { ok: true })
})

export default router
