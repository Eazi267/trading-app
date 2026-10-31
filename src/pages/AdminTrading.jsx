import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, TrendingUp, TrendingDown, Activity, Plus, CheckSquare, Square, Clock, Layers, AlertTriangle, ArrowUpDown } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import CandlestickChart from '../components/CandlestickChart.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { useApp, positionEquity, REAL_SYMBOLS } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getClients } from '../config/clients.js'
import { TIERS, ALL_TIERS, getTier } from '../config/tiers.js'
import { dedupeSeriesForSymbol, bucketToCandles } from '../utils/priceCharts.js'
import '../styles/terminal.css'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

// Prices need more decimals for forex than the 2 that money gets.
function formatPrice(n) {
  if (n == null) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: n > 100 ? 2 : 4,
    maximumFractionDigits: n > 100 ? 2 : 4
  })
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatTimeLeft(expiresAtIso) {
  const msLeft = new Date(expiresAtIso).getTime() - Date.now()
  if (msLeft <= 0) return 'expired'
  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000))
  const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  if (days > 0) return `${days}d ${hours}h left`
  const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000))
  return `${hours}h ${minutes}m left`
}

function sessionProgress(session) {
  const start = new Date(session.startedAt).getTime()
  const end = new Date(session.expiresAt).getTime()
  const now = Date.now()
  if (end <= start) return 100
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
}

const CANDLE_SIZES = [2, 4, 8, 16]

export default function AdminTrading() {
  const {
    prices, history, orders, priceFeedStatus, priceSources, getRecentRange, sessions, sessionScenarios, sessionCurrentValue,
    getEffectivePricesForSession, startSession, openSessionPosition, closeSessionPosition, setSessionLeverage
  } = useApp()
  const { users } = useAuth()

  const activeSessions = sessions.filter((s) => s.status === 'active')
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  // Falls back to the first active session, so the terminal is never
  // empty just because sessions finished loading after the page did.
  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId) || activeSessions[0] || null

  const [search, setSearch] = useState('')
  const [tradeSymbol, setTradeSymbol] = useState(Object.keys(prices)[0])
  const [tradeDirection, setTradeDirection] = useState('long')
  const [tradeMargin, setTradeMargin] = useState('')
  const [tradeError, setTradeError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [closingId, setClosingId] = useState(null)
  const [closeError, setCloseError] = useState('')
  const [leverageInput, setLeverageInput] = useState('')
  const [leverageError, setLeverageError] = useState('')
  const [bucketSize, setBucketSize] = useState(4)
  const [tab, setTab] = useState('positions')
  const isPhone = useMediaQuery('(max-width: 900px)')
  const [tradeOpen, setTradeOpen] = useState(false)
  const [sortBy, setSortBy] = useState('pnl')
  // "Select several": pick more than one session and open the same position in each,
  // sized as a percentage of each session's own cash.
  const [multi, setMulti] = useState(false)
  const [picked, setPicked] = useState([])
  const [pct, setPct] = useState('')
  const [bulkResults, setBulkResults] = useState(null)

  const [showStartSession, setShowStartSession] = useState(false)
  const [startClientId, setStartClientId] = useState('')
  const [startTier, setStartTier] = useState(TIERS[0].id)
  const [startAmount, setStartAmount] = useState('')
  const [startDuration, setStartDuration] = useState(TIERS[0].durationDays)
  const [startError, setStartError] = useState('')

  const clients = getClients(users)
  const q = search.trim().toLowerCase()
  const filteredSessions = q
    ? activeSessions.filter((s) => {
        const owner = users.find((u) => u.id === s.userId)
        return owner?.name?.toLowerCase().includes(q) || owner?.email?.toLowerCase().includes(q)
      })
    : activeSessions

  const liveValue = (x) => sessionCurrentValue(x)
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (sortBy === 'ending') return new Date(a.expiresAt) - new Date(b.expiresAt)
    if (sortBy === 'name') return (users.find((u) => u.id === a.userId)?.name || '').localeCompare(users.find((u) => u.id === b.userId)?.name || '')
    return (liveValue(b) - b.amount) - (liveValue(a) - a.amount)
  })
  const kpiValue = activeSessions.reduce((n, x) => n + liveValue(x), 0)
  const kpiPnl = activeSessions.reduce((n, x) => n + (liveValue(x) - x.amount), 0)
  const kpiOpen = activeSessions.reduce((n, x) => n + x.positions.length, 0)
  const endingSoon = (x) => new Date(x.expiresAt).getTime() - Date.now() < 6 * 60 * 60 * 1000

  const pickedSessions = activeSessions.filter((x) => picked.includes(x.id))
  const bulkActive = multi && pickedSessions.length > 0
  const pctNumber = parseFloat(pct)
  const pctValid = pctNumber > 0 && pctNumber <= 100
  // margin per session = pct of that session's cash, floored to whole cents
  const bulkPlan = pickedSessions.map((x) => ({ s: x, margin: pctValid ? Math.floor(x.cash * pctNumber) / 100 : 0 }))
  const bulkTotalMargin = bulkPlan.reduce((n, r) => n + r.margin, 0)

  const symbols = Object.keys(prices)
  const effectivePrices = selectedSession ? getEffectivePricesForSession(selectedSession.id) : prices
  const price = effectivePrices[tradeSymbol]
  const marketPrice = prices[tradeSymbol]
  const scenario = selectedSession ? sessionScenarios[selectedSession.id] : null
  const priceDiffers = price != null && marketPrice != null && Math.abs(price - marketPrice) > 1e-9
  const symbolSource = priceSources?.[tradeSymbol] || (REAL_SYMBOLS.includes(tradeSymbol) ? 'live' : 'simulated')
  const isRealSymbol = symbolSource !== 'simulated'
  const feedError = priceFeedStatus?.error

  const { high, low } = getRecentRange(tradeSymbol)
  const series = dedupeSeriesForSymbol(history, tradeSymbol)
  const firstValue = series[0]?.[tradeSymbol]
  const changePercent = firstValue ? ((marketPrice - firstValue) / firstValue) * 100 : 0
  const candles = bucketToCandles(series, tradeSymbol, bucketSize)

  const tier = selectedSession ? getTier(selectedSession.tierId) : null
  const owner = selectedSession ? users.find((u) => u.id === selectedSession.userId) : null
  const marginNumber = parseFloat(tradeMargin)
  const marginValid = marginNumber > 0
  const positionSize = marginValid && selectedSession ? marginNumber * selectedSession.leverage : 0
  const pctOfCash = marginValid && selectedSession && selectedSession.cash > 0 ? (marginNumber / selectedSession.cash) * 100 : 0
  const cashLeft = selectedSession ? Math.max(0, selectedSession.cash - (marginValid ? marginNumber : 0)) : 0

  const closedTrades = selectedSession
    ? orders.filter((o) => o.sessionId === selectedSession.id && o.type === 'close_position').slice(0, 50)
    : []

  function togglePicked(id) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setConfirming(false)
    setBulkResults(null)
    setTradeError('')
  }

  function toggleMulti() {
    setMulti((m) => !m)
    setPicked([])
    setPct('')
    setConfirming(false)
    setBulkResults(null)
    setTradeError('')
  }

  function pickSession(id) {
    setSelectedSessionId(id)
    setConfirming(false)
    setTradeError('')
    setCloseError('')
    setClosingId(null)
  }

  function startConfirm() {
    setTradeError('')
    setBulkResults(null)
    if (bulkActive) {
      if (!pctValid) { setTradeError('Enter a percentage between 1 and 100.'); return }
      if (bulkTotalMargin <= 0) { setTradeError('None of the selected sessions has cash to use.'); return }
      setConfirming(true)
      return
    }
    if (!selectedSession) return
    if (!marginValid) {
      setTradeError('Enter a margin amount above zero.')
      return
    }
    setConfirming(true)
  }

  async function handleOpenPosition() {
    if (!selectedSession || busy) return
    setBusy(true)
    const result = await openSessionPosition(selectedSession.id, tradeSymbol, marginNumber, tradeDirection)
    setBusy(false)
    setConfirming(false)
    if (result.error) {
      setTradeError(result.error)
      return
    }
    setTradeMargin('')
    setTab('positions')
    setTradeOpen(false)
  }

  // One request per session, one after another, so each is recorded and audited on its own.
  async function handleBulkOpen() {
    if (busy) return
    setBusy(true)
    const results = []
    for (const row of bulkPlan) {
      const name = users.find((u) => u.id === row.s.userId)?.name || `User #${row.s.userId}`
      if (row.margin <= 0) { results.push({ id: row.s.id, name, ok: false, msg: 'No cash available' }); continue }
      const r = await openSessionPosition(row.s.id, tradeSymbol, row.margin, tradeDirection)
      results.push({ id: row.s.id, name, ok: !r?.error, msg: r?.error || `Opened · margin ${formatMoney(row.margin)}` })
    }
    setBusy(false)
    setConfirming(false)
    setBulkResults(results)
    setTab('positions')
  }

  async function handleClosePosition(positionId) {
    if (!selectedSession || busy) return
    setCloseError('')
    setBusy(true)
    const result = await closeSessionPosition(selectedSession.id, positionId)
    setBusy(false)
    setClosingId(null)
    if (result?.error) setCloseError(result.error)
  }

  async function handleSetLeverage() {
    setLeverageError('')
    if (!selectedSession) return
    const leverage = parseFloat(leverageInput)
    if (!leverage || leverage <= 0) {
      setLeverageError('Enter a leverage above zero.')
      return
    }
    const result = await setSessionLeverage(selectedSession.id, leverage)
    if (result.error) {
      setLeverageError(result.error)
      return
    }
    setLeverageInput('')
  }

  async function handleStartSession() {
    setStartError('')
    if (!startClientId) return setStartError('Pick a client.')
    const amount = parseFloat(startAmount)
    if (!amount || amount <= 0) return setStartError('Enter an amount above zero.')
    const result = await startSession(Number(startClientId), startTier, amount, startDuration)
    if (result.error) {
      setStartError(result.error)
      return
    }
    pickSession(result.session.id)
    setStartAmount('')
    setShowStartSession(false)
  }

  function setQuickMargin(fraction) {
    if (!selectedSession) return
    setTradeMargin((Math.floor(selectedSession.cash * fraction * 100) / 100).toString())
  }

  const sourceChip = !isRealSymbol
    ? <span className="tm-chip sim">Simulated</span>
    : (feedError || symbolSource === 'delayed')
      ? <span className="tm-chip warn">Feed delayed</span>
      : <span className="tm-chip live">Live feed</span>

  const ownerName = owner?.name || (selectedSession ? `User #${selectedSession.userId}` : '')

  // The order form is built once and shown in the side column on desktop, or in a
  // bottom sheet on phones (opened from the sticky Trade button).
  const orderBody = (!selectedSession && !bulkActive) ? (
    <div className="tm-empty">{multi ? 'Tick the sessions you want to trade in, from the list above.' : 'Select an active session to place a trade for that client.'}</div>
  ) : (
    <div className="tm-order-body">
      <div className="tm-note" style={{ marginTop: -2 }}>
        {bulkActive
          ? <>Trading in <strong style={{ color: 'var(--text)' }}>{pickedSessions.length} sessions</strong> at once</>
          : <>Trading for <strong style={{ color: 'var(--text)' }}>{ownerName}</strong> · {tier?.name || selectedSession.tierId}</>}
      </div>

      <div className="tm-side-toggle">
        <button type="button" className={'long' + (tradeDirection === 'long' ? ' on' : '')} onClick={() => { setTradeDirection('long'); setConfirming(false) }}>
          <TrendingUp size={15} /> Long
        </button>
        <button type="button" className={'short' + (tradeDirection === 'short' ? ' on' : '')} onClick={() => { setTradeDirection('short'); setConfirming(false) }}>
          <TrendingDown size={15} /> Short
        </button>
      </div>

      <div className="tm-field">
        <label><span>Price</span><span>{tradeSymbol}</span></label>
        <div className="tm-input" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatPrice(bulkActive ? marketPrice : price)} <span className="tm-note">(live feed price, set by the server)</span></div>
      </div>

      {bulkActive ? (
        <>
          <div className="tm-field">
            <label><span>Margin per session (% of its cash)</span></label>
            <input className="tm-input" type="number" min="0" max="100" value={pct} onChange={(e) => { setPct(e.target.value); setConfirming(false) }} placeholder="e.g. 25" />
          </div>
          <div className="tm-quick">
            {[10, 25, 50, 100].map((f) => <button key={f} type="button" onClick={() => { setPct(String(f)); setConfirming(false) }}>{f}%</button>)}
          </div>
          <div className="tm-plan">
            {bulkPlan.map((r) => (
              <div key={r.s.id} className="tm-plan-row">
                <span>{users.find((u) => u.id === r.s.userId)?.name || `User #${r.s.userId}`}<small>cash {formatMoney(r.s.cash)} · {r.s.leverage}x</small></span>
                <b>{pctValid ? formatMoney(r.margin) : '—'}</b>
              </div>
            ))}
          </div>
          <div className="tm-kv"><span>Total margin</span><b>{pctValid ? formatMoney(bulkTotalMargin) : '—'}</b></div>
        </>
      ) : (
        <>
          <div className="tm-field">
            <label><span>Margin (USD)</span><span>Cash: {formatMoney(selectedSession.cash)}</span></label>
            <input className="tm-input" type="number" min="0" value={tradeMargin} onChange={(e) => { setTradeMargin(e.target.value); setConfirming(false) }} placeholder="0.00" />
          </div>
          <div className="tm-quick">
            {[0.25, 0.5, 0.75, 1].map((f) => <button key={f} type="button" onClick={() => setQuickMargin(f)}>{f * 100}%</button>)}
          </div>
          <div className="tm-kv"><span>Leverage</span><b>{selectedSession.leverage}x</b></div>
          <div className="tm-kv"><span>Position size</span><b>{formatMoney(positionSize)}</b></div>
        </>
      )}

      {tradeError && <div className="form-error">{tradeError}</div>}

      {confirming ? (
        <div className="tm-confirm">
          {bulkActive ? (
            <>
              <div>
                Open a <strong>{tradeDirection.toUpperCase()}</strong> position on <strong>{tradeSymbol}</strong> in <strong>{pickedSessions.length} sessions</strong>,
                using <strong>{pctNumber}%</strong> of each session's cash (<strong>{formatMoney(bulkTotalMargin)}</strong> in total). Each one is sent and logged separately.
              </div>
              <div className="tm-confirm-actions">
                <button className="tm-mini" onClick={() => setConfirming(false)}>Cancel</button>
                <button className="tm-mini solid" disabled={busy} onClick={handleBulkOpen}>{busy ? 'Opening…' : `Confirm ${pickedSessions.length}`}</button>
              </div>
            </>
          ) : (
            <>
              <div>
                Open a <strong>{tradeDirection.toUpperCase()}</strong> position on <strong>{tradeSymbol}</strong> for <strong>{ownerName}</strong>, entering at the live price (about {formatPrice(price)}).
              </div>
              <div className="tm-risk">
                <div className="tm-kv"><span>Margin</span><b>{formatMoney(marginNumber)}</b></div>
                <div className="tm-kv"><span>Share of session cash</span><b>{pctOfCash.toFixed(0)}%</b></div>
                <div className="tm-kv"><span>Cash left after</span><b>{formatMoney(cashLeft)}</b></div>
                <div className="tm-kv"><span>Position size ({selectedSession.leverage}x)</span><b>{formatMoney(positionSize)}</b></div>
              </div>
              {pctOfCash > 50 && <div className="tm-warn"><AlertTriangle size={14} /> This uses more than half of the session's cash.</div>}
              {marginNumber > selectedSession.cash && <div className="tm-warn"><AlertTriangle size={14} /> More than the session's cash. The server will refuse it.</div>}
              <div className="tm-confirm-actions">
                <button className="tm-mini" onClick={() => setConfirming(false)}>Cancel</button>
                <button className="tm-mini solid" disabled={busy} onClick={handleOpenPosition}>{busy ? 'Opening…' : 'Confirm'}</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button className={'tm-go ' + tradeDirection} onClick={startConfirm}>
          Open {tradeDirection} · {tradeSymbol}{bulkActive ? ` · ${pickedSessions.length} sessions` : ''}
        </button>
      )}

      {bulkResults && (
        <div className="tm-results">
          <div className="tm-results-head">
            <b>{bulkResults.filter((r) => r.ok).length} of {bulkResults.length} opened</b>
            <button className="tm-mini" onClick={() => setBulkResults(null)}>Dismiss</button>
          </div>
          {bulkResults.map((r) => (
            <div key={r.id} className={'tm-result ' + (r.ok ? 'ok' : 'bad')}><span>{r.name}</span><small>{r.msg}</small></div>
          ))}
        </div>
      )}

      <div className="tm-note">
        The server records the entry price from its own feed and takes the margin from the session's cash. Every action is added to the audit log.
      </div>
    </div>
  )

  return (
    <Layout pageTitle="Trading Console">
      <h1 className="page-title">Trading Console</h1>
      <p className="page-sub">
        Open and manage positions across every client's active session in one place. Every position is recorded
        against the client's session and logged with who placed it.
      </p>

      <div className="tm">
        <div className="tm-kpis">
          <div><span>Active sessions</span><b>{activeSessions.length}</b></div>
          <div><span>Live session value</span><b>{formatMoney(kpiValue)}</b></div>
          <div><span>Live P&amp;L</span><b className={kpiPnl >= 0 ? 'tm-up' : 'tm-down'}>{kpiPnl >= 0 ? '+' : ''}{formatMoney(kpiPnl)}</b></div>
          <div><span>Open positions</span><b>{kpiOpen}</b></div>
        </div>

        <div className="tm-symbols" role="tablist" aria-label="Instrument">
          {symbols.map((symbol) => (
            <button
              key={symbol}
              role="tab"
              aria-selected={symbol === tradeSymbol}
              className={'tm-symbol' + (symbol === tradeSymbol ? ' on' : '')}
              onClick={() => setTradeSymbol(symbol)}
            >
              {symbol}
            </button>
          ))}
        </div>

        <div className="tm-head">
          <div className="tm-pair">{tradeSymbol}<small>{sourceChip}</small></div>
          <div>
            <div className="tm-price">{formatPrice(price)}</div>
            {priceDiffers && <div className="tm-note">Market feed: {formatPrice(marketPrice)} (this session uses a scenario price)</div>}
          </div>
          <div className="tm-stat"><span>Change (this view)</span><b className={changePercent >= 0 ? 'tm-up' : 'tm-down'}>{changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</b></div>
          <div className="tm-stat"><span>Recent high</span><b>{formatPrice(high)}</b></div>
          <div className="tm-stat"><span>Recent low</span><b>{formatPrice(low)}</b></div>
        </div>

        <div className="tm-grid">
          {/* ---------- Sessions ---------- */}
          <aside className="panel tm-sessions">
            <div className="tm-sessions-head">
              <h3>Active sessions ({filteredSessions.length})</h3>
              <span className="tm-head-actions">
                <button className={'tm-mini' + (multi ? ' solid' : '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={toggleMulti} aria-pressed={multi}>
                  <Layers size={13} /> {multi ? 'Done selecting' : 'Select several'}
                </button>
                <button className="tm-mini solid" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setShowStartSession(!showStartSession)}>
                  <Plus size={13} /> Start
                </button>
              </span>
            </div>

            {showStartSession && (
              <div className="tm-start">
                {startError && <div className="form-error">{startError}</div>}
                <select className="tm-input" value={startClientId} onChange={(e) => setStartClientId(e.target.value)}>
                  <option value="">Pick a client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                  className="tm-input"
                  value={startTier}
                  onChange={(e) => {
                    setStartTier(e.target.value)
                    const t = getTier(e.target.value)
                    if (t) setStartDuration(t.durationDays)
                  }}
                >
                  {ALL_TIERS.map((t) => <option key={t.id} value={t.id}>{t.hidden ? `⭐ ${t.name}` : t.name}</option>)}
                </select>
                <input className="tm-input" type="number" value={startDuration} onChange={(e) => setStartDuration(e.target.value)} placeholder="Days" />
                <input className="tm-input" type="number" value={startAmount} onChange={(e) => setStartAmount(e.target.value)} placeholder="Amount (USD)" />
                <button className="tm-mini solid" onClick={handleStartSession}>Start session</button>
              </div>
            )}

            <div className="tm-filters">
              <div className="tm-search">
                <Search size={14} />
                <input className="tm-input" type="text" placeholder="Find a client…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <label className="tm-sort">
                <ArrowUpDown size={13} />
                <select className="tm-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort sessions">
                  <option value="pnl">Biggest P&amp;L first</option>
                  <option value="ending">Ending soonest</option>
                  <option value="name">Client name</option>
                </select>
              </label>
              {multi && (
                <span className="tm-head-actions">
                  <button className="tm-mini" onClick={() => setPicked(sortedSessions.map((x) => x.id))}>Select all ({sortedSessions.length})</button>
                  <button className="tm-mini" onClick={() => setPicked([])} disabled={picked.length === 0}>Clear</button>
                </span>
              )}
            </div>

            {sortedSessions.length === 0 ? (
              <div className="tm-empty">{activeSessions.length === 0 ? 'No active sessions right now.' : 'No active sessions match this search.'}</div>
            ) : (
              <div className="tm-session-list">
                {sortedSessions.map((x) => {
                  const o = users.find((u) => u.id === x.userId)
                  const t = getTier(x.tierId)
                  const livePnl = sessionCurrentValue(x) - x.amount
                  const up = livePnl >= 0
                  const isOn = multi ? picked.includes(x.id) : selectedSession?.id === x.id
                  return (
                    <button
                      key={x.id}
                      className={'tm-session' + (isOn ? ' on' : '')}
                      onClick={() => (multi ? togglePicked(x.id) : pickSession(x.id))}
                      aria-pressed={isOn}
                    >
                      {multi && <span className="tm-check">{isOn ? <CheckSquare size={18} /> : <Square size={18} />}</span>}
                      <span className="tm-session-main">
                        <b>{o?.name || `User #${x.userId}`}</b>
                        <small>{t?.name || x.tierId} · {x.positions.length} open · {formatTimeLeft(x.expiresAt)}</small>
                        {endingSoon(x) && <em className="tm-soon"><Clock size={11} /> Ending soon</em>}
                      </span>
                      <span className={'pnl ' + (up ? 'tm-up' : 'tm-down')}>{up ? '+' : ''}{formatMoney(livePnl)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </aside>

          {/* ---------- Chart + tabs ---------- */}
          <section className="tm-center">
            <div className="panel">
              <div className="tm-toolbar">
                <span>{tradeSymbol} · market feed{priceDiffers ? ' (scenario prices apply to the selected session)' : ''}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  Price changes per candle
                  <span className="tm-seg">
                    {CANDLE_SIZES.map((n) => (
                      <button key={n} className={n === bucketSize ? 'on' : ''} onClick={() => setBucketSize(n)}>{n}</button>
                    ))}
                  </span>
                </span>
              </div>
              <div className="tm-chart-body">
                <CandlestickChart candles={candles} height={isPhone ? 230 : 300} />
              </div>
            </div>

            <div className="panel">
              <div className="tm-tabs">
                <button className={tab === 'positions' ? 'on' : ''} onClick={() => setTab('positions')}>
                  Open positions{selectedSession ? ` (${selectedSession.positions.length})` : ''}
                </button>
                <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>Trade history</button>
                <button className={tab === 'session' ? 'on' : ''} onClick={() => setTab('session')}>Session &amp; leverage</button>
              </div>
              {!selectedSession ? (
                <div className="tm-empty">Select an active session to see its positions.</div>
              ) : tab === 'positions' ? (
                <>
                  {closeError && <div className="form-error" style={{ margin: '12px 16px 0' }}>{closeError}</div>}
                  {selectedSession.positions.length === 0 ? (
                    <div className="tm-empty">No open positions in this session.</div>
                  ) : (
                    <div className="tm-scroll">
                      <table className="tm-table">
                        <thead>
                          <tr><th>Instrument</th><th>Side</th><th className="n">Margin</th><th className="n">Lev.</th><th className="n">Entry</th><th className="n">Now</th><th className="n">P&amp;L</th><th></th></tr>
                        </thead>
                        <tbody>
                          {selectedSession.positions.map((p) => {
                            const livePnl = positionEquity(p, effectivePrices) - p.marginAmount
                            const up = livePnl >= 0
                            return (
                              <tr key={p.id}>
                                <td><b>{p.symbol}</b></td>
                                <td><span className={'tm-side ' + (p.direction === 'short' ? 'short' : 'long')}>{p.direction === 'short' ? 'Short' : 'Long'}</span></td>
                                <td className="n">{formatMoney(p.marginAmount)}</td>
                                <td className="n">{p.leverage}x</td>
                                <td className="n">{formatPrice(p.entryPrice)}</td>
                                <td className="n">{formatPrice(effectivePrices[p.symbol])}</td>
                                <td className={'n ' + (up ? 'tm-up' : 'tm-down')}>{up ? '+' : ''}{formatMoney(livePnl)}</td>
                                <td style={{ textAlign: 'right' }}>
                                  {closingId === p.id ? (
                                    <span style={{ display: 'inline-flex', gap: 6 }}>
                                      <button className="tm-mini danger" disabled={busy} onClick={() => handleClosePosition(p.id)}>Confirm close</button>
                                      <button className="tm-mini" onClick={() => setClosingId(null)}>Keep</button>
                                    </span>
                                  ) : (
                                    <button className="tm-mini" onClick={() => setClosingId(p.id)}>Close</button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : tab === 'history' ? (
                closedTrades.length === 0 ? (
                  <div className="tm-empty">No closed trades in this session yet.</div>
                ) : (
                  <div className="tm-scroll">
                    <table className="tm-table">
                      <thead>
                        <tr><th>Closed</th><th>Instrument</th><th>Side</th><th className="n">Margin</th><th className="n">Exit</th><th className="n">P&amp;L</th><th>By</th></tr>
                      </thead>
                      <tbody>
                        {closedTrades.map((o) => {
                          const up = (o.pnl ?? 0) >= 0
                          return (
                            <tr key={o.id}>
                              <td>{formatDateTime(o.date)}</td>
                              <td><b>{o.symbol}</b></td>
                              <td><span className={'tm-side ' + (o.direction === 'short' ? 'short' : 'long')}>{o.direction === 'short' ? 'Short' : 'Long'}</span></td>
                              <td className="n">{formatMoney(o.marginAmount)}</td>
                              <td className="n">{formatPrice(o.price)}</td>
                              <td className={'n ' + (up ? 'tm-up' : 'tm-down')}>{o.pnl == null ? '—' : `${up ? '+' : ''}${formatMoney(o.pnl)}`}</td>
                              <td>{o.executedByAdminName || 'Client'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="tm-session-info">
                  {scenario && (
                    <div className="tm-banner">
                      <Activity size={14} />
                      <span>
                        <strong>Scenario active:</strong>
                        {scenario.reset
                          ? ` Resetting (${scenario.reset.level}) — returning to real market price.`
                          : ` ${scenario.mode} · strength ${scenario.strength} · volatility ${scenario.volatility} · ${scenario.speed}x speed.`}
                      </span>
                    </div>
                  )}
                  <div className="tm-cards">
                    <div className="tm-card"><span>Client</span><b style={{ fontFamily: 'inherit' }}><Link to={`/admin/users/${selectedSession.userId}`} style={{ color: 'inherit' }}>{owner?.name || `User #${selectedSession.userId}`}</Link></b></div>
                    <div className="tm-card"><span>Session cash (uncommitted)</span><b>{formatMoney(selectedSession.cash)}</b></div>
                    <div className="tm-card"><span>Live session value</span><b>{formatMoney(sessionCurrentValue(selectedSession))}</b></div>
                    <div className="tm-card">
                      <span>Time left</span><b>{formatTimeLeft(selectedSession.expiresAt)}</b>
                      <div className="progress-track" style={{ marginTop: 8 }}><div className="progress-fill" style={{ width: `${sessionProgress(selectedSession)}%` }} /></div>
                    </div>
                  </div>
                  <div>
                    <div className="tm-note" style={{ marginBottom: 6 }}>
                      Leverage — currently {selectedSession.leverage}x
                      {tier ? ` (range ${tier.leverageRange.min}x–${tier.leverageRange.max}x for ${tier.name})` : ''}. Only affects positions opened from now on.
                    </div>
                    {leverageError && <div className="form-error" style={{ marginBottom: 8 }}>{leverageError}</div>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input className="tm-input" style={{ maxWidth: 180 }} type="number" value={leverageInput} onChange={(e) => setLeverageInput(e.target.value)} placeholder="New leverage (x)" />
                      <button className="tm-mini solid" onClick={handleSetLeverage}>Apply</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ---------- Order panel (desktop) ---------- */}
          {!isPhone && (
            <aside className="panel tm-order">
              <div className="panel-head"><h3>Open a position</h3></div>
              {orderBody}
            </aside>
          )}
        </div>
      </div>

      {/* ---------- Order panel (phone): sticky button + bottom sheet ---------- */}
      {isPhone && (
        <>
          <button className={'tm-sticky ' + tradeDirection} onClick={() => setTradeOpen(true)} disabled={!selectedSession && !bulkActive}>
            {bulkActive ? `Trade in ${pickedSessions.length} sessions` : selectedSession ? `Trade · ${ownerName}` : 'Select a session to trade'}
          </button>
          <BottomSheet open={tradeOpen} onClose={() => setTradeOpen(false)} title="Open a position">
            {orderBody}
          </BottomSheet>
        </>
      )}
    </Layout>
  )
}
