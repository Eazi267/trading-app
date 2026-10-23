// Emergency helper: switches two-factor OFF for an account (lost phone AND lost
// recovery codes). Needs access to the server, so only YOU can run it.
// Usage (from the server/ folder):  node reset2fa.js admin@example.com
import { pool } from './src/db.js'

const email = process.argv[2]
if (!email) { console.log('Usage: node reset2fa.js admin@example.com'); process.exit(1) }
const { rowCount } = await pool.query(
  "UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_recovery = '[]'::jsonb, totp_last_step = 0, token_version = token_version + 1 WHERE email = $1",
  [email.trim().toLowerCase()]
)
console.log(rowCount ? `Done: two-factor is off for ${email} (all their sessions were signed out too).` : `No user found with email: ${email}`)
await pool.end()
