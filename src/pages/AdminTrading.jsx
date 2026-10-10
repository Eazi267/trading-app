import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, TrendingUp, TrendingDown, Activity, Plus } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp, positionEquity } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getClients } from '../config/clients.js'
import { TIERS, ALL_TIERS, getTier } from '../config/tiers.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
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

export default function AdminTrading() {
  const {
    prices, sessions, sessionScenarios, sessionCurrentValue, getEffectivePricesForSession,
    startSession, openSessionPosition, closeSessionPosition, setSessionLeverage
  } = useApp()
  const { users } = useAuth()

  const activeSessions = sessions.filter((s) => s.status === 'active')
  const [selectedSessionId, setSelectedSessionId] = useState(activeSessions[0]?.id || null)
  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId) || null

  const [search, setSearch] = useState('')
  const [tradeSymbol, setTradeSymbol] = useState(Object.keys(prices)[0])
  const [tradeDirection, setTradeDirection] = useState('long')
  const [tradeMargin, setTradeMargin] = useState('')
  const [tradeError, setTradeError] = useState('')
  const [leverageInput, setLeverageInput] = useState('')
  const [leverageError, setLeverageError] = useState('')

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

  async function handleOpenPosition() {
    setTradeError('')
    if (!selectedSession) return
    const margin = parseFloat(tradeMargin)
    if (!margin || margin <= 0) {
      setTradeError('Enter a margin amount above zero.')
      return
    }
    const result = await openSessionPosition(selectedSession.id, tradeSymbol, margin, tradeDirection)
    if (result.error) {
      setTradeError(result.error)
      return
    }
    setTradeMargin('')
  }

  function handleClosePosition(positionId) {
    if (!selectedSession) return
    closeSessionPosition(selectedSession.id, positionId)
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
    setSelectedSessionId(result.session.id)
    setStartAmount('')
    setShowStartSession(false)
  }

  return (
    <Layout pageTitle="Trading Console">
      <h1 className="page-title">Trading Console</h1>
      <p className="page-sub">
        Everything for opening and managing positions across every client's active session — in one place,
        instead of jumping into each client's page just to place a trade.
      </p>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Active sessions ({filteredSessions.length})</h3>
          <button
            className="tx-btn deposit"
            style={{ padding: '6px 12px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowStartSession(!showStartSession)}
          >
            <Plus size={13} /> Start a session
          </button>
        </div>

        {showStartSession && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {startError && <div className="form-error" style={{ width: '100%' }}>{startError}</div>}
            <select
              value={startClientId}
              onChange={(e) => setStartClientId(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, minWidth: 180 }}
            >
              <option value="">Pick a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={startTier}
              onChange={(e) => {
                setStartTier(e.target.value)
                const t = getTier(e.target.value)
                if (t) setStartDuration(t.durationDays)
              }}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            >
              {ALL_TIERS.map((t) => (
                <option key={t.id} value={t.id}>{t.hidden ? `⭐ ${t.name}` : t.name}</option>
              ))}
            </select>
            <input
              type="number"
              value={startDuration}
              onChange={(e) => setStartDuration(e.target.value)}
              placeholder="Days"
              style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
            <input
              type="number"
              value={startAmount}
              onChange={(e) => setStartAmount(e.target.value)}
              placeholder="Amount (USD)"
              style={{ width: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
            <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleStartSession}>
              Start
            </button>
          </div>
        )}

        <div style={{ position: 'relative', margin: '16px 20px', maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Find a client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>

        {filteredSessions.length === 0 ? (
          <div className="empty-state"><p>{activeSessions.length === 0 ? 'No active sessions right now.' : 'No active sessions match this search.'}</p></div>
        ) : (
          <div style={{ padding: '0 16px 16px' }}>
            {filteredSessions.map((s) => {
              const owner = users.find((u) => u.id === s.userId)
              const tier = getTier(s.tierId)
              const livePnl = sessionCurrentValue(s) - s.amount
              const isProfit = livePnl >= 0
              return (
                <div key={s.id} className={'entity-card' + (s.id === selectedSessionId ? ' entity-card-accent-pending' : '')}>
                  <div className="icon-badge">{isProfit ? <TrendingUp size={17} /> : <TrendingDown size={17} />}</div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">
                      <Link to={`/admin/users/${s.userId}`} style={{ color: 'inherit', fontWeight: 600 }}>{owner?.name || `User #${s.userId}`}</Link> · {tier?.name || s.tierId}
                    </div>
                    <div className="entity-card-meta">
                      <span>{formatMoney(s.amount)} committed</span>
                      <span>{s.positions.length} open position{s.positions.length === 1 ? '' : 's'}</span>
                      <span>{formatTimeLeft(s.expiresAt)}</span>
                    </div>
                  </div>
                  <div className={isProfit ? 'pnl-up' : 'pnl-down'} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, flex: 'none' }}>
                    {isProfit ? '+' : ''}{formatMoney(livePnl)}
                  </div>
                  <button
                    className="tx-btn"
                    style={{ padding: '6px 12px', fontSize: 12, flex: 'none' }}
                    onClick={() => setSelectedSessionId(s.id)}
                  >
                    {s.id === selectedSessionId ? 'Selected' : 'Trade'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedSession && (() => {
        const owner = users.find((u) => u.id === selectedSession.userId)
        const tier = getTier(selectedSession.tierId)
        const effectivePrices = getEffectivePricesForSession(selectedSession.id)
        const scenario = sessionScenarios[selectedSession.id]
        return (
          <div className="panel">
            <div className="panel-head">
              <h3>
                Trading for <Link to={`/admin/users/${selectedSession.userId}`} style={{ color: 'inherit' }}>{owner?.name}</Link> — {tier?.name || selectedSession.tierId}
              </h3>
            </div>

            {scenario && (
              <div style={{ margin: '16px 20px 0', padding: '10px 14px', borderRadius: 10, background: 'var(--accent-bg)', border: '1px solid var(--accent)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={14} />
                <strong>Scenario active:</strong>
                {scenario.reset
                  ? ` Resetting (${scenario.reset.level}) — returning to real market price.`
                  : ` ${scenario.mode} · strength ${scenario.strength} · volatility ${scenario.volatility} · ${scenario.speed}x speed.`}
              </div>
            )}

            <div className="stats-grid" style={{ padding: '16px 20px 0' }}>
              <div className="stat-card">
                <div className="stat-label">Session cash (uncommitted)</div>
                <div className="stat-value">{formatMoney(selectedSession.cash)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Live session value</div>
                <div className="stat-value">{formatMoney(sessionCurrentValue(selectedSession))}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Time left</div>
                <div className="stat-value">{formatTimeLeft(selectedSession.expiresAt)}</div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${sessionProgress(selectedSession)}%` }} />
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px 0' }}>
              <div className="stat-label" style={{ marginBottom: 6 }}>
                Leverage — currently {selectedSession.leverage}x
                {tier ? ` (range ${tier.leverageRange.min}x–${tier.leverageRange.max}x for ${tier.name})` : ''}
              </div>
              {leverageError && <div className="form-error" style={{ marginBottom: 8 }}>{leverageError}</div>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  value={leverageInput}
                  onChange={(e) => setLeverageInput(e.target.value)}
                  placeholder="New leverage (x)"
                  style={{ width: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                />
                <button className="tx-btn" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleSetLeverage}>
                  Apply
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Only affects positions opened from now on.
                </span>
              </div>
            </div>

            {tradeError && <div className="form-error" style={{ margin: '16px 20px 0' }}>{tradeError}</div>}

            <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <select
                value={tradeSymbol}
                onChange={(e) => setTradeSymbol(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
              >
                {Object.keys(prices).map((symbol) => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                @ {formatMoney(effectivePrices[tradeSymbol])}
              </span>
              <div className="segment-tabs" style={{ margin: 0, padding: 3 }}>
                <button
                  type="button"
                  className={'segment-tab' + (tradeDirection === 'long' ? ' active tab-accent-success' : '')}
                  style={{ padding: '7px 14px' }}
                  onClick={() => setTradeDirection('long')}
                >
                  <TrendingUp size={14} /> Long
                </button>
                <button
                  type="button"
                  className={'segment-tab' + (tradeDirection === 'short' ? ' active tab-accent-danger' : '')}
                  style={{ padding: '7px 14px' }}
                  onClick={() => setTradeDirection('short')}
                >
                  <TrendingDown size={14} /> Short
                </button>
              </div>
              <input
                type="number"
                value={tradeMargin}
                onChange={(e) => setTradeMargin(e.target.value)}
                placeholder="Margin amount (USD)"
                style={{ width: 170, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
              />
              <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleOpenPosition}>
                Open {tradeDirection} position ({selectedSession.leverage}x)
              </button>
            </div>

            {selectedSession.positions.length === 0 ? (
              <div className="empty-state"><p>No open positions in this session.</p></div>
            ) : (
              <div style={{ padding: 16 }}>
                {selectedSession.positions.map((p) => {
                  const currentPrice = effectivePrices[p.symbol]
                  const livePnl = positionEquity(p, effectivePrices) - p.marginAmount
                  const isProfit = livePnl >= 0
                  const isShort = p.direction === 'short'
                  return (
                    <div key={p.id} className={'entity-card' + (isProfit ? ' entity-card-accent-profit' : ' entity-card-accent-loss')}>
                      <div className="icon-badge">{isProfit ? <TrendingUp size={17} /> : <TrendingDown size={17} />}</div>
                      <div className="entity-card-body">
                        <div className="entity-card-title">
                          {p.symbol} · {formatMoney(p.marginAmount)} margin
                          <span className={'status-pill ' + (isShort ? 'status-rejected' : 'status-approved')} style={{ marginLeft: 8, fontSize: 10.5 }}>
                            {isShort ? 'short' : 'long'}
                          </span>
                        </div>
                        <div className="entity-card-meta">
                          <span>Entry {formatMoney(p.entryPrice)}</span>
                          <span>Now {formatMoney(currentPrice)}</span>
                        </div>
                      </div>
                      <div className={isProfit ? 'pnl-up' : 'pnl-down'} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, flex: 'none' }}>
                        {isProfit ? '+' : ''}{formatMoney(livePnl)}
                      </div>
                      <button className="tx-btn withdraw" style={{ padding: '6px 12px', fontSize: 12, flex: 'none' }} onClick={() => handleClosePosition(p.id)}>
                        Close
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}
    </Layout>
  )
}
