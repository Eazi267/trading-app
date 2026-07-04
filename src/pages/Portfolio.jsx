import { useState } from 'react'
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
  const { prices, portfolio, buyAsset, sellAsset, orders } = useApp()
  const { currentUser } = useAuth()
  const [amounts, setAmounts] = useState({})

  const totalValue = portfolio.reduce((sum, pos) => sum + prices[pos.symbol] * pos.units, 0)
  const totalCost = portfolio.reduce((sum, pos) => sum + pos.avgPrice * pos.units, 0)
  const totalPnl = totalValue - totalCost
  const myOrders = orders.filter((o) => o.userId === currentUser.id)

  function setAmount(symbol, value) {
    setAmounts((a) => ({ ...a, [symbol]: value }))
  }

  function handleBuy(symbol) {
    const units = parseFloat(amounts[symbol])
    if (!units || units <= 0) return
    buyAsset(symbol, units)
    setAmount(symbol, '')
  }

  function handleSell(symbol) {
    const units = parseFloat(amounts[symbol])
    if (!units || units <= 0) return
    sellAsset(symbol, units)
    setAmount(symbol, '')
  }

  return (
    <Layout pageTitle="Portfolio">
      <h1 className="page-title">Portfolio</h1>
      <p className="page-sub">Simulated positions — buy and sell against the live demo price feed.</p>

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
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Units</th>
              <th>Avg price</th>
              <th>Current price</th>
              <th>Value</th>
              <th>P&L</th>
              <th>Trade</th>
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
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="number"
                        value={amounts[pos.symbol] || ''}
                        onChange={(e) => setAmount(pos.symbol, e.target.value)}
                        placeholder="Units"
                        style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                      />
                      <button className="tx-btn deposit" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleBuy(pos.symbol)}>Buy</button>
                      <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleSell(pos.symbol)}>Sell</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3>Your order history</h3>
        </div>
        {myOrders.length === 0 ? (
          <div className="empty-state"><p>No trades yet.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Symbol</th>
                <th>Units</th>
                <th>Price</th>
                <th>Date</th>
              </tr>
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