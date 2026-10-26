import { pool } from '../db.js'
import { sendMail, emailMode } from './mailer.js'
import { autoTransactionEmailsOn } from './appControls.js'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const METHODS = { usdt: 'USDT', btc: 'Bitcoin', bank: 'Bank transfer' }

async function brandName() {
  try {
    const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
    return rows[0]?.data?.brandName || process.env.APP_NAME || 'Pulse'
  } catch { return process.env.APP_NAME || 'Pulse' }
}

// event: 'received' (just requested) | 'approved' | 'rejected'
export function eventForStatus(status) {
  return status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'received'
}

export async function buildTransactionEmail(user, tx, event) {
  const brand = await brandName()
  const what = tx.type === 'deposit' ? 'deposit' : 'withdrawal'
  const method = METHODS[tx.method] ? ` via ${METHODS[tx.method]}${tx.chain ? ` (${tx.chain})` : ''}` : ''
  const ref = `#${tx.id}`
  const when = new Date(tx.created_at || Date.now()).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  const amount = money(tx.amount)
  const lines = {
    received: {
      subject: `${brand}: we received your ${what} request (${amount})`,
      body: `We received your ${what} request of ${amount}${method}. It is now waiting for review. We'll email you again once it has been reviewed.`
    },
    approved: {
      subject: `${brand}: your ${what} of ${amount} was approved`,
      body: tx.type === 'deposit'
        ? `Your deposit of ${amount}${method} has been confirmed and added to your balance.`
        : `Your withdrawal request of ${amount}${method} has been approved.`
    },
    rejected: {
      subject: `${brand}: your ${what} request (${amount}) was declined`,
      body: `Your ${what} request of ${amount}${method} was declined. If you have questions, please contact support and quote the reference below.`
    }
  }[event]
  const text = `Hi ${user.name},\n\n${lines.body}\n\nReference: ${ref}\nRequested: ${when}\n\nIf you didn't make this request, contact support immediately.\n\n${brand}\n`
  const html = `<p>Hi ${esc(user.name)},</p><p>${esc(lines.body)}</p><p>Reference: <strong>${ref}</strong><br>Requested: ${when}</p><p>If you didn't make this request, contact support immediately.</p><p>${esc(brand)}</p>`
  return { subject: lines.subject, text, html }
}

export async function buildCustomEmail(user, subject, message) {
  const brand = await brandName()
  const text = `Hi ${user.name},\n\n${message}\n\n${brand}\n`
  const html = `<p>Hi ${esc(user.name)},</p>${esc(message).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}<p>${esc(brand)}</p>`
  return { subject, text, html }
}

// Sends one email to a client and records it in sent_emails.
// Returns { status: 'sent' | 'logged' | 'skipped' | 'failed', error? }.
export async function sendClientEmail({ user, kind, subject, text, html, sentBy = null, transactionId = null }) {
  let status, error = null
  try {
    const r = await sendMail({ to: user.email, subject, text, html })
    status = r.delivered ? 'sent' : r.mode === 'console' ? 'logged' : 'skipped'
  } catch (err) {
    status = 'failed'; error = String(err.message).slice(0, 300)
    console.error('Client email failed:', err.message)
  }
  await pool.query(
    'INSERT INTO sent_emails (user_id, kind, subject, status, error, sent_by, transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [user.id, kind, subject, status, error, sentBy, transactionId]
  )
  return { status, error }
}

// Automatic emails about deposits and withdrawals. Does nothing unless the
// super admin switched it on. Never throws and never blocks the request.
export function autoTransactionEmail(tx, event) {
  if (!autoTransactionEmailsOn()) return
  if (tx.type !== 'deposit' && tx.type !== 'withdrawal') return
  ;(async () => {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [tx.user_id])
    const user = rows[0]
    if (!user || user.deactivated_at) return
    const mail = await buildTransactionEmail(user, tx, event)
    await sendClientEmail({ user, kind: `auto_${tx.type}_${event}`, ...mail, transactionId: tx.id })
  })().catch((err) => console.error('Automatic email failed:', err.message))
}

export { emailMode }
