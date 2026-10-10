// One-time helper: turns an existing account into a super_admin.
// Usage (from the server/ folder):  node promote.js you@example.com
import { pool } from './src/db.js'

const email = process.argv[2]
if (!email) {
  console.log('Usage: node promote.js you@example.com')
  process.exit(1)
}

const { rowCount } = await pool.query(
  "UPDATE users SET role = 'admin', admin_tier = 'super_admin' WHERE email = $1",
  [email.trim().toLowerCase()]
)
console.log(rowCount ? `Done: ${email} is now super_admin` : `No user found with email: ${email}`)
await pool.end()
