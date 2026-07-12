import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { ArrowDownCircle, ArrowUpCircle, Inbox, Check, X, Clock, Hourglass } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { LARGE_ACCOUNT_THRESHOLD } from '../config/tiers.js'
import { getPendingRequestsSummary, getDepositWithdrawTrend } from '../utils/adminAnalytics.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatType(type) {
  if (type === 'capped_profit_release') return 'Capped profit release'
  return type.charAt(0).toUpperCase() + type.slice(1)
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
  const { transactions, approveTransaction, rejectTransaction } = useApp()
  const pending = transactions.filter((t) => t.status === 'pending')
  const resolved = transactions.filter((t) => t.status !== 'pending').slice(0, 15)
  const summary = getPendingRequestsSummary(transactions)
  const trend = getDepositWithdrawTrend(transactions, 14)

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
        <div className="panel-head"><h3>Deposits vs withdrawals — last 14 days</h3></div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={1} />
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
              {pending.map((t) => (
                <tr key={t.id}>
                  <td>{t.userName}</td>
                  <td>{formatType(t.type)}</td>
                  <td>{formatMoney(t.amount)}</td>
                  <td>{formatDate(t.date)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="icon-btn" onClick={() => approveTransaction(t.id)} aria-label="Approve"><Check size={15} /></button>
                      <button className="icon-btn" onClick={() => rejectTransaction(t.id)} aria-label="Reject"><X size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
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
  const { transactions, addTransaction, accountBalance } = useApp()
  const { currentUser, flagForReview } = useAuth()
  const [amount, setAmount] = useState('')

  if (currentUser.role === 'admin') {
    return (
      <Layout pageTitle="Deposits & Withdrawals">
        <AdminTransactionsView />
      </Layout>
    )
  }

  const myTransactions = transactions.filter((t) => t.userId === currentUser.id)

  function handleSubmit(type) {
    const value = parseFloat(amount)
    if (!value || value <= 0) return
    addTransaction(type, value)
    if (type === 'deposit' && value >= LARGE_ACCOUNT_THRESHOLD) {
      flagForReview(currentUser.id)
    }
    setAmount('')
  }

  return (
    <Layout pageTitle="Deposit / Withdraw">
      <h1 className="page-title">Deposit / Withdraw</h1>
      <p className="page-sub">
        Still no real money — but requests now go into a pending queue, exactly like a real broker,
        and only move your balance once an admin approves them.
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
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', marginBottom: 14, fontSize: 14
            }}
          />
          {parseFloat(amount) >= LARGE_ACCOUNT_THRESHOLD && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-8px 0 14px' }}>
              Deposits this size are set up personally — your account will be flagged for your account manager to reach out.
            </p>
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
          <h3>Your history</h3>
        </div>
        {myTransactions.length === 0 ? (
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
              {myTransactions.map((t) => (
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
      </div>
    </Layout>
  )
}
