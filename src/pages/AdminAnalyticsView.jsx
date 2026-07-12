import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Wallet, Activity, Users, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { useSkeleton } from '../hooks/useSkeleton.js'
import { getTier } from '../config/tiers.js'
import {
  getPlatformTotals, getActiveSessionsOverview, getSessionsByTier, getPlatformAssetAllocation
} from '../utils/adminAnalytics.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatTimeLeft(expiresAtIso) {
  const msLeft = new Date(expiresAtIso).getTime() - Date.now()
  if (msLeft <= 0) return 'expired'
  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000))
  const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  if (days > 0) return `${days}d ${hours}h`
  const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000))
  return `${hours}h ${minutes}m`
}

const CHART_COLORS = ['var(--accent-bright)', 'var(--success)', 'var(--danger)', '#a78bfa', '#fbbf24']

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

export default function AdminAnalyticsView() {
  const loading = useSkeleton(500)
  const { transactions, sessions, sessionScenarios, sessionCurrentValue } = useApp()
  const { users } = useAuth()

  const totals = getPlatformTotals(users, transactions, sessions)
  const activeSessions = getActiveSessionsOverview(sessions, users)
  const byTier = getSessionsByTier(sessions).map((row) => ({ ...row, name: getTier(row.tierId)?.name || row.tierId }))
  const allocation = getPlatformAssetAllocation(sessions)
  const hasActiveSessions = activeSessions.length > 0
  const hasAllocation = allocation.length > 0

  return (
    <>
      <h1 className="page-title">Admin Analytics</h1>
      <p className="page-sub">Every active session and client account, at a glance — calculated live from real data.</p>

      <div className="hero-stats-grid">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="glass-card hero-stat-card"><div className="skeleton" style={{ height: 76 }} /></div>)
        ) : (
          <>
            <StatCard icon={Activity} label="Active sessions" value={totals.activeSessionCount} formatter={(v) => Math.round(v).toString()} animationClass="fade-in-up fade-in-up-1" />
            <StatCard icon={Wallet} label="Committed capital" value={totals.totalCommitted} formatter={formatMoney} animationClass="fade-in-up fade-in-up-2" />
            <StatCard icon={Users} label="Total clients" value={totals.totalClients} formatter={(v) => Math.round(v).toString()} animationClass="fade-in-up fade-in-up-3" />
            <StatCard icon={AlertTriangle} label="Flagged for review" value={totals.flaggedClients} formatter={(v) => Math.round(v).toString()} animationClass="fade-in-up fade-in-up-4" />
          </>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h3>All active sessions — at a glance</h3></div>
        {!hasActiveSessions ? (
          <div className="empty-state"><p>No active sessions right now.</p></div>
        ) : (
          <table>
            <thead><tr><th>Client</th><th>Tier</th><th>Amount</th><th>Leverage</th><th>Live value</th><th>Time left</th><th>Scenario</th></tr></thead>
            <tbody>
              {activeSessions.map(({ session, owner }) => {
                const scenario = sessionScenarios[session.id]
                return (
                  <tr key={session.id}>
                    <td>{owner?.name || `User #${session.userId}`}</td>
                    <td>{getTier(session.tierId)?.name || session.tierId}</td>
                    <td>{formatMoney(session.amount)}</td>
                    <td>{session.leverage}x</td>
                    <td>{formatMoney(sessionCurrentValue(session))}</td>
                    <td>{formatTimeLeft(session.expiresAt)}</td>
                    <td>
                      {!scenario ? (
                        <span className="status-pill status-approved">Normal</span>
                      ) : scenario.reset ? (
                        <span className="status-pill status-pending">Resetting</span>
                      ) : (
                        <span className="status-pill status-pending">{scenario.mode}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="glass-card">
          <div className="panel-head"><h3>Active sessions by tier</h3></div>
          {byTier.length === 0 ? (
            <div className="empty-state"><p>No active sessions right now.</p></div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
              <ResponsiveContainer width="60%" height={180}>
                <PieChart>
                  <Pie data={byTier} dataKey="count" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {byTier.map((entry, i) => (
                      <Cell key={entry.tierId} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mini-donut-legend">
                {byTier.map((entry, i) => (
                  <div className="mini-donut-legend-item" key={entry.tierId}>
                    <span className="mini-donut-swatch" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /> {entry.name} ({entry.count})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass-card">
          <div className="panel-head"><h3>Platform exposure by instrument</h3></div>
          {!hasAllocation ? (
            <div className="empty-state"><p>No open positions right now.</p></div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
              <ResponsiveContainer width="60%" height={180}>
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="symbol" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {allocation.map((entry, i) => (
                      <Cell key={entry.symbol} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} formatter={(v) => formatMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mini-donut-legend">
                {allocation.map((entry, i) => (
                  <div className="mini-donut-legend-item" key={entry.symbol}>
                    <span className="mini-donut-swatch" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /> {entry.symbol}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
