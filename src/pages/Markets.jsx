import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import { ChevronRight, Star } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import CandlestickChart from '../components/CandlestickChart.jsx'
import { useApp, REAL_SYMBOLS } from '../context/AppContext.jsx'
import { useFavoriteMarkets } from '../hooks/useFavorites.js'
import { dedupeSeriesForSymbol, bucketToCandles, tightDomain } from '../utils/priceCharts.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: n > 100 ? 2 : 4 })
}

function formatAxisPrice(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: n > 100 ? 2 : 4 })
}

const BUCKET_OPTIONS = [
  { label: 'Fine', size: 2 },
  { label: 'Normal', size: 4 },
  { label: 'Chunky', size: 8 }
]

const SRC_LABEL = { live: 'Live', delayed: 'Delayed', simulated: 'Simulated' }

export default function Markets() {
  const { prices, history, getRecentRange, priceFeedStatus, priceSources } = useApp()
  const symbols = Object.keys(prices)
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0])
  const [view, setView] = useState('line')
  const [bucketSize, setBucketSize] = useState(5)
  const [listFilter, setListFilter] = useState('all')
  const { favs, toggle: toggleFav } = useFavoriteMarkets()
  const sourceOf = (sym) => priceSources?.[sym] || (REAL_SYMBOLS.includes(sym) ? 'live' : 'simulated')
  const isRealSymbol = sourceOf(selectedSymbol) !== 'simulated'

  const { high, low } = getRecentRange(selectedSymbol)
  const price = prices[selectedSymbol]
  const dedupedSeries = dedupeSeriesForSymbol(history, selectedSymbol)
  const firstInHistory = dedupedSeries[0]?.[selectedSymbol]
  const changePercent = firstInHistory ? ((price - firstInHistory) / firstInHistory) * 100 : 0

  const candles = bucketToCandles(dedupedSeries, selectedSymbol, bucketSize)
  const lineValues = dedupedSeries.map((p) => p[selectedSymbol]).filter((v) => v != null)

  // One row per market for the list: price + the same "session view" change.
  const allRows = symbols.map((sym) => {
    const series = dedupeSeriesForSymbol(history, sym)
    const first = series[0]?.[sym]
    return { sym, price: prices[sym], src: sourceOf(sym), change: first ? ((prices[sym] - first) / first) * 100 : 0, fav: favs.includes(sym) }
  })
  // Starred markets first (keeping the usual order inside each group); the
  // Favourites tab shows only those.
  const rows = [...allRows.filter((r) => r.fav), ...allRows.filter((r) => !r.fav)].filter((r) => listFilter === 'all' || r.fav)

  return (
    <Layout pageTitle="Markets">
      <header className="dz-head">
        <h1 className="dz-title">Markets</h1>
        <div className="dz-muted">Crypto and major currency pairs. Every price is tagged with where it really comes from.</div>
      </header>

      <div className="dz-grid mk-grid">
        <div className="dz-card dz-hero mk-chart">
          <div className="dz-hero-top">
            <div>
              <div className="dz-label">{selectedSymbol} <span className={'dz-chip dz-chip-' + sourceOf(selectedSymbol)}>{SRC_LABEL[sourceOf(selectedSymbol)]}</span></div>
              <div className="dz-bignum">{formatMoney(price)}</div>
              <div className="dz-muted">
                <span className={changePercent >= 0 ? 'pnl-up' : 'pnl-down'}>{changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</span> this session view
                {isRealSymbol && (
                  <span style={{ marginLeft: 10, color: priceFeedStatus.error ? 'var(--danger)' : undefined }}>
                    · {priceFeedStatus.error || `updated ${priceFeedStatus.lastUpdated ? new Date(priceFeedStatus.lastUpdated).toLocaleTimeString() : '—'}`}
                  </span>
                )}
              </div>
            </div>
            <div className="dz-ranges" role="tablist" aria-label="Chart type">
              <button type="button" role="tab" aria-selected={view === 'line'} className={'dz-range' + (view === 'line' ? ' on' : '')} onClick={() => setView('line')}>Line</button>
              <button type="button" role="tab" aria-selected={view === 'candles'} className={'dz-range' + (view === 'candles' ? ' on' : '')} onClick={() => setView('candles')}>Candles</button>
            </div>
          </div>

          <div className="mk-range">
            <span className="dz-label">Recent range</span>
            <strong className="mono">{formatMoney(low)} – {formatMoney(high)}</strong>
          </div>

          {view === 'line' && new Set(lineValues).size <= 1 ? (
            <div className="dz-empty" style={{ minHeight: 160, display: 'grid', placeItems: 'center' }}>No price movement recorded yet for {selectedSymbol}. The chart fills in as the price changes.</div>
          ) : view === 'line' ? (
            <div className="dz-chart" style={{ minHeight: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dedupedSeries} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="marketsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 5" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} minTickGap={50} axisLine={false} tickLine={false} />
                  <YAxis domain={tightDomain(lineValues)} orientation="right" tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} tickFormatter={formatAxisPrice} axisLine={false} tickLine={false} width={64} />
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} formatter={(v) => formatMoney(v)} />
                  <ReferenceLine y={price} stroke="var(--accent-bright)" strokeDasharray="4 3" />
                  <Area type="monotone" dataKey={selectedSymbol} stroke="var(--accent-bright)" fill="url(#marketsFill)" strokeWidth={2.2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <>
              <div className="pg-quick" style={{ margin: '10px 0' }}>
                {BUCKET_OPTIONS.map((opt) => (
                  <button key={opt.size} type="button" className={bucketSize === opt.size ? 'on' : ''} style={bucketSize === opt.size ? { borderColor: 'var(--accent)', color: 'var(--accent-bright)', background: 'var(--accent-bg)' } : undefined} onClick={() => setBucketSize(opt.size)}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <CandlestickChart candles={candles} />
            </>
          )}
        </div>

        <aside className="dz-side">
          <div className="dz-card">
            <div className="dz-card-head"><h3>Markets</h3></div>
            <div className="pg-filters" role="tablist" aria-label="Market list" style={{ margin: '0 0 6px' }}>
              <button type="button" role="tab" aria-selected={listFilter === 'all'} className={listFilter === 'all' ? 'on' : ''} onClick={() => setListFilter('all')}>All</button>
              <button type="button" role="tab" aria-selected={listFilter === 'fav'} className={listFilter === 'fav' ? 'on' : ''} onClick={() => setListFilter('fav')}>★ Favourites{favs.length ? ` (${favs.length})` : ''}</button>
            </div>
            {rows.length === 0 && <div className="dz-empty">No favourites yet. Tap the star next to a market to pin it here.</div>}
            {rows.map((r) => (
              <div key={r.sym} className="mk-wrap">
                <button type="button" className={'mk-star' + (r.fav ? ' on' : '')} onClick={() => toggleFav(r.sym)} aria-label={(r.fav ? 'Remove ' : 'Add ') + r.sym + (r.fav ? ' from favourites' : ' to favourites')} aria-pressed={r.fav}>
                  <Star size={16} fill={r.fav ? 'currentColor' : 'none'} />
                </button>
                <button type="button" className={'mk-row' + (r.sym === selectedSymbol ? ' on' : '')} onClick={() => setSelectedSymbol(r.sym)} aria-pressed={r.sym === selectedSymbol}>
                  <div className="mk-row-name">
                    <strong>{r.sym}</strong>
                    <span className={'dz-src ' + r.src}>{SRC_LABEL[r.src]}</span>
                  </div>
                  <div className="mk-row-price">
                    <span className="mono">{formatMoney(r.price)}</span>
                    <span className={'mono ' + (r.change >= 0 ? 'pnl-up' : 'pnl-down')}>{r.change >= 0 ? '+' : ''}{r.change.toFixed(2)}%</span>
                  </div>
                  <ChevronRight size={14} className="mk-row-arrow" />
                </button>
              </div>
            ))}
            <p className="dz-muted" style={{ marginTop: 10 }}>
              Live = fetched from a real market feed. Delayed = the feed went quiet, last real price shown. Simulated = no real feed connected yet.
            </p>
          </div>
        </aside>
      </div>
    </Layout>
  )
}
