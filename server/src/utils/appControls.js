import { pool } from '../db.js'

// Super-admin switches, stored in app_settings. Read from a small in-memory
// copy (refreshed every 30 seconds and right after a change), because the
// two-factor rule is checked on every admin request.
const cache = { require_admin_2fa: false, auto_transaction_emails: false }

export async function refreshControls() {
  try {
    const { rows } = await pool.query('SELECT key, value FROM app_settings')
    for (const r of rows) if (r.key in cache) cache[r.key] = r.value === true
  } catch (err) {
    console.error('Could not refresh admin controls:', err.message)
  }
}

export function startControlsSync() {
  setInterval(refreshControls, 30 * 1000).unref()
}

export function forcedByServer() { return process.env.REQUIRE_ADMIN_2FA === '1' }
// The environment variable always wins (an on switch that the website can't turn off).
export function requireAdmin2faOn() { return forcedByServer() || cache.require_admin_2fa }
export function autoTransactionEmailsOn() { return cache.auto_transaction_emails }

export async function setControl(key, value, userId) {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [key, JSON.stringify(!!value), userId]
  )
  cache[key] = !!value
}
