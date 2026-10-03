import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { generateUid } from '../utils/uid.js'
import { generateReferralCode } from '../utils/referralCode.js'
import { logAudit } from '../utils/auditLog.js'
import { publicUser } from '../utils/publicUser.js'
import { ADMIN_TIERS } from '../config/adminTiers.js'

const router = Router()

const DEMO_FIRST_NAMES = ['Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas', 'Mia', 'Elijah', 'Amelia', 'James', 'Harper', 'Benjamin', 'Evelyn', 'Henry', 'Abigail', 'Alexander', 'Ella', 'Sebastian', 'Scarlett', 'Jack', 'Grace', 'Owen', 'Chloe', 'Daniel', 'Victoria', 'Matthew', 'Riley', 'Samuel', 'Zoey', 'David', 'Lily', 'Joseph', 'Hannah', 'Carter', 'Layla', 'Wyatt']
const DEMO_LAST_NAMES = ['Bennett', 'Carter', 'Diaz', 'Evans', 'Foster', 'Grant', 'Hayes', 'Ibrahim', 'Jensen', 'Kelly', 'Lawson', 'Mitchell', 'Nguyen', 'Ortiz', 'Parker', 'Quinn', 'Reyes', 'Sullivan', 'Turner', 'Underwood', 'Vance', 'Walsh', 'Xu', 'Young', 'Zimmerman', 'Abbott', 'Brooks', 'Chavez', 'Dawson', 'Ellis']
const DEMO_EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'proton.me']

function randomDemoName() {
  const first = DEMO_FIRST_NAMES[Math.floor(Math.random() * DEMO_FIRST_NAMES.length)]
  const last = DEMO_LAST_NAMES[Math.floor(Math.random() * DEMO_LAST_NAMES.length)]
  return `${first} ${last}`
}

async function demoEmailFor(name) {
  const domain = DEMO_EMAIL_DOMAINS[Math.floor(Math.random() * DEMO_EMAIL_DOMAINS.length)]
  const base = name.toLowerCase().replace(/[^a-z]+/g, '.')
  let suffix = ''
  let n = 1
  let email = `${base}${suffix}@${domain}`
  while ((await pool.query('SELECT 1 FROM users WHERE email = $1', [email])).rows.length) {
    suffix = String(n)
    email = `${base}${suffix}@${domain}`
    n += 1
  }
  return email
}

// publicUser() is now shared — see utils/publicUser.js.

// Closes the gap noted in every earlier batch: until now, the only
// way to create an admin was a manual SQL UPDATE. manageAdmins is
// super_admin-only (see config/adminTiers.js), same restriction as
// the frontend's Business Settings → Admin Accounts page.
router.post('/users', requireAuth, requirePermission('manageAdmins'), async (req, res) => {
  const { name, email, password, adminTier } = req.body || {}
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' })
  }
  if (!Object.keys(ADMIN_TIERS).includes(adminTier)) {
    return res.status(400).json({ error: `adminTier must be one of: ${Object.keys(ADMIN_TIERS).join(', ')}` })
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })

  const normalizedEmail = email.trim().toLowerCase()
  const { rows: existing } = await pool.query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail])
  if (existing.length) return res.status(409).json({ error: 'An account with that email already exists.' })

  const passwordHash = await bcrypt.hash(password, 12)
  const uid = await generateUid()
  const referralCode = await generateReferralCode(name)

  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, uid, referral_code, role, admin_tier)
     VALUES ($1, $2, $3, $4, $5, 'admin', $6) RETURNING *`,
    [name.trim(), normalizedEmail, passwordHash, uid, referralCode, adminTier]
  )
  const newAdmin = rows[0]

  await logAudit({
    action: 'admin_created',
    actor: req.user,
    targetUserId: newAdmin.id,
    targetUserName: newAdmin.name,
    details: { adminTier }
  })

  res.status(201).json({ user: publicUser(newAdmin) })
})

// Deactivate, never delete — the project's own non-negotiable rule
// (see principles-and-architecture), now enforced by there being no
// DELETE route for a user anywhere in this API, not just a UI
// convention. Reversible on purpose: re-activation is just clearing
// this same column, not a separate feature.
router.post('/users/:id/deactivate', requireAuth, requirePermission('manageAdmins'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id])
  const target = rows[0]
  if (!target) return res.status(404).json({ error: 'User not found.' })
  if (target.id === req.user.id) return res.status(400).json({ error: "You can't deactivate your own account." })

  const { rows: updated } = await pool.query(
    'UPDATE users SET deactivated_at = now() WHERE id = $1 RETURNING *',
    [target.id]
  )

  await logAudit({
    action: 'user_deactivated',
    actor: req.user,
    targetUserId: target.id,
    targetUserName: target.name
  })

  res.json({ user: publicUser(updated[0]) })
})

router.post('/users/:id/reactivate', requireAuth, requirePermission('manageAdmins'), async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE users SET deactivated_at = NULL WHERE id = $1 RETURNING *',
    [req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' })

  await logAudit({
    action: 'user_reactivated',
    actor: req.user,
    targetUserId: rows[0].id,
    targetUserName: rows[0].name
  })

  res.json({ user: publicUser(rows[0]) })
})

// Full client roster — AdminUsers.jsx's own page. Real accounts only
// by default; ?includeDemo=true also returns is_demo_generated rows.
router.get('/users', requireAuth, async (req, res) => {
  const { includeDemo, flagged } = req.query
  const conditions = ["role = 'user'"]
  if (!includeDemo) conditions.push('is_demo_generated = false')
  if (flagged) conditions.push('flagged_for_review = true')
  const { rows } = await pool.query(`SELECT * FROM users WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`)
  res.json({ users: rows.map(publicUser) })
})

router.get('/users/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' })
  res.json({ user: publicUser(rows[0]) })
})

// Admin assigns/changes a client's tier directly (e.g. after
// manually reviewing a flagged large account) — clears
// flaggedForReview at the same time, mirroring setUserTier() exactly.
router.post('/users/:id/tier', requireAuth, requirePermission('trade'), async (req, res) => {
  const { tierId } = req.body || {}
  const { rows } = await pool.query(
    'UPDATE users SET tier = $1, flagged_for_review = false WHERE id = $2 RETURNING *',
    [tierId || null, req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' })
  await logAudit({ action: 'tier_changed', actor: req.user, targetUserId: rows[0].id, targetUserName: rows[0].name, details: { tierId } })
  res.json({ user: publicUser(rows[0]) })
})

// Unlocks (or revokes, if vipTierId is null) a hidden VIP tier for
// self-service — separate from `tier`, adds an extra card the client
// can pick rather than replacing their standard assignment.
router.post('/users/:id/vip', requireAuth, requirePermission('manageAdmins'), async (req, res) => {
  const { vipTierId } = req.body || {}
  const { rows } = await pool.query('UPDATE users SET vip_unlocked = $1 WHERE id = $2 RETURNING *', [vipTierId || null, req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' })
  await logAudit({ action: vipTierId ? 'vip_unlocked' : 'vip_revoked', actor: req.user, targetUserId: rows[0].id, targetUserName: rows[0].name, details: { vipTierId } })
  res.json({ user: publicUser(rows[0]) })
})

// Flags an account for manual review (e.g. a real deposit came in
// above the large-account threshold) — doesn't touch the tier, a
// human decides what happens next. userId is req.user.id when a
// system/self-trigger flags it, or an admin id when an admin flags
// it directly.
router.post('/users/:id/flag', requireAuth, async (req, res) => {
  const { rows } = await pool.query('UPDATE users SET flagged_for_review = true WHERE id = $1 RETURNING *', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' })
  await logAudit({ action: 'flagged_for_review', actor: req.user, targetUserId: rows[0].id, targetUserName: rows[0].name })
  res.json({ user: publicUser(rows[0]) })
})

router.post('/users/:id/admin-tier', requireAuth, requirePermission('manageAdmins'), async (req, res) => {
  const { adminTier } = req.body || {}
  if (!Object.keys(ADMIN_TIERS).includes(adminTier)) return res.status(400).json({ error: `adminTier must be one of: ${Object.keys(ADMIN_TIERS).join(', ')}` })
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1 AND role = 'admin'", [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Admin not found.' })
  const previousTier = rows[0].admin_tier
  const { rows: updated } = await pool.query('UPDATE users SET admin_tier = $1 WHERE id = $2 RETURNING *', [adminTier, req.params.id])
  await logAudit({ action: 'admin_tier_changed', actor: req.user, targetUserId: updated[0].id, targetUserName: updated[0].name, details: { previousTier, newTier: adminTier } })
  res.json({ user: publicUser(updated[0]) })
})

// Flags a single client as individually requiring KYC even when the
// sitewide toggle (Settings) is off — independent switch, mirrors
// setKycRequired()'s own comment on why.
router.post('/users/:id/kyc-required', requireAuth, requirePermission('finance'), async (req, res) => {
  const { required } = req.body || {}
  const { rows } = await pool.query('UPDATE users SET kyc_required = $1 WHERE id = $2 RETURNING *', [!!required, req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' })
  await logAudit({ action: required ? 'kyc_individually_required' : 'kyc_individual_requirement_removed', actor: req.user, targetUserId: rows[0].id, targetUserName: rows[0].name })
  res.json({ user: publicUser(rows[0]) })
})

// Support/admin only (matches the frontend gating this on the
// `support` permission literally: finance_admin and support_admin
// both carry it, and only those two).
router.post('/users/:id/wallet/unbind', requireAuth, requirePermission('support'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id])
  const target = rows[0]
  if (!target) return res.status(404).json({ error: 'User not found.' })
  if (!target.bound_wallet) return res.status(400).json({ error: 'No wallet is bound for this client.' })

  const previous = target.bound_wallet
  const { rows: updated } = await pool.query('UPDATE users SET bound_wallet = NULL WHERE id = $1 RETURNING *', [target.id])
  await logAudit({
    action: 'wallet_unbound',
    actor: req.user,
    targetUserId: target.id,
    targetUserName: target.name,
    details: { previousMethod: previous.method, previousChain: previous.chain, previousAddress: previous.address }
  })
  res.json({ user: publicUser(updated[0]) })
})

// ADMIN-ONLY, demo tool. Creates `count` real client accounts with
// plausible names/emails — no balance or trade history, exactly like
// a real signup (no tier, no transactions). Tagged is_demo_generated
// so it can always be told apart from a genuine client and safely
// bulk-removed later, mirrors generateDemoClients() exactly.
router.post('/demo-clients', requireAuth, requirePermission('manageAdmins'), async (req, res) => {
  const count = Number(req.body?.count)
  if (!count || count <= 0) return res.status(400).json({ error: 'Enter a number of clients above zero.' })
  if (count > 200) return res.status(400).json({ error: 'Generate at most 200 at a time.' })

  const created = []
  for (let i = 0; i < count; i++) {
    const name = randomDemoName()
    const email = await demoEmailFor(name)
    const daysAgo = Math.floor(Math.random() * 90)
    const passwordHash = await bcrypt.hash(Math.random().toString(36).slice(2, 10), 12)
    const uid = await generateUid()
    const referralCode = await generateReferralCode(name)
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, uid, referral_code, is_demo_generated, created_by_admin_id, created_at)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7) RETURNING *`,
      [name, email, passwordHash, uid, referralCode, req.user.id, new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)]
    )
    created.push(rows[0])
  }

  await logAudit({ action: 'demo_clients_generated', actor: req.user, details: { count: created.length } })
  res.status(201).json({ users: created.map(publicUser) })
})

// Removes every account ever created by POST /demo-clients — real
// accounts (no is_demo_generated flag) are never touched, regardless
// of how this is called. Cascade-deletes any transactions/sessions
// that demo account created too, so no dangling FK references are
// left behind — deleting a demo user is safe specifically BECAUSE
// deactivate-never-delete is enforced for everyone else; this is the
// one deliberate, narrow exception, scoped to fake data only.
router.delete('/demo-clients', requireAuth, requirePermission('manageAdmins'), async (req, res) => {
  const { rows: demoUsers } = await pool.query('SELECT id FROM users WHERE is_demo_generated = true')
  const ids = demoUsers.map((u) => u.id)
  if (ids.length > 0) {
    await pool.query('DELETE FROM transactions WHERE user_id = ANY($1)', [ids])
    await pool.query('DELETE FROM positions WHERE session_id IN (SELECT id FROM trading_sessions WHERE user_id = ANY($1))', [ids])
    await pool.query('DELETE FROM trading_sessions WHERE user_id = ANY($1)', [ids])
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids])
  }
  await logAudit({ action: 'demo_clients_removed', actor: req.user, details: { count: ids.length } })
  res.json({ removedIds: ids })
})

export default router
