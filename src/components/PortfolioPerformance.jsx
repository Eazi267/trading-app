import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { Info } from 'lucide-react'
import { getBalanceHistory } from '../utils/analytics.js'

const DAY = 24 * 60 * 60 * 1000

function money(n) {
  return Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function dayLabel(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Builds the points to draw from REAL approved transactions only.
// If there is too little history (fewer than 2 real points, or the
// balance never changed) we still return a flat line at the current
// settled balance and flag it as `thin`, so the chart can say so.
export function buildPerformanceSeries(transactions, userId, currentTotal, now = Date.now()) {
  const real = getBalanceHistory(transactions, userId)
  const last = real.length ? real[real.length - 1].balance : currentTotal
  // Extend the last known balance to "now" so the line reaches today.
  const points = real.map((p) => ({ ts: p.ts, balance: p.balance }))
  points.push({ ts: Math.max(now, points.length ? points[points.length - 1].ts : now), balance: last })
  if (points.length < 3 && points[0].ts >= now - 1000) {
    points.unshift({ ts: now - 7 * DAY, balance: last })
  } else if (points.length === 2 && points[1].ts - points[0].ts < 60 * 1000) {
    points[0] = { ts: points[1].ts - 7 * DAY, balance: last }
  }
  const distinct = new Set(real.map((p) => p.balance))
  const thin = real.length < 2 || distinct.size < 2
  return { points, thin, realCount: real.length, last }
}

export default function PortfolioPerformance({ transactions, userId, total, available }) {
  const { points, thin, realCount, last } = useMemo(
    () => buildPerformanceSeries(transactions, userId, total),
    [transactions, userId, total]
  )
  const first = points[0]?.balance ?? 0
  const change = last - first
  const inSessions = Math.max(0, total - available)

  const values = points.map((p) => p.balance)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = hi === lo ? Math.max(1, hi * 0.05) : (hi - lo) * 0.15
  const domain = [Math.max(0, lo - pad), hi + pad]

  return (
    <div className="glass-card perf-card" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h3>Portfolio performance</h3>
        <span className="perf-chip">Settled balance · from your records</span>
      </div>

      <div className="perf-stats">
        <div><span>Portfolio value</span><strong>{money(total)}</strong></div>
        <div><span>Available</span><strong>{money(available)}</strong></div>
        <div><span>In sessions</span><strong>{money(inSessions)}</strong></div>
        <div>
          <span>{thin ? 'Change' : 'Change over period'}</span>
          <strong className={change > 0 ? 'pnl-up' : change < 0 ? 'pnl-down' : ''}>
            {change > 0 ? '+' : ''}{money(change)}
          </strong>
        </div>
      </div>

      {thin && (
        <div className="perf-note" role="status">
          <Info size={14} />
          <span>
            <strong>Not enough history yet.</strong>{' '}
            {realCount === 0
              ? 'There are no approved transactions to chart. The flat line shows your current balance and will start moving as activity is recorded.'
              : 'Your balance hasn’t changed yet. The flat line shows your current balance and will start moving as deposits, withdrawals and session results are recorded.'}
          </span>
        </div>
      )}

      <div style={{ padding: '4px 8px 12px' }}>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={thin ? 0.12 : 0.35} />
                <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']}
              tickFormatter={dayLabel} minTickGap={50}
              tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }}
              axisLine={{ stroke: 'var(--border)' }} tickLine={false}
            />
            <YAxis
              domain={domain} orientation="right" width={64}
              tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              labelFormatter={dayLabel}
              formatter={(v) => [money(v), 'Settled balance']}
            />
            <Area
              type="stepAfter" dataKey="balance"
              stroke="var(--accent-bright)" strokeWidth={2}
              strokeDasharray={thin ? '6 5' : undefined}
              fill="url(#perfFill)" dot={false} isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="perf-foot">
        Shows settled money only (deposits, withdrawals, session payouts, bonuses). Open positions are not marked to market here — see “Open positions” below for live P&amp;L.
      </div>
    </div>
  )
}
