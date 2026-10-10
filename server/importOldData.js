// One-time helper: copies OLD browser-stored data (users, transactions,
// sessions + their open positions) into the real database.
//
//   node importOldData.js old-data.json            -> DRY RUN (changes nothing, shows what WOULD happen)
//   node importOldData.js old-data.json --commit   -> really imports
//
// Everything runs inside ONE database transaction: if anything fails,
// nothing is saved. Old numeric ids are re-mapped to new database ids by
// matching on email. Imported transactions are tagged "[imported]" in their
// note so they're easy to spot, and a user who already has imported
// transactions is skipped so re-running can't create duplicates.
import fs from 'fs'
import bcrypt from 'bcryptjs'
import { pool } from './src/db.js'

const file = process.argv[2]
const commit = process.argv.includes('--commit')
if (!file) {
  console.log('Usage: node importOldData.js old-data.json [--commit]')
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'))
const oldUsers = data.users || []
const oldTx = data.transactions || []
const oldSessions = data.sessions || []
const oldSettings = data.settings || null

// Transaction types the database understands. Anything else (e.g. the
// old 'signup_bonus', which has no backend logic) is skipped and reported.
const TX_TYPES = new Set(['deposit', 'withdrawal', 'fee_payment', 'fee', 'session_settlement', 'capped_profit_release', 'referral_bonus'])
const TX_STATUSES = new Set(['pending', 'approved', 'rejected'])
const SESSION_STATUSES = new Set(['awaiting_start', 'active', 'closed', 'cancelled'])
const CAN_BE_NEGATIVE = new Set(['session_settlement', 'capped_profit_release'])

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
const ts = (v) => (v ? new Date(v) : null)

const report = { usersAdded: 0, usersExisting: 0, txAdded: 0, txSkipped: [], sessionsAdded: 0, positionsAdded: 0, usersSkippedAlreadyImported: [], settings: 'none in file' }

const client = await pool.connect()
try {
  await client.query('BEGIN')

  // ---- 1. Users: match by email, create if missing -> idMap[oldId] = newId
  const idMap = {}
  for (const u of oldUsers) {
    const email = String(u.email || '').trim().toLowerCase()
    if (!email) continue
    const { rows: found } = await client.query('SELECT id FROM users WHERE email = $1', [email])
    if (found.length) {
      idMap[u.id] = found[0].id
      report.usersExisting++
      continue
    }
    if (!u.password) continue
    const hash = await bcrypt.hash(String(u.password), 12)
    const isAdmin = u.role === 'admin'
    const { rows } = await client.query(
      `INSERT INTO users (name, email, password_hash, uid, referral_code, country, role, admin_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [u.name || email, email, hash, u.uid, u.referralCode, u.country || null, isAdmin ? 'admin' : 'user', isAdmin ? (u.adminTier || 'super_admin') : null]
    )
    idMap[u.id] = rows[0].id
    report.usersAdded++
  }

  // ---- 2. Which users already had an import? (prevents duplicates)
  const alreadyImported = new Set()
  const { rows: tagged } = await client.query("SELECT DISTINCT user_id FROM transactions WHERE note LIKE '[imported]%'")
  tagged.forEach((r) => alreadyImported.add(r.user_id))
  const { rows: taggedSessions } = await client.query("SELECT DISTINCT user_id FROM trading_sessions WHERE closed_reason = 'imported' OR initiated_by_id IS NULL")
  taggedSessions.forEach((r) => alreadyImported.add(r.user_id))

  const skipUsers = new Set()
  for (const [oldId, newId] of Object.entries(idMap)) {
    if (alreadyImported.has(newId)) {
      skipUsers.add(oldId)
      const u = oldUsers.find((x) => String(x.id) === String(oldId))
      report.usersSkippedAlreadyImported.push(u?.email)
    }
  }

  // ---- 3. Sessions first (settlement transactions link to them)
  const sessionMap = {}
  for (const s of oldSessions) {
    const newUserId = idMap[s.userId]
    if (!newUserId || skipUsers.has(String(s.userId))) continue
    if (!SESSION_STATUSES.has(s.status)) continue
    const { rows } = await client.query(
      `INSERT INTO trading_sessions
         (user_id, tier_id, amount, cash, leverage, duration_days, status, committed_at, started_at, expires_at, closed_at, closed_reason, end_value, raw_pnl, payout, excess_pending)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [
        newUserId, s.tierId, num(s.amount), num(s.cash ?? s.amount), num(s.leverage ?? 1), s.durationDays ?? 1, s.status,
        ts(s.committedAt) || new Date(), ts(s.startedAt), ts(s.expiresAt), ts(s.closedAt), s.closedReason || null,
        num(s.endValue), num(s.rawPnl), num(s.payout), num(s.excessPending)
      ]
    )
    sessionMap[s.id] = rows[0].id
    report.sessionsAdded++

    // Open positions only exist inside active sessions (closed ones were never stored in the session itself).
    if (s.status === 'active') {
      for (const p of s.positions || []) {
        await client.query(
          `INSERT INTO positions (session_id, symbol, direction, entry_price, margin_amount, leverage, opened_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [rows[0].id, p.symbol, p.direction === 'short' ? 'short' : 'long', num(p.entryPrice), num(p.marginAmount), num(p.leverage ?? s.leverage ?? 1), ts(p.openedAt) || new Date()]
        )
        report.positionsAdded++
      }
    }
  }

  // ---- 4. Transactions
  for (const t of oldTx) {
    const newUserId = idMap[t.userId]
    if (!newUserId || skipUsers.has(String(t.userId))) continue
    const amount = num(t.amount)
    if (!TX_TYPES.has(t.type)) { report.txSkipped.push(`${t.type} (unsupported type)`); continue }
    if (!TX_STATUSES.has(t.status)) { report.txSkipped.push(`${t.type} (bad status ${t.status})`); continue }
    if (amount === null || !Number.isFinite(amount) || amount === 0 || (amount < 0 && !CAN_BE_NEGATIVE.has(t.type))) {
      report.txSkipped.push(`${t.type} (invalid amount ${t.amount})`)
      continue
    }
    const linkedSession = t.sessionId ? sessionMap[t.sessionId] || null : null
    const note = `[imported]${t.note ? ' ' + t.note : ''}`
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, method, chain, status, note, fee_status, amount_paid, linked_session_id, created_at, reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        newUserId, t.type, amount, t.method || null, t.chain || null, t.status, note,
        t.type === 'fee' ? (t.feeStatus === 'paid' ? 'paid' : 'outstanding') : null,
        num(t.amountPaid) || 0, linkedSession, ts(t.date) || new Date(), t.status === 'pending' ? null : ts(t.reviewedAt || t.date)
      ]
    )
    report.txAdded++
  }

  // ---- 5. Business settings (brand name/logo, tiers, deposit info...).
  // Only copied when the database has no brand set yet, so a re-run or a
  // later import can never overwrite settings you've since changed.
  if (oldSettings && Object.keys(oldSettings).length) {
    const { rows: cur } = await client.query('SELECT data FROM settings WHERE id = 1')
    const existing = cur[0]?.data || {}
    if (!existing.brandName) {
      await client.query('UPDATE settings SET data = $1, updated_at = now() WHERE id = 1', [JSON.stringify(oldSettings)])
      report.settings = 'imported'
    } else {
      report.settings = 'skipped (database already has settings)'
    }
  }

  console.log('\n=== Import summary ===')
  console.log(`Users added: ${report.usersAdded} | already existed: ${report.usersExisting}`)
  console.log(`Sessions added: ${report.sessionsAdded} | open positions added: ${report.positionsAdded}`)
  console.log(`Settings: ${report.settings}`)
  console.log(`Transactions added: ${report.txAdded} | skipped: ${report.txSkipped.length}`)
  report.txSkipped.slice(0, 15).forEach((r) => console.log(`   skipped: ${r}`))
  if (report.usersSkippedAlreadyImported.length) console.log(`Skipped (already imported earlier): ${report.usersSkippedAlreadyImported.join(', ')}`)

  if (commit) {
    await client.query('COMMIT')
    console.log('\nCOMMITTED - data is now in the database.')
  } else {
    await client.query('ROLLBACK')
    console.log('\nDRY RUN - nothing was saved. Re-run with --commit to import for real.')
  }
} catch (err) {
  await client.query('ROLLBACK')
  console.log(`\nFAILED, nothing was saved: ${err.message}`)
} finally {
  client.release()
  await pool.end()
}
