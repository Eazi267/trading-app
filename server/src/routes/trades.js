import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Trade history, in the same "order event" shape the frontend already
// uses (type 'open_position' / 'close_position'), rebuilt from the
// positions table — one open event per position, plus a close event once
// it has closed. Nothing here is stored separately, so it can never
// disagree with the real positions/sessions.
//
//   Client: always their own trades only.
//   Admin:  everyone's (newest first), or one client's with ?userId=.
//   ?limit= (default 1000, max 5000) caps how many positions are read.
router.get('/', requireAuth, async (req, res) => {
  const isAdmin = req.user.role === 'admin'
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 1), 5000)

  const params = []
  let where = ''
  if (!isAdmin) {
    params.push(req.user.id)
    where = 'WHERE s.user_id = $1'
  } else if (req.query.userId) {
    const userId = parseInt(req.query.userId, 10)
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid userId.' })
    params.push(userId)
    where = 'WHERE s.user_id = $1'
  }
  params.push(limit)

  const { rows } = await pool.query(
    `SELECT p.*, s.user_id AS owner_id,
            ob.name AS opened_by_name, cb.name AS closed_by_name, s.closed_reason
       FROM positions p
       JOIN trading_sessions s ON s.id = p.session_id
       LEFT JOIN users ob ON ob.id = p.opened_by_id
       LEFT JOIN users cb ON cb.id = p.closed_by_id
       ${where}
      ORDER BY p.opened_at DESC
      LIMIT $${params.length}`,
    params
  )

  const orders = []
  for (const p of rows) {
    const base = {
      userId: p.owner_id,
      sessionId: p.session_id,
      symbol: p.symbol,
      direction: p.direction,
      marginAmount: Number(p.margin_amount),
      leverage: Number(p.leverage)
    }
    // Only show "By <name>" when someone other than the client acted.
    const openedByOther = p.opened_by_id && p.opened_by_id !== p.owner_id
    const closedByOther = p.closed_by_id && p.closed_by_id !== p.owner_id
    orders.push({
      ...base,
      id: `p${p.id}-open`,
      type: 'open_position',
      price: Number(p.entry_price),
      pnl: null,
      executedByAdminName: openedByOther ? p.opened_by_name : null,
      date: p.opened_at
    })
    if (p.closed_at) {
      orders.push({
        ...base,
        id: `p${p.id}-close`,
        type: 'close_position',
        price: p.exit_price != null ? Number(p.exit_price) : null,
        pnl: p.pnl != null ? Number(p.pnl) : null,
        executedByAdminName: closedByOther ? p.closed_by_name : (p.closed_by_id ? null : 'Session settlement'),
        date: p.closed_at
      })
    }
  }
  orders.sort((a, b) => new Date(b.date) - new Date(a.date))
  res.json({ orders })
})

export default router
