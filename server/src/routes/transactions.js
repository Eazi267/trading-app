import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'
import { feeOwedAmount } from '../utils/fees.js'
import { notify } from '../utils/notifications.js'
import { getActiveReferralCampaign, isFirstApprovedDeposit } from '../utils/referrals.js'

const router = Router()

// Every LISTING query goes through this so userName, reviewedByAdminName
// and executedByAdminName are always present — the old local
// transaction objects always carried them, and several screens
// (admin detail modal, fee lists, transaction tables) read them.
const TX_SELECT = `
  SELECT t.*, u.name AS user_name, u.uid AS user_uid,
         rv.name AS reviewed_by_name, cb.name AS charged_by_name
  FROM transactions t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN users rv ON rv.id = t.reviewed_by
  LEFT JOIN users cb ON cb.id = t.charged_by`

// 'fee_payment' is deliberately NOT createable here — it needs its
// allocation against outstanding fees computed and locked in at
// submission time (see routes/fees.js's POST /pay and
// utils/fees.js's allocateAgainstOutstandingFees), which this generic
// creator has no way to do. Creating one through here would produce a
// fee_payment with no allocation, silently paying nothing toward any
// fee when approved.
const ALLOWED_TYPES = ['deposit', 'withdrawal']

// Maps a DB row (snake_case) to the shape TransactionDetailModal.jsx
// etc. already expect — same camelCase-mapping pattern as
// routes/auth.js's publicUser().
function publicTx(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name, // only present when joined with users, see /pending below
    type: row.type,
    amount: Number(row.amount),
    method: row.method,
    chain: row.chain,
    status: row.status,
    note: row.note,
    clientConfirmed: row.client_confirmed,
    clientProofEvidence: row.client_proof_evidence,
    clientConfirmedAt: row.client_confirmed_at,
    reviewedAt: row.reviewed_at,
    requestedAmount: row.requested_amount != null ? Number(row.requested_amount) : null,
    correctionEvidence: row.correction_evidence,
    correctionNote: row.correction_note,
    correctedAt: row.corrected_at,
    appealed: row.appealed,
    appealedAt: row.appealed_at,
    // Fee-specific fields (Batch 6) — only meaningful on type 'fee',
    // undefined/null on everything else, same as the frontend's own
    // transaction objects always carrying every field regardless of
    // type. Previously only mapped in routes/fees.js's own publicFee()
    // for the /fees/outstanding endpoint — a 'fee' row fetched
    // through this general listing was silently missing all of this.
    feeStatus: row.fee_status,
    amountPaid: row.amount_paid != null ? Number(row.amount_paid) : undefined,
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : null,
    discountExpiresAt: row.discount_expires_at,
    linkedSessionId: row.linked_session_id,
    // fee_payment-specific (Batch 6)
    feeAllocations: row.fee_allocations,
    spilloverAmount: row.spillover_amount != null ? Number(row.spillover_amount) : undefined,
    // referral_bonus-specific (Batch 8)
    details: row.details,
    date: row.created_at,

    // ---- Compatibility aliases for the frontend's original field
    // names. The local transaction objects this API replaced used
    // different names than the backend's cleaner generic schema
    // (method/chain instead of depositMethod/withdrawalMethod, etc).
    // Rather than edit every screen that reads them, they're emitted
    // here, once, alongside the real fields — so nothing silently
    // renders blank. New code should prefer the generic names above.
    depositMethod: row.type === 'deposit' || row.type === 'fee_payment' ? row.method : undefined,
    depositChain: row.type === 'deposit' || row.type === 'fee_payment' ? row.chain : undefined,
    depositReference: row.type === 'deposit' || row.type === 'fee_payment' ? row.note : undefined,
    withdrawalMethod: row.type === 'withdrawal' ? row.method : undefined,
    withdrawalChain: row.type === 'withdrawal' ? row.chain : undefined,
    sessionId: row.linked_session_id,
    reviewedByAdminName: row.reviewed_by_name,
    reviewedByAdminId: row.reviewed_by,
    executedByAdminName: row.charged_by_name,
    campaignId: row.details?.campaignId,
    campaignName: row.details?.campaignName,
    referredUserId: row.details?.referredUserId,
    referredUserName: row.details?.referredUserName
  }
}

// Create a deposit/withdrawal/fee-payment request. Always starts
// 'pending' — nothing here can ever set status to 'approved' directly,
// same "balances calculated from transaction records, never
// hand-edited" guarantee the frontend enforces, now enforced
// server-side where a client genuinely can't bypass it by editing JS.
router.post('/', requireAuth, async (req, res) => {
  const { type, amount, method, chain, note } = req.body || {}
  if (!ALLOWED_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid transaction type.' })
  const numAmount = Number(amount)
  if (!Number.isFinite(numAmount) || numAmount <= 0) return res.status(400).json({ error: 'Amount must be a positive number.' })

  // `note` is the client's own payment reference for a deposit (a
  // tx hash, a bank reference) — what an admin matches against on the
  // receiving side. Trimmed and length-capped: it's free text from a
  // client, so it never gets to be arbitrarily large.
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null

  const { rows } = await pool.query(
    `INSERT INTO transactions (user_id, type, amount, method, chain, note)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user.id, type, numAmount.toFixed(2), method || null, chain || null, cleanNote]
  )
  res.status(201).json({ transaction: publicTx(rows[0]) })
})

router.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `${TX_SELECT} WHERE t.user_id = $1 ORDER BY t.created_at DESC`,
    [req.user.id]
  )
  res.json({ transactions: rows.map(publicTx) })
})

// Admin, everyone's transactions (or one client's with ?userId=) —
// what the admin dashboard's platform-wide totals/trends and a
// client detail page's full history both need, neither of which is
// "my own" or "pending". Deliberately role==='admin' broadly rather
// than gated to a specific permission — viewing platform totals
// isn't a money-moving action the way approving one is, matching the
// project's own "shared pages show role-broad data, individual
// actions are tier-gated" pattern (see principles-and-architecture).
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized.' })
  const { userId } = req.query
  const { rows } = userId
    ? await pool.query(`${TX_SELECT} WHERE t.user_id = $1 ORDER BY t.created_at DESC`, [userId])
    : await pool.query(`${TX_SELECT} ORDER BY t.created_at DESC`)
  res.json({ transactions: rows.map(publicTx) })
})

// Client self-report: "I've sent this, here's my proof" — see
// sql/002_transactions.sql's comment on why status never changes here.
router.post('/:id/proof', requireAuth, async (req, res) => {
  const { screenshots } = req.body || {}
  if (!Array.isArray(screenshots) || screenshots.length === 0) {
    return res.status(400).json({ error: 'Add at least one screenshot.' })
  }

  const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [req.params.id])
  const tx = rows[0]
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' })
  if (tx.user_id !== req.user.id) return res.status(403).json({ error: 'You can only submit proof for your own request.' })
  if (!['deposit', 'fee_payment'].includes(tx.type)) return res.status(400).json({ error: 'Proof can only be submitted for a deposit or fee payment.' })
  if (tx.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed.' })

  const { rows: updated } = await pool.query(
    `UPDATE transactions
     SET client_confirmed = true, client_proof_evidence = $1, client_confirmed_at = now()
     WHERE id = $2 RETURNING *`,
    [JSON.stringify(screenshots), tx.id]
  )
  await logAudit({
    action: 'deposit_proof_submitted',
    actor: req.user,
    targetUserId: req.user.id,
    targetUserName: req.user.name,
    details: { transactionId: tx.id, type: tx.type, screenshotCount: screenshots.length }
  })
  res.json({ transaction: publicTx(updated[0]) })
})

// Admin: pending queue, joined with the client's name/uid so the
// admin doesn't need a second request per row.
router.get('/pending', requireAuth, requirePermission('finance'), async (req, res) => {
  const { rows } = await pool.query(
    `${TX_SELECT} WHERE t.status = 'pending' ORDER BY t.created_at ASC`
  )
  res.json({ transactions: rows.map((r) => ({ ...publicTx(r), userUid: r.user_uid })) })
})

router.post('/:id/approve', requireAuth, requirePermission('finance'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [req.params.id])
  const tx = rows[0]
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' })
  if (tx.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed.' })

  const { rows: updated } = await pool.query(
    `UPDATE transactions SET status = 'approved', reviewed_by = $1, reviewed_at = now()
     WHERE id = $2 RETURNING *`,
    [req.user.id, tx.id]
  )

  // fee_payment approval doesn't just flip its own status — it has
  // to apply the allocation that was locked in at submission time
  // (see utils/fees.js's allocateAgainstOutstandingFees) to each
  // fee's amount_paid, flip any fee that reaches zero owed to
  // 'paid', and turn genuine spillover into a real separate deposit.
  // Mirrors approveTransaction()'s fee_payment branch in
  // AppContext.jsx — the fee_payment transaction itself never
  // touches main balance, it's entirely absorbed here.
  if (tx.type === 'fee_payment') {
    for (const allocation of tx.fee_allocations || []) {
      const { rows: feeRows } = await pool.query("SELECT * FROM transactions WHERE id = $1 AND type = 'fee'", [allocation.feeId])
      const fee = feeRows[0]
      if (!fee) continue
      const newAmountPaid = Number(fee.amount_paid || 0) + Number(allocation.amount)
      const stillOwed = feeOwedAmount({ ...fee, amount_paid: newAmountPaid })
      await pool.query(
        'UPDATE transactions SET amount_paid = $1, fee_status = $2 WHERE id = $3',
        [newAmountPaid, stillOwed <= 0 ? 'paid' : 'outstanding', fee.id]
      )
    }
    if (Number(tx.spillover_amount) > 0) {
      await pool.query(
        `INSERT INTO transactions (user_id, type, amount, status, note)
         VALUES ($1, 'deposit', $2, 'approved', 'Excess from fee payment')`,
        [tx.user_id, tx.spillover_amount]
      )
    }
  }

  const { rows: targetUser } = await pool.query('SELECT name FROM users WHERE id = $1', [tx.user_id])
  await logAudit({
    action: `${tx.type}_approved`,
    actor: req.user,
    targetUserId: tx.user_id,
    targetUserName: targetUser[0]?.name,
    details: { transactionId: tx.id, amount: Number(tx.amount) }
  })

  // Mirrors approveTransaction()'s per-type notify() calls in
  // AppContext.jsx — real events, so the client actually finds out,
  // not just an audit trail only admins can see.
  if (tx.type === 'deposit' || tx.type === 'withdrawal') {
    await notify(tx.user_id, `${tx.type}_approved`, `${tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'} approved`, `Your ${tx.type} of $${Number(tx.amount).toFixed(2)} was approved.`, { transactionId: tx.id, amount: Number(tx.amount) })
  } else if (tx.type === 'fee_payment') {
    const covered = Number(tx.amount) - Number(tx.spillover_amount || 0)
    const message = Number(tx.spillover_amount) > 0
      ? `Your payment of $${Number(tx.amount).toFixed(2)} cleared your Fee Balance ($${covered.toFixed(2)}) and the remaining $${Number(tx.spillover_amount).toFixed(2)} was added to your balance.`
      : `Your payment of $${Number(tx.amount).toFixed(2)} was applied to your Fee Balance.`
    await notify(tx.user_id, 'fee_paid', 'Fee payment approved', message, { transactionId: tx.id, amount: Number(tx.amount) })
  } else if (tx.type === 'session_settlement') {
    await notify(tx.user_id, 'session_settlement_certified', Number(tx.amount) >= 0 ? 'Session profit certified' : 'Session loss certified', `Your session result of ${Number(tx.amount) >= 0 ? '+' : ''}$${Number(tx.amount).toFixed(2)} was certified and moved to your main balance.`, { transactionId: tx.id, amount: Number(tx.amount) })
  } else if (tx.type === 'capped_profit_release') {
    await notify(tx.user_id, 'capped_profit_released', 'Pending profit released', `The extra $${Number(tx.amount).toFixed(2)} held above your tier cap was approved and added to your balance.`, { transactionId: tx.id, amount: Number(tx.amount) })
  }

  // Referral bonus — ONLY on a genuine deposit approval, and ONLY on
  // that depositor's very first approved deposit ever (see
  // isFirstApprovedDeposit). Pays out instantly and automatically
  // once a campaign is live — no separate approval step needed,
  // since the qualifying deposit already went through one. Mirrors
  // approveTransaction()'s referral block in AppContext.jsx.
  if (tx.type === 'deposit') {
    const { rows: depositorRows } = await pool.query('SELECT referred_by FROM users WHERE id = $1', [tx.user_id])
    const referredBy = depositorRows[0]?.referred_by
    if (referredBy) {
      const campaign = await getActiveReferralCampaign()
      const { rows: alreadyPaid } = await pool.query(
        "SELECT 1 FROM transactions WHERE type = 'referral_bonus' AND details->>'referredUserId' = $1 LIMIT 1",
        [String(tx.user_id)]
      )
      const firstDeposit = campaign ? await isFirstApprovedDeposit(tx.user_id, tx.id) : false
      if (campaign && alreadyPaid.length === 0 && firstDeposit) {
        const { rows: depositor } = await pool.query('SELECT name FROM users WHERE id = $1', [tx.user_id])
        await pool.query(
          `INSERT INTO transactions (user_id, type, amount, status, note, details)
           VALUES ($1, 'referral_bonus', $2, 'approved', $3, $4)`,
          [
            referredBy,
            campaign.bonus_amount,
            `Referral bonus — ${campaign.name}`,
            JSON.stringify({ campaignId: campaign.id, campaignName: campaign.name, referredUserId: tx.user_id, referredUserName: depositor[0]?.name })
          ]
        )
        await notify(
          referredBy,
          'referral_bonus',
          'Referral bonus earned!',
          `${depositor[0]?.name} made their first deposit — you earned a $${Number(campaign.bonus_amount).toFixed(2)} bonus from the "${campaign.name}" campaign.`,
          { amount: Number(campaign.bonus_amount), campaignId: campaign.id, referredUserId: tx.user_id }
        )
      }
    }
  }

  res.json({ transaction: publicTx(updated[0]) })
})

router.post('/:id/reject', requireAuth, requirePermission('finance'), async (req, res) => {
  const { reason } = req.body || {}
  const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [req.params.id])
  const tx = rows[0]
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' })
  if (tx.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed.' })

  const { rows: updated } = await pool.query(
    `UPDATE transactions SET status = 'rejected', reviewed_by = $1, reviewed_at = now()
     WHERE id = $2 RETURNING *`,
    [req.user.id, tx.id]
  )
  const { rows: targetUser } = await pool.query('SELECT name FROM users WHERE id = $1', [tx.user_id])
  await logAudit({
    action: `${tx.type}_rejected`,
    actor: req.user,
    targetUserId: tx.user_id,
    targetUserName: targetUser[0]?.name,
    details: { transactionId: tx.id, amount: Number(tx.amount), reason: reason || null }
  })
  res.json({ transaction: publicTx(updated[0]) })
})

// Admin: correct the amount actually received vs what was requested.
// Deposit/withdrawal only — see sql/004_transaction_corrections.sql's
// comment on why fee_payment correction waits for fee-pool
// allocation to exist. requested_amount is only set on the FIRST
// correction (COALESCE), same as the frontend's `tx.requestedAmount
// ?? tx.amount` — a transaction corrected twice keeps the original
// requested figure, not the first correction's figure.
router.post('/:id/correct', requireAuth, requirePermission('finance'), async (req, res) => {
  const { actualAmount, screenshots = [], note = '' } = req.body || {}
  const numAmount = Number(actualAmount)
  if (!Number.isFinite(numAmount) || numAmount <= 0) return res.status(400).json({ error: 'Enter the actual amount received.' })

  const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [req.params.id])
  const tx = rows[0]
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' })
  if (tx.status !== 'pending') return res.status(400).json({ error: 'Only a pending request can be corrected.' })
  if (!['deposit', 'withdrawal'].includes(tx.type)) {
    return res.status(400).json({ error: 'Fee payment correction is not available yet — it depends on fee-pool allocation, which is a separate unbuilt batch.' })
  }

  const { rows: updated } = await pool.query(
    `UPDATE transactions
     SET requested_amount = COALESCE(requested_amount, amount),
         amount = $1,
         correction_evidence = $2,
         correction_note = $3,
         corrected_at = now()
     WHERE id = $4 RETURNING *`,
    [numAmount.toFixed(2), JSON.stringify(screenshots), note || null, tx.id]
  )
  const { rows: targetUser } = await pool.query('SELECT name FROM users WHERE id = $1', [tx.user_id])
  await logAudit({
    action: 'transaction_amount_corrected',
    actor: req.user,
    targetUserId: tx.user_id,
    targetUserName: targetUser[0]?.name,
    details: {
      transactionId: tx.id,
      type: tx.type,
      requestedAmount: Number(updated[0].requested_amount),
      actualAmount: numAmount,
      note: note || undefined,
      screenshotCount: screenshots.length
    }
  })
  res.json({ transaction: publicTx(updated[0]) })
})

// Client appeal on a corrected transaction. Now creates a real
// linked support case (support_cases/support_messages, added in
// Batch 5) — Batch 4 shipped this recording the appeal without a
// case, explicitly flagged as incomplete until Support Cases existed
// rather than faking the link. This closes that gap.
router.post('/:id/appeal', requireAuth, async (req, res) => {
  const { note } = req.body || {}
  const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [req.params.id])
  const tx = rows[0]
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' })
  if (tx.user_id !== req.user.id) return res.status(403).json({ error: 'You can only appeal your own transactions.' })
  if (tx.requested_amount == null || Number(tx.requested_amount) === Number(tx.amount)) {
    return res.status(400).json({ error: 'Only a corrected transaction can be appealed.' })
  }
  if (tx.appealed) return res.status(400).json({ error: 'This transaction has already been appealed.' })

  const { rows: updated } = await pool.query(
    'UPDATE transactions SET appealed = true, appealed_at = now() WHERE id = $1 RETURNING *',
    [tx.id]
  )

  const requestedFmt = Number(tx.requested_amount).toFixed(2)
  const confirmedFmt = Number(tx.amount).toFixed(2)
  const trimmedNote = note?.trim()
  const caseBody = trimmedNote
    ? `I requested $${requestedFmt} but it was confirmed as $${confirmedFmt}. ${trimmedNote}`
    : `I requested $${requestedFmt} but it was confirmed as $${confirmedFmt}. Please review.`

  const { rows: caseRows } = await pool.query(
    `INSERT INTO support_cases (user_id, subject, category, related_transaction_id)
     VALUES ($1, $2, 'appeal', $3) RETURNING *`,
    [req.user.id, `Appeal — Transaction #${tx.id}`, tx.id]
  )
  const newCase = caseRows[0]
  await pool.query(
    `INSERT INTO support_messages (case_id, sender_id, sender_role, sender_name, body)
     VALUES ($1, $2, 'client', $3, $4)`,
    [newCase.id, req.user.id, req.user.name, caseBody]
  )

  await logAudit({
    action: 'transaction_appealed',
    actor: req.user,
    targetUserId: tx.user_id,
    targetUserName: req.user.name,
    details: {
      transactionId: tx.id,
      requestedAmount: Number(tx.requested_amount),
      confirmedAmount: Number(tx.amount),
      note: trimmedNote || undefined,
      caseId: newCase.id
    }
  })
  res.json({ transaction: publicTx(updated[0]), caseId: newCase.id })
})

export default router
