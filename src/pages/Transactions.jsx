import { useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Inbox } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Transactions() {
  const { transactions, addTransaction, accountBalance } = useApp()
  const { currentUser } = useAuth()
  const [amount, setAmount] = useState('')

  const myTransactions = transactions.filter((t) => t.userId === currentUser.id)

  function handleSubmit(type) {
    const value = parseFloat(amount)
    if (!value || value <= 0) return
    addTransaction(type, value)
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
                  <td style={{ textTransform: 'capitalize' }}>{t.type}</td>
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