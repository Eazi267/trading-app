import { Star, Bitcoin, Coins, Landmark, Gem } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'

function symbolIcon(symbol) {
  if (symbol.startsWith('BTC')) return Bitcoin
  if (symbol.startsWith('ETH')) return Coins
  if (symbol.startsWith('XAU') || symbol.startsWith('XAG')) return Gem // metals
  return Landmark // forex pairs
}

export default function Watchlist() {
  const { prices, watchlist, toggleWatchlist } = useApp()

  return (
    <Layout pageTitle="Watchlist">
      <h1 className="page-title">Watchlist</h1>
      <p className="page-sub">Star a symbol to track it here.</p>

      <div className="panel">
        <div className="panel-head">
          <h3>All symbols</h3>
        </div>
        <div style={{ padding: 16 }} className="stagger-in">
          {Object.entries(prices).map(([symbol, price]) => {
            const starred = watchlist.includes(symbol)
            const Icon = symbolIcon(symbol)
            return (
              <div key={symbol} className="entity-card">
                <div className="icon-badge"><Icon size={17} /></div>
                <div className="entity-card-body">
                  <div className="entity-card-title">{symbol}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, marginRight: 4 }}>
                  {price.toFixed(price > 100 ? 2 : 4)}
                </div>
                <button
                  onClick={() => toggleWatchlist(symbol)}
                  className="star-toggle-btn"
                  style={{ color: starred ? 'var(--accent-bright)' : 'var(--text-muted)' }}
                  aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  <Star size={18} fill={starred ? 'currentColor' : 'none'} />
                </button>
              </div>
            )
          })}
        </div>
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