import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'
import { getTier, clampLeverage, clampDuration } from '../config/tiers.js'
import { hasPermission } from '../config/adminTiers.js'
import { getAvailableBalance } from '../utils/balance.js'
import { getCurrentPrices } from '../services/priceEngine.js'
import { positionEquity, sessionCurrentValue, settleSession } from '../utils/sessions.js'
import { notify } from '../utils/notifications.js'

const router = Router()

function publicSession(row, liveValue) {
  return {
    id: row.id,
    userId: row.user_id,
    tierId: row.tier_id,
    amount: Number(row.amount),
    cash: Number(row.cash),
    leverage: Number(row.leverage),
    durationDays: row.duration_days,
    status: row.status,
    committedAt: row.committed_at,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    closedAt: row.closed_at,
    closedReason: row.closed_reason,
    endValue: row.end_value != null ? Number(row.end_value) : null,
    rawPnl: row.raw_pnl != null ? Number(row.raw_pnl) : null,
    payout: row.payout != null ? Number(row.payout) : null,
    excessPending: row.excess_pending != null ? Number(row.excess_pending) : null,
    liveValue: liveValue != null ? Number(liveValue.toFixed(2)) : undefined
  }
}

function publicPosition(row, currentPrices) {
  return {
    id: row.id,
    sessionId: row.session_id,
    symbol: row.symbol,
    direction: row.direction,
    entryPrice: Number(row.entry_price),
    marginAmount: Number(row.margin_amount),
    leverage: Number(row.leverage),
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    equity: row.closed_at == null ? Number(positionEquity(row, currentPrices).toFixed(2)) : undefined
  }
}

async function loadOwnedOrAdminSession(req, res, requirePerm = 'trade') {
  const { rows } = await pool.query('SELECT * FROM trading_sessions WHERE id = $1', [req.params.id])
  const session = rows[0]
  if (!session) {
    res.status(404).json({ error: 'Session not found.' })
    return null
  }
  const isOwner = session.user_id === req.user.id
  const isAdminWithPerm = req.user.role === 'admin' // fine-grained perm checked by caller when needed
  if (!isOwner && !isAdminWithPerm) {
    res.status(403).json({ error: 'Not authorized.' })
    return null
  }
  return session
}

// Starts a session — checked against real available balance (see
// utils/balance.js), so a session can never be funded by money that
// isn't actually there. targetUserId lets an admin start one on a
// client's behalf; omitted, it's the caller starting their own.
// Managed investment mode (only applies when a client commits to
// their OWN session — an admin acting on a client's behalf always
// goes straight to active) requires the settings table, so Managed
// mode is deferred here; every session goes straight to 'active' for
// now — flagged, not silently dropped.
router.post('/', requireAuth, async (req, res) => {
  const { targetUserId, tierId, amount, durationDays } = req.body || {}
  const ownerId = targetUserId || req.user.id
  if (targetUserId && targetUserId !== req.user.id) {
    // req.user is already the fresh DB row loaded by requireAuth —
    // no need to re-query it, just check the same permission table
    // requirePermission's middleware uses, since this route only
    // needs the check conditionally (self-service session start
    // needs no special permission at all).
    if (!hasPermission({ role: req.user.role, adminTier: req.user.admin_tier }, 'trade')) {
      return res.status(403).json({ error: 'Not authorized to start a session for another user.' })
    }
  }

  const tier = getTier(tierId)
  if (!tier) return res.status(400).json({ error: 'Invalid tier.' })
  const numAmount = Number(amount)
  if (!Number.isFinite(numAmount) || numAmount <= 0) return res.status(400).json({ error: 'Enter an amount above zero.' })
  if (numAmount < tier.minDeposit) return res.status(400).json({ error: `${tier.name} requires at least $${tier.minDeposit} per session.` })
  if (Number.isFinite(tier.maxDeposit) && numAmount > tier.maxDeposit) return res.status(400).json({ error: `${tier.name} allows at most $${tier.maxDeposit} per session.` })

  const { available } = await getAvailableBalance(ownerId)
  if (numAmount > available) return res.status(400).json({ error: 'Amount exceeds available balance.' })

  const resolvedDuration = clampDuration(tierId, durationDays || tier.durationDays)
  const startedAt = new Date()
  const expiresAt = new Date(startedAt.getTime() + resolvedDuration * 24 * 60 * 60 * 1000)

  const { rows } = await pool.query(
    `INSERT INTO trading_sessions (user_id, tier_id, amount, cash, leverage, duration_days, status, started_at, expires_at, initiated_by_id)
     VALUES ($1, $2, $3, $3, $4, $5, 'active', $6, $7, $8) RETURNING *`,
    [ownerId, tierId, numAmount.toFixed(2), tier.defaultLeverage, resolvedDuration, startedAt, expiresAt, req.user.id]
  )

  await logAudit({
    action: 'session_started',
    actor: req.user,
    targetUserId: ownerId,
    details: { sessionId: rows[0].id, tierId, amount: numAmount, durationDays: resolvedDuration }
  })

  res.status(201).json({ session: publicSession(rows[0]) })
})

router.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM trading_sessions WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id])
  const currentPrices = getCurrentPrices()
  const withValue = await Promise.all(rows.map(async (s) => {
    const { rows: positions } = await pool.query('SELECT * FROM positions WHERE session_id = $1 AND closed_at IS NULL', [s.id])
    const liveValue = s.status === 'active' ? await sessionCurrentValue(s, positions, currentPrices) : null
    return publicSession(s, liveValue)
  }))
  res.json({ sessions: withValue })
})

router.get('/:id', requireAuth, async (req, res) => {
  const session = await loadOwnedOrAdminSession(req, res)
  if (!session) return
  const currentPrices = getCurrentPrices()
  const { rows: positions } = await pool.query('SELECT * FROM positions WHERE session_id = $1 ORDER BY opened_at DESC', [session.id])
  const liveValue = session.status === 'active'
    ? await sessionCurrentValue(session, positions.filter((p) => !p.closed_at), currentPrices)
    : null
  res.json({
    session: publicSession(session, liveValue),
    positions: positions.map((p) => publicPosition(p, currentPrices))
  })
})

router.post('/:id/leverage', requireAuth, requirePermission('trade'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM trading_sessions WHERE id = $1', [req.params.id])
  const session = rows[0]
  if (!session || session.status !== 'active') return res.status(400).json({ error: 'Session is not active.' })
  const clamped = clampLeverage(session.tier_id, Number(req.body?.leverage))
  await pool.query('UPDATE trading_sessions SET leverage = $1 WHERE id = $2', [clamped, session.id])
  await logAudit({ action: 'session_leverage_changed', actor: req.user, targetUserId: session.user_id, details: { sessionId: session.id, previousLeverage: Number(session.leverage), newLeverage: clamped } })
  res.json({ leverage: clamped })
})

router.post('/:id/duration', requireAuth, requirePermission('trade'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM trading_sessions WHERE id = $1', [req.params.id])
  const session = rows[0]
  if (!session || session.status !== 'active') return res.status(400).json({ error: 'Session is not active.' })
  const clamped = clampDuration(session.tier_id, Number(req.body?.days))
  const newExpiresAt = new Date(new Date(session.started_at).getTime() + clamped * 24 * 60 * 60 * 1000)
  await pool.query('UPDATE trading_sessions SET expires_at = $1 WHERE id = $2', [newExpiresAt, session.id])
  await logAudit({ action: 'session_duration_changed', actor: req.user, targetUserId: session.user_id, details: { sessionId: session.id, newDurationDays: clamped, newExpiresAt } })
  res.json({ days: clamped, expiresAt: newExpiresAt })
})

// ADMIN-ONLY: opens a leveraged position scoped to ONE session's own
// cash. marginAmount is deducted from session.cash the moment it
// opens — the literal enforcement of "can only trade with the exact
// amount committed to this session." entryPrice always comes from
// getCurrentPrices() — never from the request body.
router.post('/:id/positions', requireAuth, requirePermission('trade'), async (req, res) => {
  const { symbol, marginAmount, direction = 'long' } = req.body || {}
  const { rows } = await pool.query('SELECT * FROM trading_sessions WHERE id = $1', [req.params.id])
  const session = rows[0]
  if (!session || session.status !== 'active') return res.status(400).json({ error: 'Session is not active.' })
  if (!['long', 'short'].includes(direction)) return res.status(400).json({ error: 'Invalid direction.' })

  const price = getCurrentPrices()[symbol]
  const numMargin = Number(marginAmount)
  if (!price) return res.status(400).json({ error: 'Unknown symbol.' })
  if (!Number.isFinite(numMargin) || numMargin <= 0) return res.status(400).json({ error: 'Enter a margin amount above zero.' })
  if (numMargin > Number(session.cash)) return res.status(400).json({ error: "Exceeds this session's available cash." })

  const { rows: posRows } = await pool.query(
    `INSERT INTO positions (session_id, symbol, direction, entry_price, margin_amount, leverage)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [session.id, symbol, direction, price, numMargin.toFixed(2), session.leverage]
  )
  await pool.query('UPDATE trading_sessions SET cash = cash - $1 WHERE id = $2', [numMargin.toFixed(2), session.id])

  await logAudit({
    action: 'session_position_opened',
    actor: req.user,
    targetUserId: session.user_id,
    details: { sessionId: session.id, symbol, direction, marginAmount: numMargin, leverage: Number(session.leverage), entryPrice: price }
  })
  await notify(session.user_id, 'trade_opened', 'Trade opened', `${symbol} ${direction === 'short' ? 'short' : 'long'} position opened — $${numMargin.toFixed(2)} margin at ${session.leverage}x.`, { sessionId: session.id, symbol, direction, marginAmount: numMargin })

  res.status(201).json({ position: publicPosition(posRows[0], getCurrentPrices()) })
})

// ADMIN-ONLY: closes one open position. Its full equity (margin +/-
// leveraged P&L, can be negative) returns to the session's cash — no
// auto-liquidation, matching the frontend's explicit "allow negative
// balance over auto-close at zero" decision. Row is kept (closed_at
// set), never deleted, so it stays in trade history.
router.post('/:id/positions/:positionId/close', requireAuth, requirePermission('trade'), async (req, res) => {
  const { rows: sessionRows } = await pool.query('SELECT * FROM trading_sessions WHERE id = $1', [req.params.id])
  const session = sessionRows[0]
  if (!session || session.status !== 'active') return res.status(400).json({ error: 'Session is not active.' })

  const { rows: posRows } = await pool.query('SELECT * FROM positions WHERE id = $1 AND session_id = $2 AND closed_at IS NULL', [req.params.positionId, session.id])
  const position = posRows[0]
  if (!position) return res.status(404).json({ error: 'Open position not found.' })

  const currentPrices = getCurrentPrices()
  const equity = positionEquity(position, currentPrices)
  const pnl = equity - Number(position.margin_amount)

  await pool.query('UPDATE positions SET closed_at = now() WHERE id = $1', [position.id])
  await pool.query('UPDATE trading_sessions SET cash = cash + $1 WHERE id = $2', [equity.toFixed(2), session.id])

  await logAudit({
    action: 'session_position_closed',
    actor: req.user,
    targetUserId: session.user_id,
    details: { sessionId: session.id, symbol: position.symbol, direction: position.direction, marginAmount: Number(position.margin_amount), exitPrice: currentPrices[position.symbol], pnl: Number(pnl.toFixed(2)) }
  })
  await notify(session.user_id, pnl >= 0 ? 'trade_closed_profit' : 'trade_closed_loss', pnl >= 0 ? 'Trade closed in profit' : 'Trade closed at a loss', `${position.symbol} position closed: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}.`, { sessionId: session.id, symbol: position.symbol, pnl: Number(pnl.toFixed(2)) })

  res.json({ equity: Number(equity.toFixed(2)), pnl: Number(pnl.toFixed(2)) })
})

// Manual close — an admin can close anytime; the owning client only
// once the timer has actually run out (mirrors closeSession()'s own
// isAdmin/isExpired check). Shares settleSession() with the
// auto-expiry job — one settlement path.
router.post('/:id/close', requireAuth, async (req, res) => {
  const session = await loadOwnedOrAdminSession(req, res)
  if (!session) return
  if (session.status !== 'active') return res.status(400).json({ error: 'Session is not active.' })

  const isAdmin = req.user.role === 'admin'
  const isExpired = session.expires_at && new Date(session.expires_at).getTime() <= Date.now()
  if (!isAdmin && !isExpired) return res.status(400).json({ error: "This session can't be closed until its timer ends." })

  const result = await settleSession(session, 'manual')
  await logAudit({
    action: 'session_closed',
    actor: req.user,
    targetUserId: session.user_id,
    details: { sessionId: session.id, payout: result.payout, rawPnl: result.rawPnl, excessPending: result.excessPending }
  })
  res.json({ session: publicSession(result.session), rawPnl: result.rawPnl, payout: result.payout, excessPending: result.excessPending })
})

export default router
