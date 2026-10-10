// One-time helper: copies OLD browser-stored accounts into the real database.
// Usage (from the server/ folder):  node importUsers.js old-users.json
// Passwords are hashed (bcrypt) on the way in — plain text is never stored.
// Accounts whose email already exists are skipped, so it's safe to re-run.
import fs from 'fs'
import bcrypt from 'bcryptjs'
import { pool } from './src/db.js'

const file = process.argv[2]
if (!file) {
  console.log('Usage: node importUsers.js old-users.json')
  process.exit(1)
}

const oldUsers = JSON.parse(fs.readFileSync(file, 'utf8'))
let added = 0
let skipped = 0

for (const u of oldUsers) {
  const email = String(u.email || '').trim().toLowerCase()
  if (!email || !u.password) { skipped++; continue }

  const { rows: existing } = await pool.query('SELECT 1 FROM users WHERE email = $1', [email])
  if (existing.length) { skipped++; console.log(`skip (already exists): ${email}`); continue }

  const hash = await bcrypt.hash(String(u.password), 12)
  const isAdmin = u.role === 'admin'
  try {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, uid, referral_code, country, role, admin_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [u.name || email, email, hash, u.uid, u.referralCode, u.country || null, isAdmin ? 'admin' : 'user', isAdmin ? (u.adminTier || 'super_admin') : null]
    )
    added++
    console.log(`added: ${email}`)
  } catch (err) {
    skipped++
    console.log(`failed: ${email} -> ${err.message}`)
  }
}

console.log(`\nDone. Added ${added}, skipped ${skipped}.`)
await pool.end()
