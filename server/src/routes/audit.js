import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 1000

function publicEntry(row) {
  return {
    id: row.id,
    action: row.action,
    actorId: row.actor_id,
    actorName: row.actor_name,
    targetUserId: row.target_user_id,
    targetUserName: row.target_user_name,
    details: row.details,
    timestamp: row.timestamp
  }
}

// READ-ONLY, admin-only. There is deliberately no POST/PUT/DELETE
// here: entries are written only by the server itself (utils/
// auditLog.js, called from the routes that change things), so a
// browser can never forge or edit one. Newest first. Optional filters:
//   ?action=fee_charged   ?targetUserId=12   ?limit=200 (max 1000)
// `hasMore` says whether older entries exist beyond the limit.
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)

  const where = []
  const params = []
  if (req.query.action) {
    params.push(String(req.query.action))
    where.push(`action = $${params.length}`)
  }
  if (req.query.targetUserId) {
    const targetUserId = Number(req.query.targetUserId)
    if (!Number.isInteger(targetUserId)) return res.status(400).json({ error: 'targetUserId must be a whole number.' })
    params.push(targetUserId)
    where.push(`target_user_id = $${params.length}`)
  }

  // Ask for one extra row purely to learn whether more exist.
  params.push(limit + 1)
  const { rows } = await pool.query(
    `SELECT * FROM audit_log
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY timestamp DESC, id
     LIMIT $${params.length}`,
    params
  )

  res.json({ entries: rows.slice(0, limit).map(publicEntry), hasMore: rows.length > limit })
})

export default router
