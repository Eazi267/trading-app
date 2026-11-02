import { pool } from '../db.js'

// The letters that start every account and transaction ID (e.g. "PM" for Pulse Markets).
// Chosen by the admin in Business Settings; until then, worked out from the business name.
export function derivePrefix(name) {
  const words = String(name || '').replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length >= 2) return words.slice(0, 4).map((w) => w[0]).join('').toUpperCase()
  if (words.length === 1 && words[0].length >= 2) return words[0].slice(0, 2).toUpperCase()
  return 'PU'
}

export const PREFIX_PATTERN = /^[A-Z]{2,4}$/

export async function getIdPrefix() {
  try {
    const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
    const data = rows[0]?.data || {}
    if (PREFIX_PATTERN.test(data.idPrefix || '')) return data.idPrefix
    return derivePrefix(data.brandName || process.env.APP_NAME || 'Pulse')
  } catch {
    return 'PU'
  }
}

// Saves the worked-out prefix once, so it stays the same even if the business is renamed later
// (an ID, once given out, never changes by itself).
export async function ensureIdPrefix() {
  const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
  if (!rows[0]) return null
  const data = rows[0].data || {}
  if (PREFIX_PATTERN.test(data.idPrefix || '')) return data.idPrefix
  const prefix = derivePrefix(data.brandName || process.env.APP_NAME || 'Pulse')
  await pool.query('UPDATE settings SET data = data || $1::jsonb WHERE id = 1', [JSON.stringify({ idPrefix: prefix })])
  return prefix
}
