import { Star } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'

export default function Watchlist() {
  const { prices, watchlist, toggleWatchlist } = useApp()

  return (
    <Layout pageTitle="Watchlist">
      <h1 className="page-title">Watchlist</h1>
      <p className="page-sub">Star a symbol to track it here. Stored in this browser only.</p>

      <div className="panel">
        <div className="panel-head">
          <h3>All symbols</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Symbol</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(prices).map(([symbol, price]) => {
              const starred = watchlist.includes(symbol)
              return (
                <tr key={symbol}>
                  <td>
                    <button
                      onClick={() => toggleWatchlist(symbol)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: starred ? 'var(--accent-bright)' : 'var(--text-muted)' }}
                      aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                      <Star size={16} fill={starred ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td>{symbol}</td>
                  <td>{price.toFixed(price > 100 ? 2 : 4)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {watchlist.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <h3>Starred</h3>
          </div>
          <div className="ticker-row" style={{ padding: '0 20px 20px' }}>
            {watchlist.map((symbol) => (
              <div className="ticker-card" key={symbol}>
                <div className="ticker-symbol">{symbol}</div>
                <div className="ticker-price">{prices[symbol].toFixed(prices[symbol] > 100 ? 2 : 4)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}