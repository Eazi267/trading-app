import { Link } from 'react-router-dom'
import { PiggyBank, Lock, Unlock } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getTier } from '../config/tiers.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Balance() {
  const { currentUser } = useAuth()
  const { getBalanceBreakdown, getSessionsForUser, sessionCurrentValue } = useApp()

  const { total, available, pending } = getBalanceBreakdown(currentUser.id)
  const mySessions = getSessionsForUser(currentUser.id)

  return (
    <Layout pageTitle="Balance">
      <h1 className="page-title">Balance</h1>
      <p className="page-sub">
        Your balance updates automatically whenever a trading session closes — nothing here is ever entered by hand.
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
      </div>

      {pending > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '-6px 0 16px' }}>
          Pending balance is committed to active sessions and isn't available to withdraw until those sessions close.
        </p>
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
              <tr><th>Tier</th><th>Amount</th><th>Started</th><th>Status</th><th>Result</th></tr>
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
                    <td>{formatDate(s.startedAt)}</td>
                    <td><span className={'status-pill status-' + (s.status === 'active' ? 'pending' : 'approved')}>{s.status}</span></td>
                    <td className={livePnl >= 0 ? 'pnl-up' : 'pnl-down'}>
                      {s.status === 'active'
                        ? <>{livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)} (live)</>
                        : <>
                            {s.payout >= 0 ? '+' : ''}{formatMoney(s.payout)}
                            {wasCapped && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> (capped from {formatMoney(s.rawPnl)})</span>}
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
