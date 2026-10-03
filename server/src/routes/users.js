import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { getAvailableBalance } from '../utils/balance.js'
import { publicUser } from '../utils/publicUser.js'
import { logAudit } from '../utils/auditLog.js'

const router = Router()

// "Balances are always calculated from transaction records, never
// hand-edited" — the project's own non-negotiable rule, enforced here
// the only way that actually holds: there is no balance COLUMN
// anywhere to edit. See utils/balance.js for the shared calculation
// (also used by routes/sessions.js to check funds before starting a
// session — one calculation, not two that could drift).
router.get('/me/balance', requireAuth, async (req, res) => {
  const { total, available, pending } = await getAvailableBalance(req.user.id)
  res.json({ balance: total, available, pending })
})

// Only the fields a client is allowed to self-edit — role, tier,
// verification status, and anything admin-controlled are deliberately
// absent from this list, so a client can never PATCH their own way
// into admin, regardless of what they send in the body.
const SELF_EDITABLE_FIELDS = { name: 'name', phone: 'phone', avatar: 'avatar', country: 'country', preferredCurrency: 'preferred_currency' }

router.patch('/me', requireAuth, async (req, res) => {
  const updates = req.body || {}
  const setClauses = []
  const values = []
  for (const [key, column] of Object.entries(SELF_EDITABLE_FIELDS)) {
    if (key in updates) {
      values.push(updates[key])
      setClauses.push(`${column} = $${values.length}`)
    }
  }
  if (setClauses.length === 0) return res.status(400).json({ error: 'Nothing to update.' })

  values.push(req.user.id)
  const { rows } = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  )

  await logAudit({
    action: 'profile_updated',
    actor: req.user,
    targetUserId: req.user.id,
    targetUserName: req.user.name,
    details: { updatedFields: Object.keys(updates).filter((k) => k in SELF_EDITABLE_FIELDS) }
  })

  res.json({ user: publicUser(rows[0]) })
})

// Client-only, self-service — binding itself IS the security feature
// (the client locking their own withdrawal path down, not something
// needing review). Can only be set once from here; changing it after
// requires a human on the support side (see routes/admin.js's
// wallet/unbind), so a compromised account can't silently redirect
// future withdrawals — mirrors bindWallet()'s own reasoning exactly.
router.post('/me/wallet', requireAuth, async (req, res) => {
  if (req.user.bound_wallet) return res.status(400).json({ error: 'A wallet is already bound to this account. Contact support to change it.' })
  const { method, chain, address } = req.body || {}
  if (!method || !address?.trim()) return res.status(400).json({ error: 'Choose a method and enter your wallet address.' })

  const boundWallet = { method, chain: chain || null, address: address.trim(), boundAt: new Date().toISOString() }
  const { rows } = await pool.query('UPDATE users SET bound_wallet = $1 WHERE id = $2 RETURNING *', [JSON.stringify(boundWallet), req.user.id])

  await logAudit({
    action: 'wallet_bound',
    actor: req.user,
    targetUserId: req.user.id,
    targetUserName: req.user.name,
    details: { method, chain, address: address.trim() }
  })

  res.json({ user: publicUser(rows[0]) })
})

router.get('/:id/referrals', requireAuth, async (req, res) => {
  const targetId = Number(req.params.id)
  if (targetId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized.' })
  const { rows } = await pool.query('SELECT * FROM users WHERE referred_by = $1', [targetId])
  res.json({ referrals: rows.map(publicUser) })
})

export default router
