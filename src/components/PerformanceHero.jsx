import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { Info } from 'lucide-react'
import { useCountUp } from '../hooks/useCountUp.js'
import { buildPerformanceSeries } from './PortfolioPerformance.jsx'

const DAY = 24 * 60 * 60 * 1000
const RANGES = [{ id: '1W', days: 7 }, { id: '1M', days: 30 }, { id: 'ALL', days: null }]

function money(n) {
  return Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}
const dayLabel = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// Cuts the settled-balance series to a window. The window starts at the
// balance you actually had at that moment (carried forward from the last
// record before it), so "change over period" is real, not guessed.
function sliceRange(points, days, now) {
  if (!days) return points
  const t0 = now - days * DAY
  const before = [...points].reverse().find((p) => p.ts <= t0)
  const start = before ? before.balance : points[0].balance
  return [{ ts: t0, balance: start }, ...points.filter((p) => p.ts > t0)]
}

export default function PerformanceHero({ transactions, userId, total, equivalent }) {
  const [range, setRange] = useState('1M')
  const animated = useCountUp(total)
  const now = useMemo(() => Date.now(), [transactions, total])
  const { points, thin, realCount } = useMemo(() => buildPerformanceSeries(transactions, userId, total, now), [transactions, userId, total, now])
  const days = RANGES.find((r) => r.id === range).days
  const view = useMemo(() => sliceRange(points, days, now), [points, days, now])

  const first = view[0]?.balance ?? 0
  const last = view[view.length - 1]?.balance ?? total
  const change = last - first
  const flat = new Set(view.map((p) => p.balance)).size < 2

  const values = view.map((p) => p.balance)
  const lo = Math.min(...values), hi = Math.max(...values)
  const pad = hi === lo ? Math.max(1, hi * 0.05) : (hi - lo) * 0.15
  const domain = [Math.max(0, lo - pad), hi + pad]

  return (
    <div className="dz-card dz-hero">
      <div className="dz-hero-top">
        <div>
          <div className="dz-label">Portfolio value <span className="dz-chip">Settled balance</span></div>
          <div className="dz-bignum">{money(animated)}</div>
          {equivalent && <div className="dz-muted">{equivalent}</div>}
          <div className="dz-muted">
            <span className={change > 0 ? 'pnl-up' : change < 0 ? 'pnl-down' : ''}>{change > 0 ? '+' : ''}{money(change)}</span>
            {' '}{days ? `over the last ${days === 7 ? 'week' : 'month'}` : 'since your first record'}
          </div>
        </div>
        <div className="dz-ranges" role="tablist" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={range === r.id} className={'dz-range' + (range === r.id ? ' on' : '')} onClick={() => setRange(r.id)}>{r.id}</button>
          ))}
        </div>
      </div>

      {(thin || flat) && (
        <div className="dz-note" role="status">
          <Info size={14} />
          <span>
            <strong>{thin ? 'Not enough history yet.' : 'No balance changes in this period.'}</strong>{' '}
            {thin
              ? (realCount === 0 ? 'No approved transactions to chart yet; the flat line is your current balance.' : 'Your balance hasn’t changed yet; the flat line is your current balance.')
              : 'The flat line is your balance for the period.'}
          </span>
        </div>
      )}

      <div className="dz-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={view} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={thin || flat ? 0.12 : 0.34} />
                <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 5" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={dayLabel} minTickGap={60} tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis domain={domain} orientation="right" width={58} tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} labelFormatter={dayLabel} formatter={(v) => [money(v), 'Settled balance']} />
            <Area type="stepAfter" dataKey="balance" stroke="var(--accent-bright)" strokeWidth={2.2} strokeDasharray={thin ? '6 5' : undefined} fill="url(#heroFill)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="dz-foot">Settled money only (deposits, withdrawals, session payouts, bonuses). Open positions are not marked to market here.</div>
    </div>
  )
}
