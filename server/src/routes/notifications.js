import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { notifyBulk } from '../utils/notifications.js'

const router = Router()

function publicNotification(row) {
  return { id: row.id, type: row.type, title: row.title, message: row.message, meta: row.meta, read: row.read, date: row.created_at }
}

router.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id])
  res.json({ notifications: rows.map(publicNotification) })
})

router.get('/mine/unread-count', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false', [req.user.id])
  res.json({ count: Number(rows[0].count) })
})

router.post('/:id/read', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *',
    [req.params.id, req.user.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Notification not found.' })
  res.json({ notification: publicNotification(rows[0]) })
})

router.post('/read-all', requireAuth, async (req, res) => {
  await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [req.user.id])
  res.json({ ok: true })
})

// ADMIN-ONLY: broadcast/custom messaging. `userIds` picks specific
// recipients; `all: true` sends to every real (non-admin, non-demo)
// client. `type` is 'admin_broadcast' (default) or 'admin_message'
// (a one-to-one note from a client's detail page). Who sent it is
// recorded in meta, taken from the logged-in admin — never from the
// request body, so it can't be spoofed.
router.post('/broadcast', requireAuth, requirePermission('support'), async (req, res) => {
  const { userIds, all, title, message, type } = req.body || {}
  if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: 'Title and message are required.' })
  const kind = type === 'admin_message' ? 'admin_message' : 'admin_broadcast'

  let recipients = userIds
  if (all) {
    const { rows } = await pool.query("SELECT id FROM users WHERE role = 'user' AND deactivated_at IS NULL AND is_demo_generated = false")
    recipients = rows.map((r) => r.id)
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients — pass userIds or all: true.' })
  }

  const entries = await notifyBulk(recipients, kind, title.trim(), message.trim(), { sentByAdminName: req.user.name })
  res.status(201).json({ sentTo: entries.length })
})

// ADMIN-ONLY: the messages an admin has sent to one client, newest
// first — powers the "Recently sent" list on the client detail page.
router.get('/user/:userId', requireAuth, requirePermission('support'), async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM notifications WHERE user_id = $1 AND type = 'admin_message' ORDER BY created_at DESC LIMIT 20",
    [req.params.userId]
  )
  res.json({ notifications: rows.map(publicNotification) })
})

export default router
