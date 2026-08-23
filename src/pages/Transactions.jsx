import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { ArrowDownCircle, ArrowUpCircle, Inbox, Check, X, Clock, Hourglass } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { LARGE_ACCOUNT_THRESHOLD } from '../config/tiers.js'
import { getPendingRequestsSummary, getDepositWithdrawTrend } from '../utils/adminAnalytics.js'
import { resolveDisplayCurrency, formatCurrency, CURRENCIES } from '../config/currencies.js'
import { CRYPTO_CHAINS, METHOD_LABELS } from '../config/paymentMethods.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}



function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatType(type) {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function StatCard({ icon: Icon, label, value, formatter }) {
  const animated = useCountUp(value)
  return (
    <div className="glass-card hero-stat-card fade-in-up">
      <div className="hero-stat-icon"><Icon size={17} /></div>
      <div className="hero-stat-label">{label}</div>
      <div className="hero-stat-value">{formatter(animated)}</div>
    </div>
  )
}

function AdminTransactionsView() {
  const { transactions, approveTransaction, rejectTransaction, isSessionUnlocked } = useApp()
  const pending = transactions.filter((t) => t.status === 'pending')
  const resolved = transactions.filter((t) => t.status !== 'pending').slice(0, 15)
  const summary = getPendingRequestsSummary(transactions)
  const [trendDays, setTrendDays] = useState(14)
  const trend = getDepositWithdrawTrend(transactions, trendDays)

  return (
    <>
      <h1 className="page-title">Deposits &amp; Withdrawals</h1>
      <p className="page-sub">Approve, reject, and analyze every client deposit, withdrawal, and pending profit release.</p>

      <div className="hero-stats-grid">
        <StatCard icon={ArrowDownCircle} label="Pending deposits" value={summary.deposits.amount} formatter={formatMoney} />
        <StatCard icon={ArrowUpCircle} label="Pending withdrawals" value={summary.withdrawals.amount} formatter={formatMoney} />
        <StatCard icon={Hourglass} label="Pending profit reviews" value={summary.cappedProfitReleases.amount} formatter={formatMoney} />
        <StatCard icon={Clock} label="Total awaiting action" value={pending.length} formatter={(v) => Math.round(v).toString()} />
      </div>

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3>Deposits vs withdrawals — last {trendDays} days</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setTrendDays(d)}
                className="tx-btn"
                style={{
                  padding: '5px 10px', fontSize: 11,
                  background: trendDays === d ? 'var(--accent)' : 'var(--bg)',
                  color: trendDays === d ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)'
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={Math.max(0, Math.floor(trendDays / 10) - 1)} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} formatter={(v) => formatMoney(v)} />
            <Bar dataKey="deposits" fill="var(--success)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="withdrawals" fill="var(--danger)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Awaiting action ({pending.length})</h3></div>
        {pending.length === 0 ? (
          <div className="empty-state"><Inbox size={20} /><p>Nothing pending right now.</p></div>
        ) : (
          <table>
            <thead><tr><th>Client</th><th>Type</th><th>Amount</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              {pending.map((t) => {
                const isLockedExcess = t.type === 'capped_profit_release' && !isSessionUnlocked(t.sessionId)
                return (
                  <tr key={t.id}>
                    <td>{t.userName}</td>
                    <td>
                      {formatType(t.type)}
                      {t.type === 'fee_payment' && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {t.spilloverAmount > 0
                            ? `${formatMoney(t.amount - t.spilloverAmount)} to Fee Balance, ${formatMoney(t.spilloverAmount)} spills over`
                            : 'Applied to Fee Balance'}
                        </div>
                      )}
                      {isLockedExcess && (
                        <div style={{ fontSize: 11, color: 'var(--accent-bright)' }}>Needs a paid unlock fee before release</div>
                      )}
                      {t.type === 'withdrawal' && t.withdrawalMethod && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {METHOD_LABELS[t.withdrawalMethod] || t.withdrawalMethod}{t.withdrawalChain ? ` (${t.withdrawalChain})` : ''}{t.destinationAddress ? ` → ${t.destinationAddress}` : ''}
                        </div>
                      )}
                      {t.type === 'deposit' && t.depositMethod && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          via {METHOD_LABELS[t.depositMethod] || t.depositMethod}{t.depositChain ? ` (${t.depositChain})` : ''}{t.depositReference ? ` · ${t.depositReference}` : ''}
                        </div>
                      )}
                    </td>
                    <td>{formatMoney(t.amount)}</td>
                    <td>{formatDate(t.date)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {isLockedExcess ? (
                          <Link to={`/admin/users/${t.userId}`} className="tx-btn" style={{ padding: '5px 9px', fontSize: 11.5, textDecoration: 'none' }}>
                            Add fee
                          </Link>
                        ) : (
                          <button className="icon-btn" onClick={() => approveTransaction(t.id)} aria-label="Approve"><Check size={15} /></button>
                        )}
                        <button className="icon-btn" onClick={() => rejectTransaction(t.id)} aria-label="Reject"><X size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Recently resolved</h3></div>
        {resolved.length === 0 ? (
          <div className="empty-state"><p>Nothing resolved yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Client</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {resolved.map((t) => (
                <tr key={t.id}>
                  <td>{t.userName}</td>
                  <td>{formatType(t.type)}</td>
                  <td>{formatMoney(t.amount)}</td>
                  <td><span className={'status-pill status-' + t.status}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

export default function Transactions() {
  const { transactions, addTransaction, accountBalance, getOutstandingFees } = useApp()
  const { currentUser, flagForReview } = useAuth()
  const { settings } = useSettings()
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState('')
  const defaultCurrency = resolveDisplayCurrency(currentUser, settings.currencyCode)
  const [equivCurrency, setEquivCurrency] = useState(defaultCurrency.code)
  const enabledWithdrawalMethods = Object.entries(settings.withdrawalMethods).filter(([, on]) => on).map(([key]) => key)
  const [withdrawalMethod, setWithdrawalMethod] = useState(enabledWithdrawalMethods[0] || '')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [withdrawalChain, setWithdrawalChain] = useState(CRYPTO_CHAINS[enabledWithdrawalMethods[0]]?.[0] || '')
  const enabledDepositMethods = Object.entries(settings.depositMethods).filter(([, on]) => on).map(([key]) => key)
  const [depositMethod, setDepositMethod] = useState(enabledDepositMethods[0] || '')
  const [depositReference, setDepositReference] = useState('')
  const [depositChain, setDepositChain] = useState(CRYPTO_CHAINS[enabledDepositMethods[0]]?.[0] || '')

  if (currentUser.role === 'admin') {
    return (
      <Layout pageTitle="Deposits & Withdrawals">
        <AdminTransactionsView />
      </Layout>
    )
  }

  const myRequests = transactions.filter((t) => t.userId === currentUser.id && (t.type === 'deposit' || t.type === 'withdrawal'))

  function handleSubmit(type) {
    const value = parseFloat(amount)
    if (!value || value <= 0) return setFormError('Enter an amount greater than zero.')
    const min = type === 'deposit' ? settings.depositMin : settings.withdrawalMin
    const max = type === 'deposit' ? settings.depositMax : settings.withdrawalMax
    if (min && value < min) return setFormError(`Minimum ${type} is ${formatMoney(min)}.`)
    if (max && value > max) return setFormError(`Maximum ${type} is ${formatMoney(max)}.`)
    setFormError('')
    const result = addTransaction(
      type,
      value,
      type === 'withdrawal'
        ? { withdrawalMethod, destinationAddress, withdrawalChain: CRYPTO_CHAINS[withdrawalMethod] ? withdrawalChain : null }
        : { depositMethod, depositReference, depositChain: CRYPTO_CHAINS[depositMethod] ? depositChain : null }
    )
    if (result?.error) return setFormError(result.error)
    if (type === 'deposit' && value >= LARGE_ACCOUNT_THRESHOLD) {
      flagForReview(currentUser.id)
    }
    setAmount('')
    setDestinationAddress('')
    setDepositReference('')
  }

  return (
    <Layout pageTitle="Deposit / Withdraw">
      <h1 className="page-title">Deposit / Withdraw</h1>
      <p className="page-sub">
        Deposit and withdrawal requests go into a pending queue and only move your balance once an admin approves them.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Your balance (approved only)</div>
          <div className="stat-value">{formatMoney(accountBalance)}</div>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 420 }}>
        <div className="panel-head">
          <h3>New request</h3>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Amount (USD)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setFormError('') }}
            placeholder="0.00"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', marginBottom: 8, fontSize: 14
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {amount && parseFloat(amount) > 0 && equivCurrency !== 'USD'
                ? `≈ ${formatCurrency(parseFloat(amount), equivCurrency)}`
                : 'Show equivalent in'}
            </span>
            <select
              value={equivCurrency}
              onChange={(e) => setEquivCurrency(e.target.value)}
              style={{ padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 11.5 }}
            >
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>(approximate, USD is the real balance)</span>
          </div>
          {formError && <div className="form-error" style={{ margin: '-8px 0 14px' }}>{formError}</div>}
          {(settings.kycEnabled || currentUser.kycRequired) && currentUser.kyc?.status !== 'verified' && (
            <p style={{ fontSize: 12, color: 'var(--accent-bright)', margin: '-8px 0 14px' }}>
              Withdrawals require identity verification. <Link to="/kyc" style={{ color: 'inherit', textDecoration: 'underline' }}>Verify your identity</Link> first.
            </p>
          )}
          {getOutstandingFees(currentUser.id).length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--accent-bright)', margin: '-8px 0 14px' }}>
              You have an outstanding fee. <Link to="/balance" style={{ color: 'inherit', textDecoration: 'underline' }}>Clear it from your Fee Balance</Link> before withdrawing.
            </p>
          )}
          {(settings.depositInstructions || settings.withdrawalInstructions) && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-8px 0 14px' }}>
              {settings.depositInstructions}{settings.depositInstructions && settings.withdrawalInstructions ? ' ' : ''}{settings.withdrawalInstructions}
            </p>
          )}
          {parseFloat(amount) >= LARGE_ACCOUNT_THRESHOLD && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-8px 0 14px' }}>
              Deposits this size are set up personally — your account will be flagged for your account manager to reach out.
            </p>
          )}

          {enabledDepositMethods.length > 0 && (
            <div style={{ marginBottom: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                For deposits — how you're sending funds
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {enabledDepositMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setDepositMethod(m); setDepositChain(CRYPTO_CHAINS[m]?.[0] || '') }}
                    className="tx-btn"
                    style={{
                      padding: '6px 12px', fontSize: 12.5,
                      background: depositMethod === m ? 'var(--accent)' : 'var(--bg)',
                      color: depositMethod === m ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
              {CRYPTO_CHAINS[depositMethod] && (
                <select
                  value={depositChain}
                  onChange={(e) => setDepositChain(e.target.value)}
                  style={{ width: '100%', marginBottom: 10, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                >
                  {CRYPTO_CHAINS[depositMethod].map((chain) => (
                    <option key={chain} value={chain}>{chain}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={depositReference}
                onChange={(e) => setDepositReference(e.target.value)}
                placeholder="Reference or note (optional)"
                style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
              />
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                Coordinate where to send funds with your account manager directly — this just records how you paid.
              </p>
            </div>
          )}

          {enabledWithdrawalMethods.length > 0 && (
            <div style={{ marginBottom: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                For withdrawals — payout method
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {enabledWithdrawalMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setWithdrawalMethod(m); setWithdrawalChain(CRYPTO_CHAINS[m]?.[0] || '') }}
                    className="tx-btn"
                    style={{
                      padding: '6px 12px', fontSize: 12.5,
                      background: withdrawalMethod === m ? 'var(--accent)' : 'var(--bg)',
                      color: withdrawalMethod === m ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
              {withdrawalMethod === 'bank' && currentUser.kycEnhanced?.status !== 'verified' ? (
                <p style={{ fontSize: 12, color: 'var(--accent-bright)', margin: 0 }}>
                  Bank withdrawal needs enhanced verification.{' '}
                  <Link to="/kyc" style={{ color: 'inherit', textDecoration: 'underline' }}>Submit it</Link> first.
                </p>
              ) : (
                <>
                  {CRYPTO_CHAINS[withdrawalMethod] && (
                    <select
                      value={withdrawalChain}
                      onChange={(e) => setWithdrawalChain(e.target.value)}
                      style={{ width: '100%', marginBottom: 10, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                    >
                      {CRYPTO_CHAINS[withdrawalMethod].map((chain) => (
                        <option key={chain} value={chain}>{chain}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    placeholder={withdrawalMethod === 'bank' ? 'Account number, bank name' : 'Wallet address'}
                    style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                  />
                  {CRYPTO_CHAINS[withdrawalMethod] && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                      Double-check the address matches the {withdrawalChain} network — funds sent to the wrong network can't be recovered.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="tx-btn deposit" onClick={() => handleSubmit('deposit')}>
              <ArrowDownCircle size={16} /> Deposit
            </button>
            <button className="tx-btn withdraw" onClick={() => handleSubmit('withdrawal')}>
              <ArrowUpCircle size={16} /> Withdraw
            </button>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3>Your recent requests</h3>
        </div>
        {myRequests.length === 0 ? (
          <div className="empty-state">
            <Inbox size={20} />
            <p>No requests yet.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((t) => (
                <tr key={t.id}>
                  <td>{formatType(t.type)}</td>
                  <td>{formatMoney(t.amount)}</td>
                  <td>{formatDate(t.date)}</td>
                  <td><span className={'status-pill status-' + t.status}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 16px' }}>
          Looking for your complete account activity, including session results and fees? See{' '}
          <Link to="/transaction-history" style={{ color: 'var(--accent-bright)' }}>Transaction History</Link>.
        </p>
      </div>
    </Layout>
  )
}
