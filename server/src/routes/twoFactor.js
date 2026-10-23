import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'
import {
  generateSecret, otpauthUri, encryptSecret, decryptSecret,
  generateRecoveryCodes, hashRecoveryCode
} from '../utils/totp.js'
import { checkSecondFactor } from '../utils/secondFactor.js'

// Authenticator-app two-factor for ADMIN accounts (they can move money, so
// a stolen password alone must not be enough). Clients don't use it.
const router = Router()
router.use(requireAuth)
router.use((req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Two-factor login is for admin accounts.' })
  next()
})

// Step 1: create a secret (not active yet) and hand it to the admin to add to their app.
router.post('/setup', async (req, res) => {
  if (req.user.totp_enabled) return res.status(400).json({ error: 'Two-factor login is already on. Turn it off first to set it up again.' })
  const secret = generateSecret()
  await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [encryptSecret(secret), req.user.id])
  res.json({ secret, otpauthUri: otpauthUri(secret, req.user.email) })
})

// Step 2: prove the app works by entering a code; only then is it switched on.
router.post('/enable', async (req, res) => {
  if (req.user.totp_enabled) return res.status(400).json({ error: 'Two-factor login is already on.' })
  if (!req.user.totp_secret) return res.status(400).json({ error: 'Start the setup first.' })
  const check = await checkSecondFactor({ ...req.user, totp_recovery: [] }, req.body?.code, { allowRecovery: false })
  if (!check.ok) return res.status(400).json({ error: 'That code is not right. Check the 6 digits in your app and try again.' })
  const codes = generateRecoveryCodes()
  await pool.query(
    'UPDATE users SET totp_enabled = true, totp_recovery = $1 WHERE id = $2',
    [JSON.stringify(codes.map(hashRecoveryCode)), req.user.id]
  )
  await logAudit({ action: 'two_factor_enabled', actor: req.user, targetUserId: req.user.id, targetUserName: req.user.name })
  res.json({ ok: true, recoveryCodes: codes }) // shown ONCE; only hashes are kept
})

// Turning it off needs the password AND a current code (or recovery code).
router.post('/disable', async (req, res) => {
  const { password, code } = req.body || {}
  if (!req.user.totp_enabled) return res.status(400).json({ error: 'Two-factor login is not on.' })
  if (!password || !(await bcrypt.compare(password, req.user.password_hash))) {
    return res.status(400).json({ error: 'Password is incorrect.' })
  }
  const check = await checkSecondFactor(req.user, code)
  if (!check.ok) return res.status(400).json({ error: 'That code is not right.' })
  await pool.query(
    "UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_recovery = '[]'::jsonb, totp_last_step = 0 WHERE id = $1",
    [req.user.id]
  )
  await logAudit({ action: 'two_factor_disabled', actor: req.user, targetUserId: req.user.id, targetUserName: req.user.name })
  res.json({ ok: true })
})

export default router
