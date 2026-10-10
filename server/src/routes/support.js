import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'
import { notify } from '../utils/notifications.js'

const router = Router()

const CATEGORIES = ['appeal', 'account', 'general', 'other']
const CATEGORY_LABELS = { appeal: 'Transaction Appeal', account: 'Account Issue', general: 'General Question', other: 'Other' }

function publicCase(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name, // present when joined, see /admin below
    subject: row.subject,
    category: row.category,
    relatedTransactionId: row.related_transaction_id,
    status: row.status,
    unreadForAdmin: row.unread_for_admin,
    unreadForClient: row.unread_for_client,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at
  }
}

function publicMessage(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    senderName: row.sender_name,
    body: row.body,
    createdAt: row.created_at
  }
}

// Attaches each case's full message thread (oldest first) in ONE extra
// query, so the frontend gets a complete case list in a single request
// instead of one request per case.
async function withMessages(caseRows) {
  if (caseRows.length === 0) return []
  const { rows: msgs } = await pool.query(
    'SELECT * FROM support_messages WHERE case_id = ANY($1::int[]) ORDER BY created_at ASC',
    [caseRows.map((c) => c.id)]
  )
  const byCase = {}
  msgs.forEach((m) => { (byCase[m.case_id] ||= []).push(publicMessage(m)) })
  return caseRows.map((row) => ({ ...publicCase(row), messages: byCase[row.id] || [] }))
}

// Loads a case and checks the requester can see it (owner, or an
// admin with the support permission) — shared by every route below
// that operates on a single case, so the same check can't drift
// between them.
async function loadAuthorizedCase(req, res) {
  const { rows } = await pool.query('SELECT * FROM support_cases WHERE id = $1', [req.params.id])
  const supportCase = rows[0]
  if (!supportCase) {
    res.status(404).json({ error: 'Case not found.' })
    return null
  }
  const isOwner = supportCase.user_id === req.user.id
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Not authorized to view this case.' })
    return null
  }
  return supportCase
}

router.post('/cases', requireAuth, async (req, res) => {
  const { subject, category, body, relatedTransactionId } = req.body || {}
  const text = body?.trim()
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' })
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` })

  const { rows } = await pool.query(
    `INSERT INTO support_cases (user_id, subject, category, related_transaction_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.id, subject?.trim() || CATEGORY_LABELS[category], category, relatedTransactionId || null]
  )
  const newCase = rows[0]

  const { rows: msgRows } = await pool.query(
    `INSERT INTO support_messages (case_id, sender_id, sender_role, sender_name, body)
     VALUES ($1, $2, 'client', $3, $4) RETURNING *`,
    [newCase.id, req.user.id, req.user.name, text]
  )

  res.status(201).json({ case: publicCase(newCase), message: publicMessage(msgRows[0]) })
})

router.get('/cases/mine', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT sc.*, $2::text AS user_name FROM support_cases sc WHERE sc.user_id = $1 ORDER BY sc.last_message_at DESC',
    [req.user.id, req.user.name]
  )
  res.json({ cases: await withMessages(rows) })
})

// Admin inbox — every case, optionally filtered by status, joined
// with the client's name.
router.get('/cases', requireAuth, requirePermission('support'), async (req, res) => {
  const { status } = req.query
  const params = []
  let where = ''
  if (status) {
    params.push(status)
    where = 'WHERE sc.status = $1'
  }
  const { rows } = await pool.query(
    `SELECT sc.*, u.name AS user_name FROM support_cases sc
     JOIN users u ON u.id = sc.user_id
     ${where}
     ORDER BY sc.last_message_at DESC`,
    params
  )
  res.json({ cases: await withMessages(rows) })
})

router.get('/cases/:id', requireAuth, async (req, res) => {
  const supportCase = await loadAuthorizedCase(req, res)
  if (!supportCase) return
  const { rows: messages } = await pool.query(
    'SELECT * FROM support_messages WHERE case_id = $1 ORDER BY created_at ASC',
    [supportCase.id]
  )
  res.json({ case: publicCase(supportCase), messages: messages.map(publicMessage) })
})

// Used by both a client replying to their own case and an admin
// replying to any case, same as sendCaseMessage on the frontend —
// one route covers both directions since the sender's role/name
// comes from req.user either way.
router.post('/cases/:id/messages', requireAuth, async (req, res) => {
  const { body } = req.body || {}
  const text = body?.trim()
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' })

  const supportCase = await loadAuthorizedCase(req, res)
  if (!supportCase) return

  const isAdminSender = req.user.role === 'admin'
  const { rows: msgRows } = await pool.query(
    `INSERT INTO support_messages (case_id, sender_id, sender_role, sender_name, body)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [supportCase.id, req.user.id, isAdminSender ? 'admin' : 'client', req.user.name, text]
  )

  // A new message reopens a resolved case automatically, either
  // side — same as the frontend.
  await pool.query(
    `UPDATE support_cases
     SET status = 'open', last_message_at = now(),
         unread_for_admin = CASE WHEN $1 THEN unread_for_admin ELSE true END,
         unread_for_client = CASE WHEN $1 THEN true ELSE unread_for_client END
     WHERE id = $2`,
    [isAdminSender, supportCase.id]
  )

  if (isAdminSender) {
    await notify(
      supportCase.user_id,
      'support_reply',
      `Support replied — ${supportCase.subject}`,
      text.length > 100 ? text.slice(0, 100) + '…' : text,
      { caseId: supportCase.id }
    )
    const { rows: targetUser } = await pool.query('SELECT name FROM users WHERE id = $1', [supportCase.user_id])
    await logAudit({
      action: 'support_reply_sent',
      actor: req.user,
      targetUserId: supportCase.user_id,
      targetUserName: targetUser[0]?.name,
      details: { caseId: supportCase.id, preview: text.length > 80 ? text.slice(0, 80) + '…' : text }
    })
  }

  res.status(201).json({ message: publicMessage(msgRows[0]) })
})

router.post('/cases/:id/status', requireAuth, requirePermission('support'), async (req, res) => {
  const { status } = req.body || {}
  if (!['open', 'resolved'].includes(status)) return res.status(400).json({ error: "status must be 'open' or 'resolved'." })

  const { rows } = await pool.query(
    'UPDATE support_cases SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Case not found.' })

  const { rows: targetUser } = await pool.query('SELECT name FROM users WHERE id = $1', [rows[0].user_id])
  await logAudit({
    action: status === 'resolved' ? 'support_case_resolved' : 'support_case_reopened',
    actor: req.user,
    targetUserId: rows[0].user_id,
    targetUserName: targetUser[0]?.name,
    details: { caseId: rows[0].id, subject: rows[0].subject }
  })

  res.json({ case: publicCase(rows[0]) })
})

// Clears the unread flag for whichever side is looking at the case:
// the owner clears the client flag, an admin clears the admin flag.
router.post('/cases/:id/read', requireAuth, async (req, res) => {
  const supportCase = await loadAuthorizedCase(req, res)
  if (!supportCase) return
  const column = req.user.role === 'admin' ? 'unread_for_admin' : 'unread_for_client'
  await pool.query(`UPDATE support_cases SET ${column} = false WHERE id = $1`, [supportCase.id])
  res.json({ ok: true })
})

export default router
