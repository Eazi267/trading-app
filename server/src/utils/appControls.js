import { pool } from '../db.js'

// Super-admin switches, stored in app_settings. Read from a small in-memory
// copy (refreshed every 30 seconds and right after a change), because the
// two-factor rule is checked on every admin request.
// Operations a super admin can protect with an emailed one-time code (clients only).
export const OTP_OPERATIONS = {
  withdrawal: { key: 'otp_withdrawal', label: 'Withdrawal requests' },
  deposit: { key: 'otp_deposit', label: 'Deposit requests' },
  wallet: { key: 'otp_wallet', label: 'Saving the withdrawal wallet' },
  session: { key: 'otp_session', label: 'Starting an investment session' },
  password: { key: 'otp_password', label: 'Changing the password' }
}
const cache = { require_admin_2fa: false, auto_transaction_emails: false }
for (const { key } of Object.values(OTP_OPERATIONS)) cache[key] = false

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
export function otpRequiredFor(op) { return !!OTP_OPERATIONS[op] && cache[OTP_OPERATIONS[op].key] === true }
export function otpSnapshot() { return Object.fromEntries(Object.keys(OTP_OPERATIONS).map((op) => [op, otpRequiredFor(op)])) }

export async function setControl(key, value, userId) {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [key, JSON.stringify(!!value), userId]
  )
  cache[key] = !!value
}
