import { Link } from 'react-router-dom'
import { PiggyBank, Lock, Unlock, Receipt } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getTier } from '../config/tiers.js'
import AdminBalanceView from './AdminBalanceView.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Balance() {
  const { currentUser } = useAuth()
  const { transactions, getBalanceBreakdown, getSessionsForUser, sessionCurrentValue, getOutstandingFees, payOutstandingFee } = useApp()

  if (currentUser.role === 'admin') {
    return (
      <Layout pageTitle="Admin Balance">
        <AdminBalanceView />
      </Layout>
    )
  }

  const { total, available, pending, pendingCappedProfit, outstandingFees } = getBalanceBreakdown(currentUser.id)
  const mySessions = getSessionsForUser(currentUser.id)
  const outstandingFeeList = getOutstandingFees(currentUser.id)

  // A fee already has a pending payment request sitting in the
  // approval queue if there's a pending deposit tagged with its id —
  // checked from real data, not local state, so this stays correct
  // even after navigating away and back (local state would forget).
  function hasPendingPayment(feeId) {
    return transactions.some((t) => t.payingFeeId === feeId && t.status === 'pending')
  }

  function handlePayFee(feeId) {
    payOutstandingFee(feeId)
  }

  return (
    <Layout pageTitle="Balance">
      <h1 className="page-title">Balance</h1>
      <p className="page-sub">
        Your balance updates automatically as trading sessions close and transactions are processed.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label"><PiggyBank size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Total balance</div>
          <div className="stat-value">{formatMoney(total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Unlock size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Available</div>
          <div className="stat-value">{formatMoney(available)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Lock size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Pending in sessions</div>
          <div className="stat-value">{formatMoney(pending)}</div>
        </div>
        {pendingCappedProfit > 0 && (
          <div className="stat-card" style={{ borderColor: 'var(--accent)' }}>
            <div className="stat-label">Pending profit review</div>
            <div className="stat-value">{formatMoney(pendingCappedProfit)}</div>
          </div>
        )}
        {outstandingFees > 0 && (
          <div className="stat-card" style={{ borderColor: 'var(--danger)' }}>
            <div className="stat-label"><Receipt size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Outstanding fees</div>
            <div className="stat-value pnl-down">-{formatMoney(outstandingFees)}</div>
          </div>
        )}
      </div>

      {pendingCappedProfit > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -6, marginBottom: 16 }}>
          A recent session outperformed its tier's payout cap. The extra {formatMoney(pendingCappedProfit)} is held for admin review before it's added to your available balance.
        </p>
      )}

      {pending > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '-6px 0 16px' }}>
          Pending balance is committed to active sessions and isn't available to withdraw until those sessions close.
        </p>
      )}

      {outstandingFeeList.length > 0 && (
        <div className="panel" style={{ marginBottom: 16, borderColor: 'var(--danger)' }}>
          <div className="panel-head"><h3>Outstanding fees</h3></div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '0 20px', marginTop: -6, marginBottom: 12 }}>
            Each fee stays outstanding until you deposit its exact amount — that specific deposit is what clears it, once an admin approves it.
          </p>
          <table>
            <thead><tr><th>Date</th><th>Reason</th><th>Amount</th><th>Action</th></tr></thead>
            <tbody>
              {outstandingFeeList.map((fee) => (
                <tr key={fee.id}>
                  <td>{formatDate(fee.date)}</td>
                  <td>{fee.note || '—'}</td>
                  <td className="pnl-down">-{formatMoney(fee.amount)}</td>
                  <td>
                    <button
                      className="tx-btn deposit"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => handlePayFee(fee.id)}
                      disabled={hasPendingPayment(fee.id)}
                    >
                      {hasPendingPayment(fee.id) ? 'Awaiting approval' : `Pay ${formatMoney(fee.amount)}`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 20px 16px' }}>
            Paying submits a deposit request for that exact amount — it needs admin approval, same as any deposit, before the fee clears.
          </p>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Session history</h3>
          <Link to="/sessions" className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>
            Start a session
          </Link>
        </div>
        {mySessions.length === 0 ? (
          <div className="empty-state"><p>No sessions yet — start one to see it here.</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>Tier</th><th>Amount</th><th>Leverage</th><th>Started</th><th>Status</th><th>Result</th></tr>
            </thead>
            <tbody>
              {mySessions.map((s) => {
                const tier = getTier(s.tierId)
                const liveValue = s.status === 'active' ? sessionCurrentValue(s) : s.endValue
                const livePnl = s.status === 'active' ? liveValue - s.amount : s.rawPnl
                const wasCapped = s.status === 'closed' && s.payout < s.rawPnl
                return (
                  <tr key={s.id}>
                    <td>{tier?.name || s.tierId}</td>
                    <td>{formatMoney(s.amount)}</td>
                    <td>{s.leverage}x</td>
                    <td>{formatDate(s.startedAt)}</td>
                    <td><span className={'status-pill status-' + (s.status === 'active' ? 'pending' : 'approved')}>{s.status}</span></td>
                    <td className={livePnl >= 0 ? 'pnl-up' : 'pnl-down'}>
                      {s.status === 'active'
                        ? <>{livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)} (live)</>
                        : <>
                            {s.payout >= 0 ? '+' : ''}{formatMoney(s.payout)}
                            {wasCapped && (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                {' '}(tier cap reached — extra {formatMoney(s.excessPending || (s.rawPnl - s.payout))} pending review)
                              </span>
                            )}
                          </>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
