import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'
import { feeOwedAmount, outstandingFees, allocateAgainstOutstandingFees } from '../utils/fees.js'

const router = Router()

function publicFee(row) {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    note: row.note,
    feeStatus: row.fee_status,
    amountPaid: Number(row.amount_paid || 0),
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : null,
    discountExpiresAt: row.discount_expires_at,
    linkedSessionId: row.linked_session_id,
    owed: feeOwedAmount(row),
    createdAt: row.created_at
  }
}

// ADMIN-ONLY: charges a fee. Recorded and 'approved' immediately —
// unlike a deposit/withdrawal, a fee isn't something the client
// requested and an admin reviews; it's the admin's own action from
// the start. Never touches the client's main balance directly (see
// users.js's balance calc, which only sums deposit/withdrawal) — it
// becomes an outstanding invoice covered by whatever the client pays
// toward their Fee Balance (see POST /fee-payments below).
router.post('/', requireAuth, requirePermission('finance'), async (req, res) => {
  const { targetUserId, amount, note, discountAmount, durationHours, linkedSessionId } = req.body || {}
  const numAmount = Number(amount)
  if (!Number.isFinite(numAmount) || numAmount <= 0) return res.status(400).json({ error: 'Enter a fee amount above zero.' })

  const hasDiscount = discountAmount > 0
  if (hasDiscount) {
    if (discountAmount >= numAmount) return res.status(400).json({ error: 'Discount must be less than the fee amount.' })
    if (!durationHours || durationHours <= 0) return res.status(400).json({ error: 'Enter how long the discount should last.' })
  }
  const discountExpiresAt = hasDiscount ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString() : null

  const { rows } = await pool.query(
    `INSERT INTO transactions
       (user_id, type, amount, note, status, fee_status, amount_paid, discount_amount, discount_expires_at, linked_session_id, charged_by)
     VALUES ($1, 'fee', $2, $3, 'approved', 'outstanding', 0, $4, $5, $6, $7)
     RETURNING *`,
    [targetUserId, numAmount.toFixed(2), note || null, hasDiscount ? discountAmount : null, discountExpiresAt, linkedSessionId || null, req.user.id]
  )
  const fee = rows[0]

  const { rows: targetUser } = await pool.query('SELECT name FROM users WHERE id = $1', [targetUserId])
  await logAudit({
    action: 'fee_charged',
    actor: req.user,
    targetUserId,
    targetUserName: targetUser[0]?.name,
    details: { amount: numAmount, note, discountAmount: hasDiscount ? discountAmount : null, discountExpiresAt, linkedSessionId: linkedSessionId || null }
  })

  res.status(201).json({ fee: publicFee(fee) })
})

// ADMIN-ONLY: adds a time-limited discount to an already-outstanding
// fee. feeOwedAmount() checks the expiry fresh every time it's read,
// so there's no background timer process needed — the discount just
// stops applying once real time passes discount_expires_at.
router.post('/:id/discount', requireAuth, requirePermission('finance'), async (req, res) => {
  const { discountAmount, durationHours } = req.body || {}
  const { rows } = await pool.query("SELECT * FROM transactions WHERE id = $1 AND type = 'fee'", [req.params.id])
  const fee = rows[0]
  if (!fee) return res.status(404).json({ error: 'Fee not found.' })
  if (fee.fee_status !== 'outstanding') return res.status(400).json({ error: 'Only an outstanding fee can be discounted.' })
  if (!discountAmount || discountAmount <= 0) return res.status(400).json({ error: 'Enter a discount amount above zero.' })
  if (discountAmount >= Number(fee.amount)) return res.status(400).json({ error: 'Discount must be less than the fee amount.' })
  if (!durationHours || durationHours <= 0) return res.status(400).json({ error: 'Enter how long the discount should last.' })

  const discountExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
  const { rows: updated } = await pool.query(
    'UPDATE transactions SET discount_amount = $1, discount_expires_at = $2 WHERE id = $3 RETURNING *',
    [discountAmount, discountExpiresAt, fee.id]
  )

  await logAudit({
    action: 'fee_discount_applied',
    actor: req.user,
    targetUserId: fee.user_id,
    details: { feeId: fee.id, discountAmount, discountExpiresAt }
  })

  res.json({ fee: publicFee(updated[0]) })
})

// Every outstanding fee for the caller — what makes up their Fee
// Balance. Admins can pass ?userId= to view another user's.
router.get('/outstanding', requireAuth, async (req, res) => {
  const targetUserId = req.query.userId ? Number(req.query.userId) : req.user.id
  if (targetUserId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized.' })
  }
  const fees = await outstandingFees(targetUserId)
  res.json({ fees: fees.map(publicFee) })
})

// CLIENT-INITIATED: pays ANY amount toward the Fee Balance — the
// pooled total of everything currently owed (oldest fees first).
// Allocation is computed and LOCKED IN here, at submission time, not
// recalculated later at approval — mirrors payFeeBalance()'s own
// comment on why: a fee charged in between can't eat into money the
// client already committed, and a discount expiring in the meantime
// can't retroactively change what was owed when they acted.
router.post('/pay', requireAuth, async (req, res) => {
  const { amount, method, chain, note } = req.body || {}
  const numAmount = Number(amount)
  if (!Number.isFinite(numAmount) || numAmount <= 0) return res.status(400).json({ error: 'Enter an amount above zero.' })
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null

  const fees = await outstandingFees(req.user.id)
  if (fees.length === 0) return res.status(400).json({ error: 'No outstanding fees to pay.' })

  const { allocations, spilloverAmount } = await allocateAgainstOutstandingFees(req.user.id, numAmount)

  const { rows } = await pool.query(
    `INSERT INTO transactions (user_id, type, amount, method, chain, note, fee_allocations, spillover_amount)
     VALUES ($1, 'fee_payment', $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [req.user.id, numAmount.toFixed(2), method || null, chain || null, cleanNote, JSON.stringify(allocations), spilloverAmount]
  )

  res.status(201).json({ transaction: { id: rows[0].id, amount: numAmount, allocations, spilloverAmount, status: rows[0].status } })
})

export default router
