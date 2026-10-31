import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip
} from 'recharts'
import { Info } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { useSkeleton } from '../hooks/useSkeleton.js'
import {
  getTradeStats, getProfitBreakdown, getROI,
  getAssetAllocation, getTradingActivity
} from '../utils/analytics.js'
import AdminAnalyticsView from './AdminAnalyticsView.jsx'
import { buildPerformanceSeries } from '../components/PortfolioPerformance.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

const ALLOCATION_COLORS = ['var(--accent-bright)', 'var(--success)', 'var(--danger)', '#a78bfa', '#fbbf24']

function Pnl({ value, plus = true }) {
  return <span className={'mono ' + (value > 0 ? 'pnl-up' : value < 0 ? 'pnl-down' : '')}>{plus && value > 0 ? '+' : ''}{formatMoney(value)}</span>
}

export default function Analytics() {
  const loading = useSkeleton(500)
  const { dataReady: _dataReady } = useApp()
  const { orders, transactions, sessions, getBalanceBreakdown } = useApp()
  const { currentUser } = useAuth()
  const [activityDays, setActivityDays] = useState(14)
  // Hooks must run in the same order on every render, so this sits above the admin early-return.
  const profit = getProfitBreakdown(transactions, currentUser.id)
  const animatedAll = useCountUp(profit.allTime)

  if (currentUser.role === 'admin') {
    return (
      <Layout pageTitle="Admin Analytics">
        <AdminAnalyticsView />
      </Layout>
    )
  }

  const trade = getTradeStats(orders, currentUser.id)
  const roi = getROI(transactions, currentUser.id)
  const { total } = getBalanceBreakdown(currentUser.id)
  const growth = buildPerformanceSeries(transactions, currentUser.id, total)
  const allocation = getAssetAllocation(sessions, currentUser.id)
  const activity = getTradingActivity(orders, currentUser.id, activityDays)

  const winLossData = [
    { name: 'Wins', value: trade.winningTrades },
    { name: 'Losses', value: trade.losingTrades }
  ]
  const hasTrades = trade.totalTrades > 0
  const hasAllocation = allocation.length > 0
  const gValues = growth.points.map((p) => p.balance)
  const gLo = Math.min(...gValues), gHi = Math.max(...gValues)
  const gPad = gHi === gLo ? Math.max(1, gHi * 0.05) : (gHi - gLo) * 0.15
  const dayLabel = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <Layout pageTitle="Analytics">
      <header className="dz-head">
        <h1 className="dz-title">Analytics</h1>
        <div className="dz-muted" style={{ maxWidth: 720 }}>
          Every number below is calculated from your real trade and transaction history — nothing here is a placeholder.
        </div>
      </header>

      {loading || !_dataReady ? (
        <div className="dz-grid">
          <div className="dz-card dz-hero"><div className="skeleton" style={{ height: 300 }} /></div>
          <div className="dz-side"><div className="dz-card"><div className="skeleton" style={{ height: 220 }} /></div></div>
        </div>
      ) : (
        <div className="dz-grid fade-in-up">
          <div className="dz-card dz-hero">
            <div className="dz-label">Total profit, all time <span className="dz-chip">Settled results</span></div>
            <div className={'dz-bignum ' + (profit.allTime > 0 ? 'pnl-up' : profit.allTime < 0 ? 'pnl-down' : '')}>{(animatedAll >= 0 ? '+' : '') + formatMoney(animatedAll)}</div>
            <div className="dz-muted">ROI on deposits: <strong className={roi > 0 ? 'pnl-up' : roi < 0 ? 'pnl-down' : ''}>{(roi >= 0 ? '+' : '') + roi.toFixed(1)}%</strong></div>

            <div className="an-periods">
              <div><span className="dz-label">Today</span><Pnl value={profit.today} /></div>
              <div><span className="dz-label">This week</span><Pnl value={profit.thisWeek} /></div>
              <div><span className="dz-label">This month</span><Pnl value={profit.thisMonth} /></div>
            </div>

            <div className="dz-label" style={{ marginTop: 18 }}>Account growth</div>
            {growth.thin && (
              <div className="dz-note" role="status" style={{ margin: '8px 0 0' }}>
                <Info size={14} /><span><strong>Not enough history yet.</strong> The flat line is your current balance and will move as activity is recorded.</span>
              </div>
            )}
            <div className="dz-chart" style={{ minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={growth.thin ? 0.12 : 0.34} />
                      <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 5" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={dayLabel} minTickGap={60} tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[Math.max(0, gLo - gPad), gHi + gPad]} orientation="right" width={58} tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} labelFormatter={dayLabel} formatter={(v) => [formatMoney(v), 'Settled balance']} />
                  <Area type="stepAfter" dataKey="balance" stroke="var(--accent-bright)" strokeWidth={2.2} strokeDasharray={growth.thin ? '6 5' : undefined} fill="url(#growthFill)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <aside className="dz-side">
            <div className="dz-card">
              <div className="dz-card-head"><h3>Trade performance</h3></div>
              <div className="an-winrate">
                <div className="an-ring" style={{ '--p': hasTrades ? trade.winRate : 0 }}>
                  <span className="mono">{hasTrades ? trade.winRate.toFixed(0) + '%' : '—'}</span>
                </div>
                <div>
                  <div className="dz-label">Win rate</div>
                  <div className="dz-muted">{hasTrades ? `${trade.winningTrades} win${trade.winningTrades === 1 ? '' : 's'} · ${trade.losingTrades} loss${trade.losingTrades === 1 ? '' : 'es'}` : 'No closed trades yet'}</div>
                </div>
              </div>
              <div className="dz-stats" style={{ padding: 0 }}>
                <div><span className="dz-label">Total trades</span><strong className="mono">{trade.totalTrades}</strong></div>
                <div><span className="dz-label">Average trade</span><strong><Pnl value={trade.averageTrade} /></strong></div>
                <div><span className="dz-label">Largest win</span><strong className={'mono ' + (trade.largestWin > 0 ? 'pnl-up' : '')}>{formatMoney(trade.largestWin)}</strong></div>
                <div><span className="dz-label">Largest loss</span><strong className={'mono ' + (trade.largestLoss < 0 ? 'pnl-down' : '')}>{formatMoney(trade.largestLoss)}</strong></div>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className="dz-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dz-card">
          <div className="dz-card-head"><h3>Win vs loss ratio</h3></div>
          {hasTrades ? (
            <div className="an-donut">
              <ResponsiveContainer width="55%" height={170}>
                <PieChart>
                  <Pie data={winLossData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3} stroke="none">
                    <Cell fill="var(--success)" />
                    <Cell fill="var(--danger)" />
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mini-donut-legend">
                <div className="mini-donut-legend-item"><span className="mini-donut-swatch" style={{ background: 'var(--success)' }} /> Wins ({trade.winningTrades})</div>
                <div className="mini-donut-legend-item"><span className="mini-donut-swatch" style={{ background: 'var(--danger)' }} /> Losses ({trade.losingTrades})</div>
              </div>
            </div>
          ) : (
            <div className="dz-empty">No closed trades yet.</div>
          )}
        </div>

        <div className="dz-card">
          <div className="dz-card-head"><h3>Asset allocation (open exposure)</h3></div>
          {hasAllocation ? (
            <div className="an-donut">
              <ResponsiveContainer width="55%" height={170}>
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="symbol" innerRadius={45} outerRadius={70} paddingAngle={3} stroke="none">
                    {allocation.map((entry, i) => (
                      <Cell key={entry.symbol} fill={ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} formatter={(v) => formatMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mini-donut-legend">
                {allocation.map((entry, i) => (
                  <div className="mini-donut-legend-item" key={entry.symbol}>
                    <span className="mini-donut-swatch" style={{ background: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }} /> {entry.symbol}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="dz-empty">No open positions right now.</div>
          )}
        </div>
      </div>

      <div className="dz-card">
        <div className="dz-card-head">
          <h3>Trading activity — last {activityDays} days</h3>
          <div className="dz-ranges">
            {[7, 14, 30, 60].map((d) => (
              <button key={d} type="button" className={'dz-range' + (activityDays === d ? ' on' : '')} onClick={() => setActivityDays(d)}>{d}d</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={activity}>
            <CartesianGrid strokeDasharray="2 5" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} />
            <Bar dataKey="count" fill="var(--accent-bright)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Layout>
  )
}
