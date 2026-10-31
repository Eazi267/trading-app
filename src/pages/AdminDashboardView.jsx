import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { ArrowRight, Wallet, Users, Activity, ClipboardCheck, LifeBuoy, Clock, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSupport } from '../context/SupportContext.jsx'
import { hasPermission } from '../config/adminTiers.js'
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

function Kpi({ icon: Icon, label, value, formatter, to, alert }) {
  const animated = useCountUp(value)
  const inner = (
    <>
      <span className="ad-kpi-ico"><Icon size={18} /></span>
      <span className="ad-kpi-label">{label}</span>
      <b className="ad-kpi-value">{formatter(animated)}</b>
    </>
  )
  return to
    ? <Link to={to} className={'ad-kpi' + (alert ? ' alert' : '')}>{inner}</Link>
    : <div className="ad-kpi">{inner}</div>
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
  const { users, currentUser } = useAuth()
  const { unreadForAdminCount } = useSupport()
  const [trendDays, setTrendDays] = useState(14)

  const totals = getPlatformTotals(users, transactions, sessions)
  const balances = getClientBalances(users, transactions, sessions).sort((a, b) => b.total - a.total)
  const trend = getDepositWithdrawTrend(transactions, trendDays)
  const recentActivity = getRecentPlatformActivity(orders, transactions, 8)
  const pendingCount = transactions.filter((t) => t.status === 'pending').length
  const endingSoon = sessions.filter((x) => x.status === 'active' && new Date(x.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000).length
  const canSupport = hasPermission(currentUser, 'support')
  const nameOf = (event) => event.userName || users.find((u) => u.id === event.userId)?.name || `User #${event.userId}`

  return (
    <>
      <header className="dz-head">
        <h1 className="dz-title">Admin Dashboard</h1>
        <div className="dz-muted">Platform-wide overview across every client account. All figures are calculated, not entered.</div>
      </header>

      <div className="ad-kpis">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="skeleton ad-kpi-skel" />)
        ) : (
          <>
            <Kpi icon={Wallet} label="Total AUM" value={totals.totalAUM} formatter={formatMoney} />
            <Kpi icon={Users} label="Total clients" value={totals.totalClients} formatter={(v) => Math.round(v).toString()} to="/admin/users" />
            <Kpi icon={Activity} label="Active sessions" value={totals.activeSessionCount} formatter={(v) => Math.round(v).toString()} to="/admin/trading" />
            <Kpi icon={ClipboardCheck} label="Pending requests" value={pendingCount} formatter={(v) => Math.round(v).toString()} to="/transactions" alert={pendingCount > 0} />
          </>
        )}
      </div>

      <div className="dz-grid">
        <div className="dz-main">
          <div className="dz-card">
            <div className="dz-card-head">
              <h3>Deposits vs withdrawals, last {trendDays} days</h3>
              <div className="dz-ranges" role="tablist" aria-label="Range">
                {[7, 14, 30, 60].map((d) => (
                  <button key={d} type="button" role="tab" aria-selected={trendDays === d} className={'dz-range' + (trendDays === d ? ' on' : '')} onClick={() => setTrendDays(d)}>{d}d</button>
                ))}
              </div>
            </div>
            <div className="ad-legend"><span><i style={{ background: 'var(--success)' }} />Deposits</span><span><i style={{ background: 'var(--danger)' }} />Withdrawals</span></div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={trend} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 5" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} interval="preserveStartEnd" minTickGap={28} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={46} />
                <Tooltip cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} formatter={(v) => formatMoney(v)} />
                <Bar dataKey="deposits" fill="var(--success)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="withdrawals" fill="var(--danger)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="dz-card">
            <div className="dz-card-head"><h3>Recent activity, all clients</h3></div>
            {recentActivity.length === 0 ? (
              <div className="dz-empty">Nothing yet.</div>
            ) : (
              <div className="rf-list">
                {recentActivity.map((event) => (
                  <Link key={`${event.kind}-${event.id}`} to={`/admin/users/${event.userId}`} className="rf-item ad-link">
                    <span className="rf-av"><Activity size={15} /></span>
                    <span className="rf-who">
                      <strong>{nameOf(event)}</strong>
                      <span className="dz-muted">{activityLabel(event)}</span>
                    </span>
                    <span className="dz-muted rf-date">{formatDate(event.date)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="dz-side">
          <div className="dz-card">
            <div className="dz-card-head"><h3>Needs attention</h3></div>
            <Link to="/transactions" className={'ad-todo' + (pendingCount > 0 ? ' hot' : '')}>
              <span className="ad-todo-ico"><ClipboardCheck size={17} /></span>
              <span className="ad-todo-text"><strong>{pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}</strong><small>Deposits, withdrawals and profit reviews</small></span>
              <ChevronRight size={15} />
            </Link>
            {canSupport && (
              <Link to="/admin/support" className={'ad-todo' + (unreadForAdminCount > 0 ? ' hot' : '')}>
                <span className="ad-todo-ico"><LifeBuoy size={17} /></span>
                <span className="ad-todo-text"><strong>{unreadForAdminCount} unread support {unreadForAdminCount === 1 ? 'case' : 'cases'}</strong><small>Replies waiting for you</small></span>
                <ChevronRight size={15} />
              </Link>
            )}
            <Link to="/admin/trading" className="ad-todo">
              <span className="ad-todo-ico"><Clock size={17} /></span>
              <span className="ad-todo-text"><strong>{endingSoon} {endingSoon === 1 ? 'session ends' : 'sessions end'} within 24h</strong><small>Check positions before they settle</small></span>
              <ChevronRight size={15} />
            </Link>
          </div>

          <div className="dz-card">
            <div className="dz-card-head">
              <h3>Top clients by balance</h3>
              <Link to="/admin/users">All <ArrowRight size={12} /></Link>
            </div>
            {balances.length === 0 ? (
              <div className="dz-empty">No clients yet.</div>
            ) : (
              <div className="rf-list">
                {balances.slice(0, 6).map((b) => (
                  <Link key={b.user.id} to={`/admin/users/${b.user.id}`} className="rf-item ad-link">
                    <span className="rf-av">{(b.user.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                    <span className="rf-who">
                      <strong>{b.user.name}</strong>
                      <span className="dz-muted">{getTier(b.user.tier)?.name || 'No tier'} · available {formatMoney(b.available)}</span>
                    </span>
                    <span className="mono">{formatMoney(b.total)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
