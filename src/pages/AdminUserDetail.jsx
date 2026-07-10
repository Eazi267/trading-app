import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminUserDetail() {
  const { id } = useParams()
  const userId = Number(id)
  const navigate = useNavigate()
  const { prices, getPortfolio, buyAsset, sellAsset, orders, transactions } = useApp()
  const { users } = useAuth()
  const [amounts, setAmounts] = useState({})

  const targetUser = users.find((u) => u.id === userId)
  const portfolio = getPortfolio(userId)
  const userOrders = orders.filter((o) => o.userId === userId)
  const userTransactions = transactions.filter((t) => t.userId === userId)

  const totalValue = portfolio.reduce((sum, pos) => sum + prices[pos.symbol] * pos.units, 0)
  const totalCost = portfolio.reduce((sum, pos) => sum + pos.avgPrice * pos.units, 0)
  const totalPnl = totalValue - totalCost

  if (!targetUser) {
    return (
      <Layout pageTitle="User not found">
        <div className="empty-state"><p>No such user.</p></div>
      </Layout>
    )
  }

  function setAmount(symbol, value) {
    setAmounts((a) => ({ ...a, [symbol]: value }))
  }

  function handleBuy(symbol) {
    const units = parseFloat(amounts[symbol])
    if (!units || units <= 0) return
    buyAsset(userId, symbol, units)
    setAmount(symbol, '')
  }

  function handleSell(symbol) {
    const units = parseFloat(amounts[symbol])
    if (!units || units <= 0) return
    sellAsset(userId, symbol, units)
    setAmount(symbol, '')
  }

  return (
    <Layout pageTitle={targetUser.name}>
      <button
        onClick={() => navigate('/admin/users')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, marginBottom: 10 }}
      >
        <ArrowLeft size={14} /> Back to Users
      </button>

      <h1 className="page-title">{targetUser.name}</h1>
      <p className="page-sub">{targetUser.email} — trade on this user's behalf below.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Portfolio value</div>
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
        <div className="panel-head"><h3>Positions — trade on their behalf</h3></div>
        <table>
          <thead>
            <tr><th>Symbol</th><th>Units</th><th>Avg price</th><th>Current price</th><th>Value</th><th>P&L</th><th>Trade</th></tr>
          </thead>
          <tbody>
            {Object.keys(prices).map((symbol) => {
              const pos = portfolio.find((p) => p.symbol === symbol)
              const current = prices[symbol]
              const units = pos?.units || 0
              const value = current * units
              const pnl = pos ? (current - pos.avgPrice) * units : 0
              return (
                <tr key={symbol}>
                  <td>{symbol}</td>
                  <td>{units.toFixed(4)}</td>
                  <td>{pos ? formatMoney(pos.avgPrice) : '—'}</td>
                  <td>{formatMoney(current)}</td>
                  <td>{formatMoney(value)}</td>
                  <td className={pnl >= 0 ? 'pnl-up' : 'pnl-down'}>
                    {pos ? (pnl >= 0 ? '+' : '') + formatMoney(pnl) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="number"
                        value={amounts[symbol] || ''}
                        onChange={(e) => setAmount(symbol, e.target.value)}
                        placeholder="Units"
                        style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                      />
                      <button className="tx-btn deposit" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleBuy(symbol)}>Buy</button>
                      <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleSell(symbol)}>Sell</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>Trade history</h3></div>
        {userOrders.length === 0 ? (
          <div className="empty-state"><p>No trades yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Type</th><th>Symbol</th><th>Units</th><th>Price</th><th>Executed by</th><th>Date</th></tr></thead>
            <tbody>
              {userOrders.map((o) => (
                <tr key={o.id}>
                  <td style={{ textTransform: 'capitalize' }}>{o.type}</td>
                  <td>{o.symbol}</td>
                  <td>{o.units.toFixed(4)}</td>
                  <td>{formatMoney(o.price)}</td>
                  <td>{o.executedByAdminName || '—'}</td>
                  <td>{formatDate(o.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>Deposit / withdrawal history</h3></div>
        {userTransactions.length === 0 ? (
          <div className="empty-state"><p>No requests yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Type</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {userTransactions.map((t) => (
                <tr key={t.id}>
                  <td style={{ textTransform: 'capitalize' }}>{t.type}</td>
                  <td>{formatMoney(t.amount)}</td>
                  <td>{formatDate(t.date)}</td>
                  <td><span className={'status-pill status-' + t.status}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}