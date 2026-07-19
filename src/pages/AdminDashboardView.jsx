import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { ArrowRight, Wallet, Users, Activity, ClipboardCheck } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { useSkeleton } from '../hooks/useSkeleton.js'
import { getTier } from '../config/tiers.js'
import {
  getPlatformTotals, getClientBalances, getDepositWithdrawTrend, getRecentPlatformActivity
} from '../utils/adminAnalytics.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function HeroStat({ icon: Icon, label, value, formatter, animationClass }) {
  const animated = useCountUp(value)
  return (
    <div className={'glass-card hero-stat-card ' + animationClass}>
      <div className="hero-stat-icon"><Icon size={18} /></div>
      <div className="hero-stat-label">{label}</div>
      <div className="hero-stat-value">{formatter(animated)}</div>
    </div>
  )
}

function activityLabel(event) {
  if (event.kind === 'order') {
    return event.type === 'open_position'
      ? `Opened ${event.symbol} position`
      : `Closed ${event.symbol} position (${event.pnl >= 0 ? '+' : ''}${formatMoney(event.pnl)})`
  }
  if (event.type === 'session_settlement') return `Session settled (${event.amount >= 0 ? '+' : ''}${formatMoney(event.amount)})`
  if (event.type === 'capped_profit_release') return `Capped profit release — ${formatMoney(event.amount)} (${event.status})`
  return `${event.type} request — ${formatMoney(event.amount)} (${event.status})`
}

export default function AdminDashboardView() {
  const loading = useSkeleton(500)
  const { transactions, sessions, orders } = useApp()
  const { users } = useAuth()
  const [trendDays, setTrendDays] = useState(14)

  const totals = getPlatformTotals(users, transactions, sessions)
  const balances = getClientBalances(users, transactions, sessions).sort((a, b) => b.total - a.total)
  const trend = getDepositWithdrawTrend(transactions, trendDays)
  const recentActivity = getRecentPlatformActivity(orders, transactions, 8)
  const pendingCount = transactions.filter((t) => t.status === 'pending').length

  return (
    <>
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-sub">Platform-wide overview across every client account — all figures are calculated, not entered.</p>

      <div className="hero-stats-grid">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="glass-card hero-stat-card"><div className="skeleton" style={{ height: 76 }} /></div>)
        ) : (
          <>
            <HeroStat icon={Wallet} label="Total AUM" value={totals.totalAUM} formatter={formatMoney} animationClass="fade-in-up fade-in-up-1" />
            <HeroStat icon={Users} label="Total clients" value={totals.totalClients} formatter={(v) => Math.round(v).toString()} animationClass="fade-in-up fade-in-up-2" />
            <HeroStat icon={Activity} label="Active sessions" value={totals.activeSessionCount} formatter={(v) => Math.round(v).toString()} animationClass="fade-in-up fade-in-up-3" />
            <HeroStat icon={ClipboardCheck} label="Pending requests" value={pendingCount} formatter={(v) => Math.round(v).toString()} animationClass="fade-in-up fade-in-up-4" />
          </>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3>Deposits vs withdrawals — last {trendDays} days</h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
            <Link to="/transactions" style={{ fontSize: 12.5, color: 'var(--accent-bright)', display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
              Full requests <ArrowRight size={12} />
            </Link>
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

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3>Top clients by balance</h3>
          <Link to="/admin/users" style={{ fontSize: 12.5, color: 'var(--accent-bright)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            All clients <ArrowRight size={12} />
          </Link>
        </div>
        {balances.length === 0 ? (
          <div className="empty-state"><p>No clients yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Client</th><th>Tier</th><th>Total balance</th><th>Available</th></tr></thead>
            <tbody>
              {balances.slice(0, 6).map((b) => (
                <tr key={b.user.id}>
                  <td>{b.user.name}</td>
                  <td>{getTier(b.user.tier)?.name || 'None'}</td>
                  <td>{formatMoney(b.total)}</td>
                  <td>{formatMoney(b.available)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="glass-card">
        <div className="panel-head"><h3>Recent activity — all clients</h3></div>
        {recentActivity.length === 0 ? (
          <div className="empty-state"><p>Nothing yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Client</th><th>Event</th><th>Date</th></tr></thead>
            <tbody>
              {recentActivity.map((event) => (
                <tr key={`${event.kind}-${event.id}`}>
                  <td>{event.userName || users.find((u) => u.id === event.userId)?.name || `User #${event.userId}`}</td>
                  <td>{activityLabel(event)}</td>
                  <td>{formatDate(event.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
