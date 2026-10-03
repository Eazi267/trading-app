import { pool } from '../db.js'
import { getTier } from '../config/tiers.js'
import { getCurrentPrices } from '../services/priceEngine.js'
import { notify } from './notifications.js'

// The real cash-out value of ONE open leveraged position, given a
// price snapshot. marginAmount is what the position actually risks;
// leverage multiplies both the gain AND the loss against that
// margin. direction flips which way that gain/loss runs: 'long'
// profits when price rises, 'short' profits when it falls. Mirrors
// AppContext.jsx's positionEquity() — this is the one function every
// place that needs a position's value calls, so long/short math
// can't drift between the manual-close route and the auto-expiry
// sweep job.
export function positionEquity(position, currentPrices) {
  const currentPrice = currentPrices[position.symbol]
  if (!currentPrice) return Number(position.margin_amount)
  const entryPrice = Number(position.entry_price)
  const margin = Number(position.margin_amount)
  const leverage = Number(position.leverage)
  const rawChange = (currentPrice - entryPrice) / entryPrice
  const signedChange = position.direction === 'short' ? -rawChange : rawChange
  return margin + margin * leverage * signedChange
}

// A session's live value = its uncommitted cash, plus the current
// mark-to-market equity of every position still open in it.
export async function sessionCurrentValue(session, openPositions, currentPrices) {
  const positionsValue = openPositions.reduce((sum, p) => sum + positionEquity(p, currentPrices), 0)
  return Number(session.cash) + positionsValue
}

// Settles a session at close (manual or auto-expiry): every open
// position's equity is realized, rawPnl is the honest uncapped
// result, and payout is rawPnl run through the tier's
// maxPayoutMultiplier — capping only the UPSIDE. A loss is never
// capped; only real, calculated gains are bounded, and only once a
// session actually closes (matches config/tiers.js's own comment on
// this). Whatever's capped away becomes excessPending, a separate
// pending transaction requiring its own admin review rather than
// being silently discarded or silently paid out in full.
export function computeSessionSettlement(session, openPositions, currentPrices) {
  const endValue = openPositions.reduce((sum, p) => sum + positionEquity(p, currentPrices), Number(session.cash))
  const rawPnl = endValue - Number(session.amount)

  const tier = getTier(session.tier_id)
  let payout = rawPnl
  let excessPending = 0
  if (tier && rawPnl > 0) {
    const cap = Number(session.amount) * (tier.maxPayoutMultiplier - 1) // multiplier is on total payout, cap here is on the PROFIT portion
    if (rawPnl > cap) {
      payout = cap
      excessPending = rawPnl - cap
    }
  }

  return { endValue, rawPnl, payout, excessPending }
}

// Closes one session for real: realizes every open position, writes
// the session's final state, marks positions closed (never deleted —
// they stay as trade history), and creates the pending
// session_settlement (+ capped_profit_release if the cap bit)
// transactions an admin has to certify before either amount reaches
// the client's real balance. Shared by the manual /close route and
// the auto-expiry sweep job — one settlement path, not two.
export async function settleSession(session, reason) {
  const { rows: openPositions } = await pool.query(
    'SELECT * FROM positions WHERE session_id = $1 AND closed_at IS NULL',
    [session.id]
  )
  const currentPrices = getCurrentPrices()
  const { endValue, rawPnl, payout, excessPending } = computeSessionSettlement(session, openPositions, currentPrices)

  await pool.query('UPDATE positions SET closed_at = now() WHERE session_id = $1 AND closed_at IS NULL', [session.id])
  const { rows: updated } = await pool.query(
    `UPDATE trading_sessions
     SET status = 'closed', closed_at = now(), cash = $1, end_value = $1,
         raw_pnl = $2, payout = $3, excess_pending = $4, closed_reason = $5
     WHERE id = $6 RETURNING *`,
    [endValue.toFixed(2), rawPnl.toFixed(2), payout.toFixed(2), excessPending.toFixed(2), reason, session.id]
  )

  await pool.query(
    `INSERT INTO transactions (user_id, type, amount, status, linked_session_id)
     VALUES ($1, 'session_settlement', $2, 'pending', $3)`,
    [session.user_id, payout.toFixed(2), session.id]
  )
  if (excessPending > 0) {
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, status, linked_session_id)
       VALUES ($1, 'capped_profit_release', $2, 'pending', $3)`,
      [session.user_id, excessPending.toFixed(2), session.id]
    )
  }

  await notify(
    session.user_id,
    payout >= 0 ? 'session_settled_profit' : 'session_settled_loss',
    payout >= 0 ? 'Session closed in profit' : 'Session closed at a loss',
    `Result: ${payout >= 0 ? '+' : ''}$${payout.toFixed(2)}${payout < rawPnl ? ' (capped by tier)' : ''} — pending admin certification before it's added to your balance.`,
    { sessionId: session.id, payout: Number(payout.toFixed(2)), rawPnl: Number(rawPnl.toFixed(2)) }
  )
  if (excessPending > 0) {
    await notify(
      session.user_id,
      'capped_profit_pending',
      'Extra profit pending review',
      `This session outperformed its tier cap by $${excessPending.toFixed(2)}. That extra amount is held for admin review before it's added to your balance.`,
      { sessionId: session.id, excessPending: Number(excessPending.toFixed(2)) }
    )
  }

  return { session: updated[0], endValue, rawPnl, payout, excessPending }
}
