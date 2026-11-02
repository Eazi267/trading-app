import { pool } from '../db.js'
import { getIdPrefix, ensureIdPrefix } from './idPrefix.js'

// Account ID, e.g.  PM-C-2611-0042
//   PM    company letters (Business Settings)
//   C / A client account / admin (staff) account
//   2611  joined in 2026, month 11 (YYMM)
//   0042  the 42nd account of that kind ever created (never reused)
export function formatUid(prefix, role, date, n) {
  const d = new Date(date)
  const yy = String(d.getUTCFullYear()).slice(-2)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${prefix}-${role === 'admin' ? 'A' : 'C'}-${yy}${mm}-${String(n).padStart(4, '0')}`
}

export const UID_PATTERN = /^[A-Z]{2,4}-[CA]-\d{4}-\d{4,}$/

export async function generateUid(role = 'user', joinedAt = new Date()) {
  const prefix = await getIdPrefix()
  const sequence = role === 'admin' ? 'uid_admin_seq' : 'uid_client_seq' // fixed names, never user input
  const { rows } = await pool.query(`SELECT nextval('${sequence}') AS n`)
  return formatUid(prefix, role, joinedAt, Number(rows[0].n))
}

// Runs at startup (safe to repeat): gives every account that still has an old-style ID
// (nine digits) the new kind, in the order the accounts were created, and fills in the
// ID of every transaction that has none yet.
export async function backfillIds() {
  const lock = await pool.query('SELECT pg_try_advisory_lock(7270001) AS ok')
  if (!lock.rows[0].ok) return
  try {
    const prefix = await ensureIdPrefix()
    if (!prefix) return
    const { rows: legacy } = await pool.query(
      "SELECT id, role, created_at FROM users WHERE uid IS NULL OR uid !~ '^[A-Z]{2,4}-[CA]-[0-9]{4}-[0-9]{4,}$' ORDER BY created_at, id")
    for (const u of legacy) {
      const uid = await generateUid(u.role, u.created_at)
      await pool.query('UPDATE users SET uid = $1 WHERE id = $2', [uid, u.id])
    }
    const done = await pool.query('UPDATE transactions SET ref = transaction_ref($1, type::text, created_at, id) WHERE ref IS NULL', [prefix])
    if (legacy.length || done.rowCount) console.log(`IDs: gave ${legacy.length} account(s) and ${done.rowCount} transaction(s) the new format (prefix ${prefix}).`)
  } finally {
    await pool.query('SELECT pg_advisory_unlock(7270001)')
  }
}
