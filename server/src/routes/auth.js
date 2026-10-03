import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { pool } from '../db.js'
import { generateUid } from '../utils/uid.js'
import { generateReferralCode } from '../utils/referralCode.js'
import { requireAuth } from '../middleware/auth.js'
import { publicUser } from '../utils/publicUser.js'

const router = Router()

function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
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

router.post('/signup', async (req, res) => {
  const { name, email, password, country, referredBy } = req.body || {}
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  }

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

  const token = signToken(user)
  res.status(201).json({ token, user: publicUser(user) })
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

  const token = signToken(user)
  res.json({ token, user: publicUser(user) })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

// Requires the current password before allowing a change — same
// basic safeguard as changePassword() on the frontend: anyone
// briefly at an unlocked session can't lock the real owner out
// without knowing the existing password.
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required.' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' })

  const valid = await bcrypt.compare(currentPassword, req.user.password_hash)
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' })

  const newHash = await bcrypt.hash(newPassword, 12)
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id])
  res.json({ ok: true })
})

export default router
