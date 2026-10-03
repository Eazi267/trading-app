import { pool } from '../db.js'
import { settleSession } from '../utils/sessions.js'

const SWEEP_INTERVAL_MS = 5000

// A session's expiresAt passing isn't itself an event anything reacts
// to — nothing pushes a "time's up" signal. This polls for it instead,
// same idea as the frontend's own per-tick expiry check inside its
// price interval, just running server-side so it happens whether or
// not anyone has the app open at that moment.
export function startAutoExpirySweep() {
  setInterval(async () => {
    try {
      const { rows: expired } = await pool.query(
        "SELECT * FROM trading_sessions WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= now()"
      )
      for (const session of expired) {
        await settleSession(session, 'auto_expired')
      }
    } catch (err) {
      console.error('Auto-expiry sweep failed:', err)
    }
  }, SWEEP_INTERVAL_MS)
}
