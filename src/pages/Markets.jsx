import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import Layout from '../components/Layout.jsx'
import CandlestickChart from '../components/CandlestickChart.jsx'
import { useApp, REAL_SYMBOLS } from '../context/AppContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: n > 100 ? 2 : 4 })
}

// Groups the raw tick-by-tick history into OHLC candles. bucketSize
// controls how many ticks make up one candle — smaller bucket = more,
// finer candles; larger bucket = fewer, chunkier ones.
function bucketToCandles(history, symbol, bucketSize) {
  const values = history.map((point) => point[symbol]).filter((v) => v != null)
  const candles = []
  for (let i = 0; i < values.length; i += bucketSize) {
    const chunk = values.slice(i, i + bucketSize)
    if (chunk.length === 0) continue
    candles.push({
      open: chunk[0],
      close: chunk[chunk.length - 1],
      high: Math.max(...chunk),
      low: Math.min(...chunk)
    })
  }
  return candles
}

const BUCKET_OPTIONS = [
  { label: 'Fine', size: 2 },
  { label: 'Normal', size: 5 },
  { label: 'Chunky', size: 10 }
]

export default function Markets() {
  const { prices, history, getRecentRange, priceFeedStatus } = useApp()
  const symbols = Object.keys(prices)
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0])
  const [view, setView] = useState('line')
  const [bucketSize, setBucketSize] = useState(5)
  const isRealSymbol = REAL_SYMBOLS.includes(selectedSymbol)

  const { high, low } = getRecentRange(selectedSymbol)
  const price = prices[selectedSymbol]
  const firstInHistory = history.find((p) => p[selectedSymbol] != null)?.[selectedSymbol]
  const changePercent = firstInHistory ? ((price - firstInHistory) / firstInHistory) * 100 : 0

  const candles = bucketToCandles(history, selectedSymbol, bucketSize)

  return (
    <Layout pageTitle="Markets">
      <h1 className="page-title">Markets</h1>
      <p className="page-sub">
        Real prices for BTC and ETH via CoinGecko; EUR/USD and GBP/USD are still simulated until a real forex feed is connected.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {symbols.map((symbol) => (
          <button
            key={symbol}
            onClick={() => setSelectedSymbol(symbol)}
            className="tx-btn"
            style={{
              padding: '10px 16px',
              fontSize: 13,
              background: selectedSymbol === symbol ? 'var(--accent)' : 'var(--bg)',
              color: selectedSymbol === symbol ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)'
            }}
          >
            {symbol}
            <span style={{ fontSize: 10, opacity: 0.75, marginLeft: 6 }}>
              {REAL_SYMBOLS.includes(symbol) ? 'LIVE' : 'SIM'}
            </span>
          </button>
        ))}
      </div>

      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">
            {isRealSymbol ? 'Price (live)' : 'Price (simulated)'}
          </div>
          <div className="stat-value">{formatMoney(price)}</div>
          {isRealSymbol && (
            <div style={{ fontSize: 11, color: priceFeedStatus.error ? 'var(--danger)' : 'var(--text-muted)', marginTop: 4 }}>
              {priceFeedStatus.error || `Updated ${priceFeedStatus.lastUpdated ? new Date(priceFeedStatus.lastUpdated).toLocaleTimeString() : '—'}`}
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Recent range</div>
          <div className="stat-value" style={{ fontSize: 15 }}>{formatMoney(low)} – {formatMoney(high)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Change (session view)</div>
          <div className={'stat-value ' + (changePercent >= 0 ? 'pnl-up' : 'pnl-down')} style={{ fontSize: 18 }}>
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3>{selectedSymbol} — live (simulated)</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="tx-btn"
              style={{ padding: '6px 12px', fontSize: 12, background: view === 'line' ? 'var(--accent)' : 'var(--bg)', color: view === 'line' ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setView('line')}
            >
              Line
            </button>
            <button
              className="tx-btn"
              style={{ padding: '6px 12px', fontSize: 12, background: view === 'candles' ? 'var(--accent)' : 'var(--bg)', color: view === 'candles' ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setView('candles')}
            >
              Candles
            </button>
          </div>
        </div>

        {view === 'line' ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="marketsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
              <Area type="monotone" dataKey={selectedSymbol} stroke="var(--accent-bright)" fill="url(#marketsFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <>
            <div style={{ padding: '12px 20px 0', display: 'flex', gap: 6 }}>
              {BUCKET_OPTIONS.map((opt) => (
                <button
                  key={opt.size}
                  className="tx-btn"
                  style={{ padding: '5px 10px', fontSize: 11, background: bucketSize === opt.size ? 'var(--accent)' : 'var(--bg)', color: bucketSize === opt.size ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}
                  onClick={() => setBucketSize(opt.size)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ padding: '12px 20px 20px' }}>
              <CandlestickChart candles={candles} />
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
