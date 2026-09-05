import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { resolveDisplayCurrency, formatCurrency } from '../config/currencies.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Portfolio() {
  const { prices, getPortfolio, orders } = useApp()
  const { currentUser } = useAuth()
  const { settings } = useSettings()
  const displayCurrency = resolveDisplayCurrency(currentUser, settings.currencyCode)

  const portfolio = getPortfolio(currentUser.id)
  const myOrders = orders.filter((o) => o.userId === currentUser.id)

  const totalValue = portfolio.reduce((sum, pos) => sum + prices[pos.symbol] * pos.units, 0)
  const totalCost = portfolio.reduce((sum, pos) => sum + pos.avgPrice * pos.units, 0)
  const totalPnl = totalValue - totalCost

  return (
    <Layout pageTitle="Portfolio">
      <h1 className="page-title">Portfolio</h1>
      <p className="page-sub">Your positions, managed by your account manager on your behalf — view only.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total value</div>
          <div className="stat-value">{formatMoney(totalValue)}</div>
          {displayCurrency.code !== 'USD' && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>≈ {formatCurrency(totalValue, displayCurrency.code)}</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Total P&L</div>
          <div className={'stat-value ' + (totalPnl >= 0 ? 'pnl-up' : 'pnl-down')}>
            {totalPnl >= 0 ? '+' : ''}{formatMoney(totalPnl)}
          </div>
          {displayCurrency.code !== 'USD' && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              {totalPnl >= 0 ? '≈ +' : '≈ '}{formatCurrency(totalPnl, displayCurrency.code)}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>All positions</h3>
        </div>
        {portfolio.length === 0 ? (
          <div className="empty-state"><p>No positions yet — your account manager will set these up for you.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th><th style={{ textAlign: 'right' }}>Units</th><th style={{ textAlign: 'right' }}>Avg price</th><th style={{ textAlign: 'right' }}>Current price</th><th style={{ textAlign: 'right' }}>Value</th><th style={{ textAlign: 'right' }}>P&L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((pos) => {
                const current = prices[pos.symbol]
                const value = current * pos.units
                const pnl = (current - pos.avgPrice) * pos.units
                return (
                  <tr key={pos.symbol}>
                    <td style={{ fontWeight: 600 }}>{pos.symbol}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{pos.units.toFixed(4)}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(pos.avgPrice)}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(current)}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(value)}</td>
                    <td className={pnl >= 0 ? 'pnl-up' : 'pnl-down'} style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      {pnl >= 0 ? '+' : ''}{formatMoney(pnl)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3>Trade history (executed by your account manager)</h3>
        </div>
        {myOrders.length === 0 ? (
          <div className="empty-state"><p>No trades yet.</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>Type</th><th>Symbol</th><th style={{ textAlign: 'right' }}>Units</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Date</th></tr>
            </thead>
            <tbody>
              {myOrders.map((o) => (
                <tr key={o.id}>
                  <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{o.type}</td>
                  <td>{o.symbol}</td>
                  <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{o.units.toFixed(4)}</td>
                  <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(o.price)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(o.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}