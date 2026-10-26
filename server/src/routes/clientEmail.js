import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { hasPermission } from '../config/adminTiers.js'
import { logAudit } from '../utils/auditLog.js'
import { buildTransactionEmail, buildCustomEmail, eventForStatus, sendClientEmail } from '../utils/clientEmails.js'

// Admin -> client emails, from the client's page in the admin area.
//   template 'deposit' | 'withdrawal'  needs a transactionId of that client (finance permission)
//   template 'custom'                  needs subject + message (finance or support permission)
const router = Router()
router.use(requireAuth, requireRole('admin'))

const MAX_PER_HOUR = 10 // manual emails per client per hour: a typo-proof brake

function can(req, permission) {
  return hasPermission({ ...req.user, adminTier: req.user.admin_tier }, permission)
}

router.get('/:userId', async (req, res) => {
  if (!can(req, 'finance') && !can(req, 'support')) return res.status(403).json({ error: 'Not authorized.' })
  const { rows } = await pool.query(
    `SELECT e.id, e.kind, e.subject, e.status, e.error, e.transaction_id AS "transactionId", e.created_at AS "createdAt",
            u.name AS "sentByName"
       FROM sent_emails e LEFT JOIN users u ON u.id = e.sent_by
      WHERE e.user_id = $1 ORDER BY e.created_at DESC LIMIT 20`,
    [req.params.userId]
  )
  res.json({ emails: rows })
})

router.post('/:userId', async (req, res) => {
  const { template, transactionId, subject, message } = req.body || {}
  const { rows: found } = await pool.query("SELECT * FROM users WHERE id = $1 AND role = 'user'", [req.params.userId])
  const client = found[0]
  if (!client) return res.status(404).json({ error: 'Client not found.' })

  let mail, kind, txId = null
  if (template === 'deposit' || template === 'withdrawal') {
    if (!can(req, 'finance')) return res.status(403).json({ error: 'Sending transaction confirmations needs the finance permission.' })
    const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND type = $3', [Number(transactionId) || 0, client.id, template])
    if (!rows[0]) return res.status(400).json({ error: `Choose one of this client's ${template}s.` })
    txId = rows[0].id
    mail = await buildTransactionEmail(client, rows[0], eventForStatus(rows[0].status))
    kind = `manual_${template}`
  } else if (template === 'custom') {
    if (!can(req, 'finance') && !can(req, 'support')) return res.status(403).json({ error: 'Not authorized.' })
    const cleanSubject = String(subject || '').replace(/[\r\n]+/g, ' ').trim()
    const cleanMessage = String(message || '').trim()
    if (!cleanSubject || !cleanMessage) return res.status(400).json({ error: 'Write a subject and a message.' })
    if (cleanSubject.length > 150) return res.status(400).json({ error: 'Keep the subject under 150 characters.' })
    if (cleanMessage.length > 5000) return res.status(400).json({ error: 'Keep the message under 5000 characters.' })
    mail = await buildCustomEmail(client, cleanSubject, cleanMessage)
    kind = 'manual_custom'
  } else {
    return res.status(400).json({ error: 'Choose a deposit confirmation, a withdrawal confirmation, or a custom message.' })
  }

  const { rows: recent } = await pool.query("SELECT count(*)::int AS n FROM sent_emails WHERE user_id = $1 AND sent_by IS NOT NULL AND created_at > now() - interval '1 hour'", [client.id])
  if (recent[0].n >= MAX_PER_HOUR) return res.status(429).json({ error: 'That is a lot of emails to one client in an hour. Wait a while before sending more.' })

  const result = await sendClientEmail({ user: client, kind, ...mail, sentBy: req.user.id, transactionId: txId })
  await logAudit({
    action: 'client_email_sent', actor: req.user, targetUserId: client.id, targetUserName: client.name,
    details: { template, subject: mail.subject, status: result.status, transactionId: txId }
  })
  const note = {
    sent: `Email sent to ${client.email}.`,
    logged: 'Test mode: the email was written to the server log, NOT delivered. Set up an email provider to really send.',
    skipped: 'No email provider is set up on the server, so nothing was sent.',
    failed: 'The email provider refused the message. Check the provider settings.'
  }[result.status]
  res.status(result.status === 'failed' ? 502 : 200).json({ status: result.status, message: note })
})

export default router
