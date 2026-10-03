import { pool } from '../db.js'

// Same shape as the frontend's generateUid() in AuthContext.jsx: a
// unique 9-digit numeric string, re-rolled on collision. Kept
// identical on purpose — once the frontend switches from its own
// localStorage-generated UIDs to reading them from this API, existing
// demo UIDs should look no different from real ones.
export async function generateUid() {
  let uid
  let exists = true
  while (exists) {
    uid = String(Math.floor(100000000 + Math.random() * 900000000))
    const { rows } = await pool.query('SELECT 1 FROM users WHERE uid = $1', [uid])
    exists = rows.length > 0
  }
  return uid
}
