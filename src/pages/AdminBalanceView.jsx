import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { Wallet, Unlock, Lock, Hourglass, ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { useSkeleton } from '../hooks/useSkeleton.js'
import { getTier, TIERS } from '../config/tiers.js'
import { getPlatformTotals, getClientBalances } from '../utils/adminAnalytics.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function StatCard({ icon: Icon, label, value, formatter, animationClass }) {
  const animated = useCountUp(value)
  return (
    <div className={'glass-card hero-stat-card ' + animationClass}>
      <div className="hero-stat-icon"><Icon size={17} /></div>
      <div className="hero-stat-label">{label}</div>
      <div className="hero-stat-value">{formatter(animated)}</div>
    </div>
  )
}

export default function AdminBalanceView() {
  const loading = useSkeleton(500)
  const { transactions, sessions } = useApp()
  const { users } = useAuth()

  const totals = getPlatformTotals(users, transactions, sessions)
  const balances = getClientBalances(users, transactions, sessions).sort((a, b) => b.total - a.total)

  // Total balance grouped by each client's assigned tier — a real
  // breakdown of where the platform's AUM actually sits.
  const byTier = TIERS.map((tier) => ({
    name: tier.name,
    total: balances.filter((b) => b.user.tier === tier.id).reduce((sum, b) => sum + b.total, 0)
  })).concat([{
    name: 'Unassigned',
    total: balances.filter((b) => !b.user.tier).reduce((sum, b) => sum + b.total, 0)
  }])

  return (
    <>
      <h1 className="page-title">Admin Balance Overview</h1>
      <p className="page-sub">Every client's balance, and where the platform's total balance actually sits.</p>

      <div className="hero-stats-grid">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="glass-card hero-stat-card"><div className="skeleton" style={{ height: 76 }} /></div>)
        ) : (
          <>
            <StatCard icon={Wallet} label="Total AUM" value={totals.totalAUM} formatter={formatMoney} animationClass="fade-in-up fade-in-up-1" />
            <StatCard icon={Unlock} label="Total available" value={totals.totalAvailable} formatter={formatMoney} animationClass="fade-in-up fade-in-up-2" />
            <StatCard icon={Lock} label="Committed to sessions" value={totals.totalCommitted} formatter={formatMoney} animationClass="fade-in-up fade-in-up-3" />
            <StatCard icon={Hourglass} label="Pending profit review" value={totals.totalPendingReview} formatter={formatMoney} animationClass="fade-in-up fade-in-up-4" />
          </>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h3>Balance breakdown by tier</h3></div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byTier}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} formatter={(v) => formatMoney(v)} />
            <Bar dataKey="total" fill="var(--accent-bright)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card">
        <div className="panel-head">
          <h3>Every client's balance</h3>
          <Link to="/admin/users" style={{ fontSize: 12.5, color: 'var(--accent-bright)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Manage clients <ArrowRight size={12} />
          </Link>
        </div>
        {balances.length === 0 ? (
          <div className="empty-state"><p>No clients yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Client</th><th>Tier</th><th>Total</th><th>Available</th><th>Committed</th><th>Pending review</th></tr></thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.user.id}>
                  <td>{b.user.name}</td>
                  <td>{getTier(b.user.tier)?.name || 'None'}</td>
                  <td>{formatMoney(b.total)}</td>
                  <td>{formatMoney(b.available)}</td>
                  <td>{formatMoney(b.committed)}</td>
                  <td>{b.pendingReview > 0 ? formatMoney(b.pendingReview) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
