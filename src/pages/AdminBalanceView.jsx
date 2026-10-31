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

export default function AdminBalanceView() {
  const loading = useSkeleton(500)
  const { transactions, sessions } = useApp()
  const { users } = useAuth()

  const totals = getPlatformTotals(users, transactions, sessions)
  const balances = getClientBalances(users, transactions, sessions).sort((a, b) => b.total - a.total)

  // Total balance grouped by each client's assigned tier: a real
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
      <header className="dz-head">
        <h1 className="dz-title">Admin Balance Overview</h1>
        <div className="dz-muted">Every client's balance, and where the platform's total balance actually sits.</div>
      </header>

      <div className="ad-kpis">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="skeleton ad-kpi-skel" />)
        ) : (
          <>
            <Kpi icon={Wallet} label="Total AUM" value={totals.totalAUM} formatter={formatMoney} />
            <Kpi icon={Unlock} label="Total available" value={totals.totalAvailable} formatter={formatMoney} />
            <Kpi icon={Lock} label="Committed to sessions" value={totals.totalCommitted} formatter={formatMoney} />
            <Kpi icon={Hourglass} label="Pending profit review" value={totals.totalPendingReview} formatter={formatMoney} />
          </>
        )}
      </div>

      <div className="dz-card">
        <div className="dz-card-head"><h3>Balance breakdown by tier</h3></div>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={byTier} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 5" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={48} />
            <Tooltip cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} formatter={(v) => formatMoney(v)} />
            <Bar dataKey="total" fill="var(--accent-bright)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="dz-card">
        <div className="dz-card-head">
          <h3>Every client's balance</h3>
          <Link to="/admin/users">Manage clients <ArrowRight size={12} /></Link>
        </div>
        {balances.length === 0 ? (
          <div className="dz-empty">No clients yet.</div>
        ) : (
          <div className="rf-list">
            {balances.map((b) => (
              <Link key={b.user.id} to={`/admin/users/${b.user.id}`} className="rf-item ad-link">
                <span className="rf-av">{(b.user.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                <span className="rf-who">
                  <strong>{b.user.name}</strong>
                  <span className="dz-muted">{getTier(b.user.tier)?.name || 'No tier'} · available {formatMoney(b.available)} · committed {formatMoney(b.committed)}{b.pendingReview > 0 ? ` · pending review ${formatMoney(b.pendingReview)}` : ''}</span>
                </span>
                <span className="mono cl-bal">{formatMoney(b.total)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
