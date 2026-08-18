import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PiggyBank, Lock, Unlock, Receipt, Tag, Clock, Clock3, TrendingUp, TrendingDown, X as XIcon } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp, getFeeOwedAmount } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { getTier } from '../config/tiers.js'
import { resolveDisplayCurrency, formatCurrency } from '../config/currencies.js'
import AdminBalanceView from './AdminBalanceView.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// A short, human "time left" string for a discount's countdown —
// recomputed on every render from the real discountExpiresAt
// timestamp, not a ticking timer, so it's always accurate whenever
// the page is open or revisited.
function formatTimeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return null
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h left`
  }
  return `${hours}h ${minutes}m left`
}

export default function Balance() {
  const { currentUser } = useAuth()
  const { transactions, getBalanceBreakdown, getSessionsForUser, sessionCurrentValue, getOutstandingFees, payFeeBalance } = useApp()
  const { settings } = useSettings()

  if (currentUser.role === 'admin') {
    return (
      <Layout pageTitle="Admin Balance">
        <AdminBalanceView />
      </Layout>
    )
  }

  const { total, available, pending, pendingSessionSettlements, pendingCappedProfit, sessionBalance, outstandingFees } = getBalanceBreakdown(currentUser.id)
  const displayCurrency = resolveDisplayCurrency(currentUser, settings.currencyCode)
  const mySessions = getSessionsForUser(currentUser.id)
  const outstandingFeeList = getOutstandingFees(currentUser.id)

  const [payAmount, setPayAmount] = useState('')
  const [payError, setPayError] = useState('')
  const [paySuccess, setPaySuccess] = useState(null)

  // A Fee Balance payment already sitting in the approval queue —
  // checked from real pending-transaction data, not local state, so
  // this stays correct even after navigating away and back.
  const hasPendingFeePayment = transactions.some((t) => t.type === 'fee_payment' && t.status === 'pending')

  function handlePayFeeBalance() {
    setPayError('')
    setPaySuccess(null)
    const amount = parseFloat(payAmount)
    const result = payFeeBalance(amount)
    if (result.error) {
      setPayError(result.error)
      return
    }
    setPaySuccess(result)
    setPayAmount('')
  }

  return (
    <Layout pageTitle="Balance">
      <h1 className="page-title">Balance</h1>
      <p className="page-sub">
        Your balance updates automatically as investments close and transactions are processed.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label"><PiggyBank size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Total balance</div>
          <div className="stat-value">{formatMoney(total)}</div>
          {displayCurrency.code !== 'USD' && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>≈ {formatCurrency(total, displayCurrency.code)}</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label"><Unlock size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Available</div>
          <div className="stat-value">{formatMoney(available)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Lock size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Pending in sessions</div>
          <div className="stat-value">{formatMoney(pending)}</div>
        </div>
        {sessionBalance !== 0 && (
          <div className="stat-card" style={{ borderColor: 'var(--accent)' }}>
            <div className="stat-label"><Clock size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Session balance (awaiting certification)</div>
            <div className={'stat-value ' + (sessionBalance >= 0 ? 'pnl-up' : 'pnl-down')}>
              {sessionBalance >= 0 ? '+' : ''}{formatMoney(sessionBalance)}
            </div>
          </div>
        )}
        {outstandingFees > 0 && (
          <div className="stat-card" style={{ borderColor: 'var(--danger)' }}>
            <div className="stat-label"><Receipt size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Fee balance</div>
            <div className="stat-value pnl-down">-{formatMoney(outstandingFees)}</div>
          </div>
        )}
      </div>

      {pendingSessionSettlements !== 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -6, marginBottom: 16 }}>
          A recent session closed with a result of {pendingSessionSettlements >= 0 ? '+' : ''}{formatMoney(pendingSessionSettlements)}. It's held for admin certification before it's added to or deducted from your main balance — this applies to both profit and loss results.
        </p>
      )}

      {pendingCappedProfit > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -6, marginBottom: 16 }}>
          A recent session outperformed its tier's payout cap. The extra {formatMoney(pendingCappedProfit)} is held until
          your account manager applies a release fee for it and you pay it in full — check Outstanding Fees below,
          or contact your account manager if you don't see one yet.
        </p>
      )}

      {pending > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '-6px 0 16px' }}>
          Pending balance is committed to active sessions and isn't available to withdraw until those sessions close.
        </p>
      )}

      {outstandingFeeList.length > 0 && (
        <div className="panel" style={{ marginBottom: 16, borderColor: 'var(--danger)' }}>
          <div className="panel-head"><h3>Fee Balance — {formatMoney(outstandingFees)} owed</h3></div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '0 20px', marginTop: -6, marginBottom: 12 }}>
            Fees are separate from your main balance — they don't affect what you can trade or withdraw.
            Deposit any amount toward your Fee Balance below: it's applied to your oldest fees first, any
            leftover after everything's covered goes to your main balance, and if it's not enough your Fee
            Balance simply stays outstanding for whatever's left.
          </p>
          <table>
            <thead><tr><th>Date</th><th>Reason</th><th>Owed</th></tr></thead>
            <tbody>
              {outstandingFeeList.map((fee) => {
                const owed = getFeeOwedAmount(fee)
                const discounted = owed < fee.amount - (fee.amountPaid || 0)
                const timeLeft = fee.discountExpiresAt ? formatTimeLeft(fee.discountExpiresAt) : null
                return (
                  <tr key={fee.id}>
                    <td>{formatDate(fee.date)}</td>
                    <td>{fee.note || '—'}</td>
                    <td className="pnl-down">
                      {discounted ? (
                        <>
                          <span style={{ textDecoration: 'line-through', opacity: 0.5, marginRight: 6 }}>{formatMoney(fee.amount - (fee.amountPaid || 0))}</span>
                          {formatMoney(owed)}
                          {timeLeft && (
                            <div style={{ fontSize: 11, color: 'var(--accent-bright)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Tag size={11} /> Discount — {timeLeft}
                            </div>
                          )}
                        </>
                      ) : (
                        <>-{formatMoney(owed)}</>
                      )}
                      {fee.amountPaid > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatMoney(fee.amountPaid)} already paid</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Amount to deposit"
              style={{ width: 160, padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
            <button
              className="tx-btn deposit"
              style={{ padding: '9px 16px', fontSize: 13, flex: 'none' }}
              onClick={handlePayFeeBalance}
              disabled={hasPendingFeePayment}
            >
              {hasPendingFeePayment ? 'Awaiting approval' : 'Deposit toward fees'}
            </button>
          </div>
          {payError && <div className="form-error" style={{ margin: '0 20px 16px' }}>{payError}</div>}
          {paySuccess && (
            <div style={{ margin: '0 20px 16px', fontSize: 12.5, color: 'var(--success)' }}>
              Submitted — {paySuccess.spilloverAmount > 0
                ? `${formatMoney(paySuccess.amount - paySuccess.spilloverAmount)} will clear your Fee Balance and ${formatMoney(paySuccess.spilloverAmount)} will go to your main balance once approved.`
                : 'this will apply to your Fee Balance once approved.'}
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 16px' }}>
            Submitting needs admin approval, same as any deposit, before it actually clears anything.
          </p>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Investment history</h3>
          <Link to="/sessions" className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>
            Start an investment
          </Link>
        </div>
        {mySessions.length === 0 ? (
          <div className="empty-state"><p>No sessions yet — start one to see it here.</p></div>
        ) : (
          <div style={{ padding: 16 }}>
            {mySessions.map((s) => {
              const tier = getTier(s.tierId)
              const isAwaiting = s.status === 'awaiting_start'
              const isCancelled = s.status === 'cancelled'
              const liveValue = s.status === 'active' ? sessionCurrentValue(s) : s.endValue
              const livePnl = s.status === 'active' ? liveValue - s.amount : s.rawPnl
              const wasCapped = s.status === 'closed' && s.payout < s.rawPnl
              const settlementTx = s.status === 'closed'
                ? transactions.find((t) => t.sessionId === s.id && t.type === 'session_settlement')
                : null
              const awaitingCertification = settlementTx?.status === 'pending'
              const isProfitLike = !isAwaiting && !isCancelled && (s.status === 'active' ? livePnl >= 0 : s.payout >= 0)
              const accentClass = isAwaiting || isCancelled || awaitingCertification
                ? 'entity-card-accent-pending'
                : isProfitLike ? 'entity-card-accent-profit' : 'entity-card-accent-loss'
              return (
                <div key={s.id} className={'entity-card ' + accentClass}>
                  <div className="icon-badge">
                    {isCancelled ? <XIcon size={17} /> : isAwaiting ? <Clock3 size={17} /> : isProfitLike ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                  </div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">{tier?.name || s.tierId} · {formatMoney(s.amount)}</div>
                    <div className="entity-card-meta">
                      <span>{isAwaiting || isCancelled ? `Committed ${formatDate(s.committedAt)}` : formatDate(s.startedAt)}</span>
                      <span className={'status-pill status-' + (s.status === 'closed' ? 'approved' : s.status === 'cancelled' ? 'rejected' : 'pending')}>
                        {isAwaiting ? 'awaiting start' : s.status}
                      </span>
                      {!isAwaiting && !isCancelled && <span>{s.leverage}x leverage</span>}
                      {awaitingCertification && <span style={{ color: 'var(--accent-bright)' }}>Awaiting certification</span>}
                      {wasCapped && <span>Tier cap reached — extra {formatMoney(s.excessPending || (s.rawPnl - s.payout))} pending review</span>}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, flex: 'none' }} className={isAwaiting || isCancelled ? undefined : (isProfitLike ? 'pnl-up' : 'pnl-down')}>
                    {isCancelled
                      ? <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: 12.5 }}>Released</span>
                      : isAwaiting
                      ? <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: 12.5 }}>{s.durationDays}d pending</span>
                      : s.status === 'active'
                      ? <>{livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)}</>
                      : <>{s.payout >= 0 ? '+' : ''}{formatMoney(s.payout)}</>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
