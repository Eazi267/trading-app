import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Portfolio() {
  const { prices, getPortfolio, orders } = useApp()
  const { currentUser } = useAuth()

  const portfolio = getPortfolio(currentUser.id)
  const myOrders = orders.filter((o) => o.userId === currentUser.id)

  const totalValue = portfolio.reduce((sum, pos) => sum + prices[pos.symbol] * pos.units, 0)
  const totalCost = portfolio.reduce((sum, pos) => sum + pos.avgPrice * pos.units, 0)
  const totalPnl = totalValue - totalCost

  return (
    <Layout pageTitle="Portfolio">
      <h1 className="page-title">Portfolio</h1>
      <p className="page-sub">Your positions, managed by an admin on your behalf — view only.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total value</div>
          <div className="stat-value">{formatMoney(totalValue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total P&L</div>
          <div className={'stat-value ' + (totalPnl >= 0 ? 'pnl-up' : 'pnl-down')}>
            {totalPnl >= 0 ? '+' : ''}{formatMoney(totalPnl)}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>All positions</h3>
        </div>
        {portfolio.length === 0 ? (
          <div className="empty-state"><p>No positions yet. An admin will set these up for you.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th><th>Units</th><th>Avg price</th><th>Current price</th><th>Value</th><th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((pos) => {
                const current = prices[pos.symbol]
                const value = current * pos.units
                const pnl = (current - pos.avgPrice) * pos.units
                return (
                  <tr key={pos.symbol}>
                    <td>{pos.symbol}</td>
                    <td>{pos.units.toFixed(4)}</td>
                    <td>{formatMoney(pos.avgPrice)}</td>
                    <td>{formatMoney(current)}</td>
                    <td>{formatMoney(value)}</td>
                    <td className={pnl >= 0 ? 'pnl-up' : 'pnl-down'}>
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
          <h3>Trade history (executed by admin)</h3>
        </div>
        {myOrders.length === 0 ? (
          <div className="empty-state"><p>No trades yet.</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>Type</th><th>Symbol</th><th>Units</th><th>Price</th><th>Date</th></tr>
            </thead>
            <tbody>
              {myOrders.map((o) => (
                <tr key={o.id}>
                  <td style={{ textTransform: 'capitalize' }}>{o.type}</td>
                  <td>{o.symbol}</td>
                  <td>{o.units.toFixed(4)}</td>
                  <td>{formatMoney(o.price)}</td>
                  <td>{formatDate(o.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}