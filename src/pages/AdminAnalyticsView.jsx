import { Link } from 'react-router-dom'
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

function Kpi({ icon: Icon, label, value, formatter }) {
  const animated = useCountUp(value)
  return (
    <div className="ad-kpi">
      <span className="ad-kpi-ico"><Icon size={18} /></span>
      <span className="ad-kpi-label">{label}</span>
      <b className="ad-kpi-value">{formatter(animated)}</b>
    </div>
  )
}

function DonutCard({ title, empty, data, nameKey, valueKey, formatter }) {
  return (
    <div className="dz-card">
      <div className="dz-card-head"><h3>{title}</h3></div>
      {data.length === 0 ? (
        <div className="dz-empty">{empty}</div>
      ) : (
        <div className="an2-donut">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={48} outerRadius={74} paddingAngle={3} stroke="none">
                {data.map((entry, i) => <Cell key={entry[nameKey]} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} formatter={formatter} />
            </PieChart>
          </ResponsiveContainer>
          <div className="an2-legend">
            {data.map((entry, i) => (
              <div key={entry[nameKey]}><i style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />{entry[nameKey]}{entry.count !== undefined ? ` (${entry.count})` : ''}</div>
            ))}
          </div>
        </div>
      )}
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

  return (
    <>
      <header className="dz-head">
        <h1 className="dz-title">Admin Analytics</h1>
        <div className="dz-muted">Every active session and client account at a glance, calculated live from real data.</div>
      </header>

      <div className="ad-kpis">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="skeleton ad-kpi-skel" />)
        ) : (
          <>
            <Kpi icon={Activity} label="Active sessions" value={totals.activeSessionCount} formatter={(v) => Math.round(v).toString()} />
            <Kpi icon={Wallet} label="Committed capital" value={totals.totalCommitted} formatter={formatMoney} />
            <Kpi icon={Users} label="Total clients" value={totals.totalClients} formatter={(v) => Math.round(v).toString()} />
            <Kpi icon={AlertTriangle} label="Flagged for review" value={totals.flaggedClients} formatter={(v) => Math.round(v).toString()} />
          </>
        )}
      </div>

      <div className="dz-card">
        <div className="dz-card-head"><h3>All active sessions, at a glance</h3></div>
        {activeSessions.length === 0 ? (
          <div className="dz-empty">No active sessions right now.</div>
        ) : (
          <div className="rf-list">
            {activeSessions.map(({ session, owner }) => {
              const scenario = sessionScenarios[session.id]
              return (
                <Link key={session.id} to={`/admin/users/${session.userId}`} className="rf-item ad-link sc-row">
                  <span className="rf-av">{(owner?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                  <span className="rf-who">
                    <strong>{owner?.name || `User #${session.userId}`}</strong>
                    <span className="dz-muted">{getTier(session.tierId)?.name || session.tierId} · {formatMoney(session.amount)} · {session.leverage}x · {formatTimeLeft(session.expiresAt)} left</span>
                    <span className="cl-tags">
                      {!scenario ? <span className="dz-chip">Normal</span> : scenario.reset ? <span className="dz-chip cl-pending">Resetting</span> : <span className="dz-chip cl-pending">{scenario.mode}</span>}
                    </span>
                  </span>
                  <span className="mono cl-bal">{formatMoney(sessionCurrentValue(session))}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div className="an2-pair">
        <DonutCard title="Active sessions by tier" empty="No active sessions right now." data={byTier} nameKey="name" valueKey="count" formatter={(v) => v} />
        <DonutCard title="Platform exposure by instrument" empty="No open positions right now." data={allocation} nameKey="symbol" valueKey="value" formatter={(v) => formatMoney(v)} />
      </div>
    </>
  )
}
