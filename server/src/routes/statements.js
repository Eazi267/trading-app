import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Account statement for a date range, computed on the server from the same
// approved transaction records that make up the balance (see
// utils/balance.js) — so a statement can never disagree with the balance.
//
//   GET /api/statements?from=YYYY-MM-DD&to=YYYY-MM-DD[&userId=N]
//   Clients: always their own. Admins: any client via ?userId= (own if omitted).
//
// Only APPROVED balance-moving records appear (deposits, withdrawals,
// session settlements, released capped profit, referral/signup bonuses, and
// reversals — an admin's offsetting entry for a mistaken approved
// deposit/withdrawal, which adds or removes money per details.direction).
// Fees and fee payments don't move the main balance, so they're not lines
// here. Dates are UTC; a line is dated when it was approved
// (reviewed_at), or when it was created for records that never needed
// review (bonuses).
const CREDIT_TYPES = ['deposit', 'session_settlement', 'capped_profit_release', 'referral_bonus', 'signup_bonus']
const BALANCE_TYPES = [...CREDIT_TYPES, 'withdrawal', 'reversal']
const MAX_RANGE_DAYS = 366 * 2

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))
const money = (n) => Number(Number(n).toFixed(2))

const LABELS = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  session_settlement: 'Session result',
  capped_profit_release: 'Pending profit released',
  referral_bonus: 'Referral bonus',
  signup_bonus: 'Signup bonus',
  reversal: 'Reversal'
}

function describe(row) {
  let text = LABELS[row.type] || row.type
  if ((row.type === 'deposit' || row.type === 'withdrawal') && row.method) {
    text += ` (${String(row.method).toUpperCase()}${row.chain ? ' · ' + row.chain : ''})`
  }
  if (row.type === 'reversal') {
    text = `Reversal of ${row.details?.originalType || 'transaction'} #${row.details?.reversesTransactionId ?? '?'}`
  }
  if ((row.type === 'session_settlement' || row.type === 'capped_profit_release') && row.linked_session_id) {
    text += ` — session #${row.linked_session_id}`
  }
  return text
}

router.get('/', requireAuth, async (req, res) => {
  const { from, to } = req.query
  if (!isDate(from) || !isDate(to)) return res.status(400).json({ error: 'Choose a start and end date.' })
  const start = new Date(from + 'T00:00:00Z')
  const endExclusive = new Date(new Date(to + 'T00:00:00Z').getTime() + 24 * 60 * 60 * 1000)
  if (endExclusive <= start) return res.status(400).json({ error: 'The end date must be on or after the start date.' })
  if ((endExclusive - start) / 86400000 > MAX_RANGE_DAYS) return res.status(400).json({ error: 'Choose a range of two years or less.' })

  let userId = req.user.id
  if (req.query.userId && Number(req.query.userId) !== req.user.id) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized.' })
    userId = parseInt(req.query.userId, 10)
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid client.' })
  }

  const { rows: clientRows } = await pool.query('SELECT id, name, email, uid FROM users WHERE id = $1', [userId])
  if (!clientRows[0]) return res.status(404).json({ error: 'Client not found.' })

  const when = 'COALESCE(reviewed_at, created_at)'
  const signed = `CASE WHEN type = 'withdrawal' OR (type = 'reversal' AND details->>'direction' = 'debit') THEN -amount ELSE amount END`

  const { rows: opening } = await pool.query(
    `SELECT COALESCE(SUM(${signed}), 0) AS total FROM transactions
      WHERE user_id = $1 AND status = 'approved' AND type = ANY($2) AND ${when} < $3`,
    [userId, BALANCE_TYPES, start]
  )
  const { rows } = await pool.query(
    `SELECT id, type, amount, method, chain, linked_session_id, details, ${when} AS at
       FROM transactions
      WHERE user_id = $1 AND status = 'approved' AND type = ANY($2) AND ${when} >= $3 AND ${when} < $4
      ORDER BY ${when} ASC, id ASC`,
    [userId, BALANCE_TYPES, start, endExclusive]
  )

  const openingBalance = money(opening[0].total)
  let running = openingBalance
  const totals = { deposits: 0, withdrawals: 0, sessionResults: 0, bonuses: 0, reversals: 0 }
  const lines = rows.map((r) => {
    const amount = Number(r.amount)
    const change = r.type === 'withdrawal' || (r.type === 'reversal' && r.details?.direction === 'debit') ? -amount : amount
    running = money(running + change)
    if (r.type === 'deposit') totals.deposits += amount
    else if (r.type === 'withdrawal') totals.withdrawals += amount
    else if (r.type === 'session_settlement' || r.type === 'capped_profit_release') totals.sessionResults += amount
    else if (r.type === 'reversal') totals.reversals += change
    else totals.bonuses += amount
    return { id: r.id, date: r.at, type: r.type, description: describe(r), change: money(change), balance: running }
  })

  res.json({
    client: clientRows[0],
    period: { from, to },
    openingBalance,
    closingBalance: running,
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, money(v)])),
    lines
  })
})

export default router
