import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip
} from 'recharts'
import { TrendingUp, Calendar, CalendarDays, Wallet, ListChecks, CheckCircle2, XCircle, Target, Percent, ArrowUpRight, ArrowDownRight, TrendingUpDown } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { useSkeleton } from '../hooks/useSkeleton.js'
import {
  getTradeStats, getProfitBreakdown, getROI, getBalanceHistory,
  getAssetAllocation, getTradingActivity
} from '../utils/analytics.js'
import AdminAnalyticsView from './AdminAnalyticsView.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

const ALLOCATION_COLORS = ['var(--accent-bright)', 'var(--success)', 'var(--danger)', '#a78bfa', '#fbbf24']

function StatCard({ icon: Icon, label, value, formatter, positive, animationClass }) {
  const animated = useCountUp(value)
  return (
    <div className={'glass-card hero-stat-card ' + animationClass}>
      <div className="hero-stat-icon"><Icon size={17} /></div>
      <div className="hero-stat-label">{label}</div>
      <div className={'hero-stat-value' + (positive === undefined ? '' : positive ? ' pnl-up' : ' pnl-down')}>
        {formatter(animated)}
      </div>
    </div>
  )
}

export default function Analytics() {
  const loading = useSkeleton(500)
  const { orders, transactions, sessions } = useApp()
  const { currentUser } = useAuth()

  if (currentUser.role === 'admin') {
    return (
      <Layout pageTitle="Admin Analytics">
        <AdminAnalyticsView />
      </Layout>
    )
  }

  const trade = getTradeStats(orders, currentUser.id)
  const profit = getProfitBreakdown(transactions, currentUser.id)
  const roi = getROI(transactions, currentUser.id)
  const balanceHistory = getBalanceHistory(transactions, currentUser.id)
  const allocation = getAssetAllocation(sessions, currentUser.id)
  const activity = getTradingActivity(orders, currentUser.id, 14)

  const winLossData = [
    { name: 'Wins', value: trade.winningTrades },
    { name: 'Losses', value: trade.losingTrades }
  ]
  const hasTrades = trade.totalTrades > 0
  const hasAllocation = allocation.length > 0
  const hasBalanceHistory = balanceHistory.length > 1

  return (
    <Layout pageTitle="Analytics">
      <h1 className="page-title">Analytics</h1>
      <p className="page-sub">
        Every number below is calculated from your real trade and transaction history — nothing here is a placeholder.
      </p>

      {loading ? (
        <>
          <div className="hero-stats-grid">
            {[1, 2, 3, 4].map((i) => <div key={i} className="glass-card hero-stat-card"><div className="skeleton" style={{ height: 76 }} /></div>)}
          </div>
          <div className="hero-stats-grid">
            {[1, 2, 3, 4].map((i) => <div key={i} className="glass-card hero-stat-card"><div className="skeleton" style={{ height: 76 }} /></div>)}
          </div>
          <div className="hero-stats-grid">
            {[1, 2, 3, 4].map((i) => <div key={i} className="glass-card hero-stat-card"><div className="skeleton" style={{ height: 76 }} /></div>)}
          </div>
        </>
      ) : (
        <>
      <div className="hero-stats-grid">
        <StatCard icon={Calendar} label="Today's profit" value={profit.today} formatter={(v) => (v >= 0 ? '+' : '') + formatMoney(v)} positive={profit.today >= 0} animationClass="fade-in-up fade-in-up-1" />
        <StatCard icon={CalendarDays} label="This week's profit" value={profit.thisWeek} formatter={(v) => (v >= 0 ? '+' : '') + formatMoney(v)} positive={profit.thisWeek >= 0} animationClass="fade-in-up fade-in-up-2" />
        <StatCard icon={TrendingUp} label="This month's profit" value={profit.thisMonth} formatter={(v) => (v >= 0 ? '+' : '') + formatMoney(v)} positive={profit.thisMonth >= 0} animationClass="fade-in-up fade-in-up-3" />
        <StatCard icon={Wallet} label="Total profit (all time)" value={profit.allTime} formatter={(v) => (v >= 0 ? '+' : '') + formatMoney(v)} positive={profit.allTime >= 0} animationClass="fade-in-up fade-in-up-4" />
      </div>

      <div className="hero-stats-grid">
        <StatCard icon={ListChecks} label="Total trades" value={trade.totalTrades} formatter={(v) => Math.round(v).toString()} animationClass="fade-in-up fade-in-up-1" />
        <StatCard icon={CheckCircle2} label="Winning trades" value={trade.winningTrades} formatter={(v) => Math.round(v).toString()} positive animationClass="fade-in-up fade-in-up-2" />
        <StatCard icon={XCircle} label="Losing trades" value={trade.losingTrades} formatter={(v) => Math.round(v).toString()} positive={false} animationClass="fade-in-up fade-in-up-3" />
        <StatCard icon={Target} label="Win rate" value={trade.winRate} formatter={(v) => v.toFixed(1) + '%'} positive={trade.winRate >= 50} animationClass="fade-in-up fade-in-up-4" />
      </div>

      <div className="hero-stats-grid">
        <StatCard icon={Percent} label="ROI (on deposits)" value={roi} formatter={(v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%'} positive={roi >= 0} animationClass="fade-in-up fade-in-up-1" />
        <StatCard icon={TrendingUpDown} label="Average trade" value={trade.averageTrade} formatter={(v) => (v >= 0 ? '+' : '') + formatMoney(v)} positive={trade.averageTrade >= 0} animationClass="fade-in-up fade-in-up-2" />
        <StatCard icon={ArrowUpRight} label="Largest win" value={trade.largestWin} formatter={(v) => formatMoney(v)} positive animationClass="fade-in-up fade-in-up-3" />
        <StatCard icon={ArrowDownRight} label="Largest loss" value={trade.largestLoss} formatter={(v) => formatMoney(v)} positive={false} animationClass="fade-in-up fade-in-up-4" />
      </div>
        </>
      )}

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h3>Account growth</h3></div>
        {hasBalanceHistory ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={balanceHistory}>
              <defs>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} formatter={(v) => formatMoney(v)} />
              <Area type="monotone" dataKey="balance" stroke="var(--accent-bright)" fill="url(#growthFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state"><p>Not enough transaction history yet to chart growth.</p></div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="glass-card">
          <div className="panel-head"><h3>Win vs loss ratio</h3></div>
          {hasTrades ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
              <ResponsiveContainer width="60%" height={180}>
                <PieChart>
                  <Pie data={winLossData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
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
            <div className="empty-state"><p>No closed trades yet.</p></div>
          )}
        </div>

        <div className="glass-card">
          <div className="panel-head"><h3>Asset allocation (open exposure)</h3></div>
          {hasAllocation ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
              <ResponsiveContainer width="60%" height={180}>
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="symbol" innerRadius={45} outerRadius={70} paddingAngle={3}>
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
            <div className="empty-state"><p>No open positions right now.</p></div>
          )}
        </div>
      </div>

      <div className="glass-card">
        <div className="panel-head"><h3>Trading activity — last 14 days</h3></div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={activity}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={1} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
            <Bar dataKey="count" fill="var(--accent-bright)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Layout>
  )
}
