import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { TIERS, getTier } from '../config/tiers.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Sessions() {
  const { currentUser } = useAuth()
  const { getBalanceBreakdown, getSessionsForUser, startSession, closeSession, sessionCurrentValue } = useApp()
  const [selectedTier, setSelectedTier] = useState(TIERS[0].id)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const { available } = getBalanceBreakdown(currentUser.id)
  const mySessions = getSessionsForUser(currentUser.id)
  const activeSessions = mySessions.filter((s) => s.status === 'active')
  const closedSessions = mySessions.filter((s) => s.status === 'closed')

  function handleStart() {
    setError('')
    const value = parseFloat(amount)
    if (!value || value <= 0) {
      setError('Enter an amount above zero.')
      return
    }
    const result = startSession(currentUser.id, selectedTier, value)
    if (result.error) {
      setError(result.error)
      return
    }
    setAmount('')
  }

  return (
    <Layout pageTitle="Sessions">
      <h1 className="page-title">Trading sessions</h1>
      <p className="page-sub">
        Pick a tier and commit part of your available balance to a session. Results are calculated from real price
        movement — the tier only sets a ceiling on what a gain pays out; a loss is never capped.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Available to commit</div>
          <div className="stat-value">{formatMoney(available)}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Start a new session</h3></div>
        <div style={{ padding: '16px 20px' }}>
          <div className="tier-preview-grid">
            {TIERS.map((tier) => {
              const isSelected = selectedTier === tier.id
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTier(tier.id)}
                  className={'tier-preview-card' + (isSelected ? ' tier-preview-active' : '')}
                  style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
                >
                  <div className="tier-preview-head">
                    {isSelected && <CheckCircle2 size={14} />}
                    <strong>{tier.name}</strong>
                  </div>
                  <p>{tier.description}</p>
                  <div className="tier-preview-range">
                    {formatMoney(tier.minDeposit)} – {formatMoney(tier.maxDeposit)}
                  </div>
                  <div className="tier-preview-cap">Max payout: {tier.maxPayoutMultiplier * 100}% of session amount</div>
                </button>
              )
            })}
          </div>

          {error && <div className="form-error">{error}</div>}

          <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Amount to commit (USD)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: 14
              }}
            />
            <button className="tx-btn deposit" onClick={handleStart}>Start session</button>
          </div>
          {available <= 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10 }}>
              You don't have available balance yet — deposit first from the Deposit / Withdraw page.
            </p>
          )}
        </div>
      </div>

      {activeSessions.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h3>Active sessions</h3></div>
          <table>
            <thead><tr><th>Tier</th><th>Amount</th><th>Started</th><th>Live P&L</th><th>Action</th></tr></thead>
            <tbody>
              {activeSessions.map((s) => {
                const tier = getTier(s.tierId)
                const liveValue = sessionCurrentValue(s)
                const livePnl = liveValue - s.amount
                return (
                  <tr key={s.id}>
                    <td>{tier?.name || s.tierId}</td>
                    <td>{formatMoney(s.amount)}</td>
                    <td>{formatDate(s.startedAt)}</td>
                    <td className={livePnl >= 0 ? 'pnl-up' : 'pnl-down'}>
                      {livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)}
                    </td>
                    <td>
                      <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => closeSession(s.id)}>
                        End session
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>Past sessions</h3></div>
        {closedSessions.length === 0 ? (
          <div className="empty-state"><p>No completed sessions yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Tier</th><th>Amount</th><th>Started</th><th>Closed</th><th>Result</th></tr></thead>
            <tbody>
              {closedSessions.map((s) => {
                const tier = getTier(s.tierId)
                const wasCapped = s.payout < s.rawPnl
                return (
                  <tr key={s.id}>
                    <td>{tier?.name || s.tierId}</td>
                    <td>{formatMoney(s.amount)}</td>
                    <td>{formatDate(s.startedAt)}</td>
                    <td>{formatDate(s.closedAt)}</td>
                    <td className={s.payout >= 0 ? 'pnl-up' : 'pnl-down'}>
                      {s.payout >= 0 ? '+' : ''}{formatMoney(s.payout)}
                      {wasCapped && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> (capped from {formatMoney(s.rawPnl)})</span>}
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
