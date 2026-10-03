import { randomUUID } from 'crypto'
import { pool } from '../db.js'

// The one entry point for a real event happening — mirrors
// NotificationContext.jsx's own comment on why: every route below
// that creates a notification calls THIS, so nothing can show up as
// an event without also being recorded, and nothing gets recorded
// twice by two different code paths drifting apart.
export async function notify(userId, type, title, message, meta = {}) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (id, user_id, type, title, message, meta)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [randomUUID(), userId, type, title, message, JSON.stringify(meta)]
  )
  return rows[0]
}

export async function notifyBulk(userIds, type, title, message, meta = {}) {
  const results = []
  for (const userId of userIds) {
    results.push(await notify(userId, type, title, message, meta))
  }
  return results
}
