import { pool } from '../db.js'
import { randomUUID } from 'crypto'

// Every state-changing action gets an audit entry — same
// non-negotiable rule as the frontend's AuditContext.jsx. actorName
// and targetUserName are denormalized on purpose (see
// sql/001_init.sql's comment): the log has to keep reading correctly
// even after the actor or target is later renamed or deactivated.
export async function logAudit({ action, actor, targetUserId = null, targetUserName = null, details = {} }) {
  await pool.query(
    `INSERT INTO audit_log (id, action, actor_id, actor_name, target_user_id, target_user_name, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), action, actor?.id ?? null, actor?.name ?? 'System', targetUserId, targetUserName, JSON.stringify(details)]
  )
}
