import crypto from 'crypto'
import { pool } from '../db.js'

const MAX_ATTEMPTS = 5          // wrong guesses before a code is dead
const TTL_MINUTES = 15
const MIN_GAP_SECONDS = 60      // at most one new code per minute...
const MAX_PER_HOUR = 5          // ...and five per hour, per person and purpose

function hashCode(userId, purpose, code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${userId}:${purpose}:${code}`).digest('hex')
}

// Can another code be sent to this person right now?
export async function canIssue(userId, purpose) {
  const { rows } = await pool.query(
    `SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS hour,
            max(created_at) AS last
       FROM email_codes WHERE user_id = $1 AND purpose = $2`,
    [userId, purpose]
  )
  const { hour, last } = rows[0]
  if (hour >= MAX_PER_HOUR) return false
  if (last && Date.now() - new Date(last).getTime() < MIN_GAP_SECONDS * 1000) return false
  return true
}

// Creates a fresh 6-digit code (older unused ones stop working) and returns it
// so it can be emailed. Only a keyed hash is stored.
export async function issueCode(userId, purpose) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  await pool.query('UPDATE email_codes SET consumed_at = now() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL', [userId, purpose])
  await pool.query(
    `INSERT INTO email_codes (user_id, purpose, code_hash, expires_at) VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [userId, purpose, hashCode(userId, purpose, code), String(TTL_MINUTES)]
  )
  return code
}

// Checks a typed code. Every guess is counted BEFORE it is compared (so
// parallel guesses can't sneak extra tries in), and a correct code is marked
// used in the same breath so it can never work twice.
export async function checkCode(userId, purpose, typed) {
  const clean = String(typed || '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  const { rows } = await pool.query(
    `SELECT id, code_hash FROM email_codes
      WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > now() AND attempts < $3
      ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose, MAX_ATTEMPTS]
  )
  if (!rows[0]) return false
  const counted = await pool.query('UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1 AND attempts < $2 RETURNING id', [rows[0].id, MAX_ATTEMPTS])
  if (!counted.rowCount) return false
  const a = Buffer.from(rows[0].code_hash), b = Buffer.from(hashCode(userId, purpose, clean))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  const used = await pool.query('UPDATE email_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id', [rows[0].id])
  return used.rowCount === 1
}

export async function invalidateAll(userId, purpose) {
  await pool.query('UPDATE email_codes SET consumed_at = now() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL', [userId, purpose])
}
