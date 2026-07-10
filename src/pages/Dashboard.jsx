import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export default function Dashboard() {
  const { prices, history, getPortfolio, transactions } = useApp()
  const { currentUser } = useAuth()

  const portfolio = getPortfolio(currentUser.id)
  const portfolioValue = portfolio.reduce((total, pos) => total + prices[pos.symbol] * pos.units, 0)
  const myTransactions = transactions.filter((t) => t.userId === currentUser.id)

  return (
    <Layout pageTitle="Dashboard">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Simulated market overview — no real funds are connected.</p>

      <div className="ticker-row">
        {Object.entries(prices).map(([symbol, price]) => (
          <div className="ticker-card" key={symbol}>
            <div className="ticker-symbol">{symbol}</div>
            <div className="ticker-price">{price.toFixed(price > 100 ? 2 : 4)}</div>
          </div>
        ))}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Portfolio value</div>
          <div className="stat-value">{formatMoney(portfolioValue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open positions</div>
          <div className="stat-value">{portfolio.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your logged actions</div>
          <div className="stat-value">{myTransactions.length}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>BTC/USD — live (simulated)</h3>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={history}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
            <Area type="monotone" dataKey="value" stroke="var(--accent-bright)" fill="url(#priceFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Layout>
  )
}