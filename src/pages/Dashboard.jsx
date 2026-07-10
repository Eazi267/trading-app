import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export default function Dashboard() {
  const { prices, history, transactions, getBalanceBreakdown, getSessionsForUser } = useApp()
  const { currentUser } = useAuth()

  const { total, available } = getBalanceBreakdown(currentUser.id)
  const myTransactions = transactions.filter((t) => t.userId === currentUser.id)
  const mySessions = getSessionsForUser(currentUser.id)
  const hasNoSessionsYet = mySessions.length === 0

  return (
    <Layout pageTitle="Dashboard">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Simulated market overview — no real funds are connected.</p>

      {hasNoSessionsYet && (
        <div className="panel" style={{ marginBottom: 16, borderColor: 'var(--accent-dark)' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong style={{ display: 'block', marginBottom: 4 }}>Set up your first trading session</strong>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {available > 0
                  ? 'Choose a tier and commit part of your balance to start.'
                  : 'Deposit first, then choose a tier to start a session.'}
              </span>
            </div>
            <Link
              to={available > 0 ? '/sessions' : '/transactions'}
              className="btn-primary"
              style={{ padding: '10px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {available > 0 ? 'Choose a session' : 'Deposit funds'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      <div className="ticker-row">
        {Object.entries(prices).map(([symbol, price]) => (
          <div className="ticker-card" key={symbol}>
            <div className="ticker-symbol">{symbol}</div>
            <div className="ticker-price">{price.toFixed(price > 100 ? 2 : 4)}</div>
          </div>
        ))}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total balance</div>
          <div className="stat-value">{formatMoney(total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Available balance</div>
          <div className="stat-value">{formatMoney(available)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your logged actions</div>
          <div className="stat-value">{myTransactions.length}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>BTC/USD — live (simulated)</h3>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={history}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
            <Area type="monotone" dataKey="value" stroke="var(--accent-bright)" fill="url(#priceFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Layout>
  )
}
