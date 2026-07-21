import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import { Link } from 'react-router-dom'
import { ArrowRight, Wallet, TrendingUp, Target, Activity } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { useSkeleton } from '../hooks/useSkeleton.js'
import { getTradeStats, getProfitBreakdown, getActiveTradeCount, getClosedPositions } from '../utils/analytics.js'
import { dedupeSeriesForSymbol, tightDomain } from '../utils/priceCharts.js'
import { getTier } from '../config/tiers.js'
import AdminDashboardView from './AdminDashboardView.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// A hero stat card whose number counts up/down to its real value
// instead of snapping — the value itself is always whatever was
// passed in, never a placeholder.
function HeroStat({ icon: Icon, label, value, formatter, deltaLabel, deltaPositive, animationClass }) {
  const animated = useCountUp(value)
  return (
    <div className={'glass-card hero-stat-card ' + animationClass}>
      <div className="hero-stat-icon"><Icon size={18} /></div>
      <div className="hero-stat-label">{label}</div>
      <div className="hero-stat-value">{formatter(animated)}</div>
      {deltaLabel && (
        <div className={'hero-stat-delta ' + (deltaPositive ? 'pnl-up' : 'pnl-down')}>{deltaLabel}</div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const loading = useSkeleton(500)
  const { prices, history, orders, transactions, sessions, getBalanceBreakdown, getSessionsForUser } = useApp()
  const { currentUser } = useAuth()

  if (currentUser.role === 'admin') {
    return (
      <Layout pageTitle="Admin Dashboard">
        <AdminDashboardView />
      </Layout>
    )
  }

  const { total, available } = getBalanceBreakdown(currentUser.id)
  const mySessions = getSessionsForUser(currentUser.id)
  const activeSessions = mySessions.filter((s) => s.status === 'active')
  const hasNoSessionsYet = mySessions.length === 0

  const tradeStats = getTradeStats(orders, currentUser.id)
  const profit = getProfitBreakdown(transactions, currentUser.id)
  const activeTradeCount = getActiveTradeCount(sessions, currentUser.id)
  const recentTrades = getClosedPositions(orders, currentUser.id).slice(0, 8)

  // Every open position across every active session, flattened for
  // the "Open Positions" strip — same real data the session pages use.
  const openPositions = activeSessions.flatMap((s) =>
    s.positions.map((p) => ({ ...p, sessionId: s.id, tierName: getTier(s.tierId)?.name }))
  )

  return (
    <Layout pageTitle="Dashboard">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Live pricing across crypto and major currency pairs, updated in real time.</p>

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

      <div className="hero-stats-grid">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="glass-card hero-stat-card"><div className="skeleton" style={{ height: 76 }} /></div>)
        ) : (
          <>
        <HeroStat
          icon={Wallet}
          label="Portfolio value"
          value={total}
          formatter={formatMoney}
          animationClass="fade-in-up fade-in-up-1"
        />
        <HeroStat
          icon={TrendingUp}
          label="Today's profit"
          value={profit.today}
          formatter={(v) => (v >= 0 ? '+' : '') + formatMoney(v)}
          deltaLabel={profit.today === 0 ? 'No settlements today' : undefined}
          deltaPositive={profit.today >= 0}
          animationClass="fade-in-up fade-in-up-2"
        />
        <HeroStat
          icon={Target}
          label="Win rate"
          value={tradeStats.winRate}
          formatter={(v) => v.toFixed(1) + '%'}
          deltaLabel={tradeStats.totalTrades === 0 ? 'No closed trades yet' : `${tradeStats.winningTrades}/${tradeStats.totalTrades} trades`}
          deltaPositive={tradeStats.winRate >= 50}
          animationClass="fade-in-up fade-in-up-3"
        />
        <HeroStat
          icon={Activity}
          label="Active trades"
          value={activeTradeCount}
          formatter={(v) => Math.round(v).toString()}
          animationClass="fade-in-up fade-in-up-4"
        />
          </>
        )}
      </div>

      <div className="ticker-row">
        {Object.entries(prices).map(([symbol, price]) => (
          <div className="ticker-card" key={symbol}>
            <div className="ticker-symbol">{symbol}</div>
            <div className="ticker-price">{price.toFixed(price > 100 ? 2 : 4)}</div>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div className="panel-head">
          <h3>BTC/USD — live</h3>
          <Link to="/markets" style={{ fontSize: 12.5, color: 'var(--accent-bright)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Full markets <ArrowRight size={12} />
          </Link>
        </div>
        {(() => {
          const btcSeries = dedupeSeriesForSymbol(history, 'BTC/USD')
          const btcValues = btcSeries.map((p) => p['BTC/USD']).filter((v) => v != null)
          return (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={btcSeries} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} minTickGap={40} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis
                  domain={tightDomain(btcValues)}
                  orientation="right"
                  tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }}
                  tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} formatter={(v) => v.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} />
                <ReferenceLine y={prices['BTC/USD']} stroke="var(--accent-bright)" strokeDasharray="4 3" />
                <Area type="monotone" dataKey="BTC/USD" stroke="var(--accent-bright)" fill="url(#priceFill)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )
        })()}
      </div>

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3>Open positions</h3>
          <Link to="/sessions" style={{ fontSize: 12.5, color: 'var(--accent-bright)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Manage sessions <ArrowRight size={12} />
          </Link>
        </div>
        {openPositions.length === 0 ? (
          <div className="empty-state"><p>No open positions right now.</p></div>
        ) : (
          <div className="position-pill-row">
            {openPositions.map((p) => {
              const currentPrice = prices[p.symbol]
              const livePnl = p.marginAmount * p.leverage * ((currentPrice - p.entryPrice) / p.entryPrice)
              return (
                <div className="position-pill" key={p.id}>
                  <strong>{p.symbol}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{p.leverage}x</span>
                  <span className={livePnl >= 0 ? 'pnl-up' : 'pnl-down'}>
                    {livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="glass-card">
        <div className="panel-head">
          <h3>Recent trades</h3>
          <Link to="/analytics" style={{ fontSize: 12.5, color: 'var(--accent-bright)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Full analytics <ArrowRight size={12} />
          </Link>
        </div>
        {recentTrades.length === 0 ? (
          <div className="empty-state"><p>No closed trades yet — once a position closes, it'll show up here.</p></div>
        ) : (
          <table>
            <thead><tr><th>Symbol</th><th>Margin</th><th>Leverage</th><th>P&amp;L</th><th>Closed</th></tr></thead>
            <tbody>
              {recentTrades.map((t) => (
                <tr key={t.id}>
                  <td>{t.symbol}</td>
                  <td>{formatMoney(t.marginAmount)}</td>
                  <td>{t.leverage}x</td>
                  <td className={t.pnl >= 0 ? 'pnl-up' : 'pnl-down'}>{t.pnl >= 0 ? '+' : ''}{formatMoney(t.pnl)}</td>
                  <td>{formatDate(t.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
