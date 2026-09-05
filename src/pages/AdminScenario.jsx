import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FastForward, Activity, Bitcoin, Coins, Landmark, Gem, RotateCcw } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getTier } from '../config/tiers.js'

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

function formatResetTimeLeft(reset) {
  if (!reset) return null
  const elapsed = Date.now() - new Date(reset.startedAt).getTime()
  const remainingMs = Math.max(0, reset.durationMs - elapsed)
  const seconds = Math.ceil(remainingMs / 1000)
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}m left`
  return `${seconds}s left`
}

function symbolIcon(symbol) {
  if (symbol.startsWith('BTC')) return Bitcoin
  if (symbol.startsWith('ETH')) return Coins
  if (symbol.startsWith('XAU') || symbol.startsWith('XAG')) return Gem
  return Landmark
}

const MODES = [
  { id: 'bearish', label: 'Bearish' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'bullish', label: 'Bullish' }
]
const STRENGTHS = [{ value: 1, label: 'Mild' }, { value: 2, label: 'Moderate' }, { value: 3, label: 'Strong' }]
const VOLATILITIES = [{ value: 1, label: 'Calm' }, { value: 2, label: 'Normal' }, { value: 3, label: 'Choppy' }]
const SPEEDS = [{ value: 1, label: '1x' }, { value: 2, label: '2x' }, { value: 5, label: '5x' }, { value: 10, label: '10x' }]
const RESET_LEVELS = [
  { id: 'mild', label: 'Mild', hint: '5 min, gentle' },
  { id: 'normal', label: 'Normal', hint: '90 sec' },
  { id: 'hard', label: 'Hard', hint: '15 sec, near-instant' }
]

const PRESETS = [
  { label: 'Trending bull run', mode: 'bullish', strength: 3, volatility: 2, speed: 3 },
  { label: 'Sharp sell-off', mode: 'bearish', strength: 3, volatility: 2, speed: 3 },
  { label: 'Chaotic swings', mode: 'neutral', strength: 1, volatility: 3, speed: 5 }
]

function ToggleGroup({ options, value, onChange, getLabel = (o) => o.label, getValue = (o) => o.value }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={getValue(opt)}
          onClick={() => onChange(getValue(opt))}
          className="tx-btn"
          style={{
            padding: '6px 12px', fontSize: 12,
            background: value === getValue(opt) ? 'var(--accent)' : 'var(--bg)',
            color: value === getValue(opt) ? '#fff' : 'var(--text)',
            border: '1px solid var(--border)'
          }}
        >
          {getLabel(opt)}
        </button>
      ))}
    </div>
  )
}

export default function AdminScenario() {
  const {
    sessions, prices, sessionScenarios, applySessionScenario, resetSessionScenario, resetAllSessionScenarios,
    fastForwardSession, fastForwardAllSessions, sessionCurrentValue
  } = useApp()
  const { users } = useAuth()

  const symbols = Object.keys(prices)
  const activeSessions = sessions.filter((s) => s.status === 'active')
  const [selectedSessionId, setSelectedSessionId] = useState(activeSessions[0]?.id || null)
  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId) || activeSessions[0] || null
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0])
  const selectedSymbolScenario = selectedSession ? sessionScenarios[selectedSession.id]?.[selectedSymbol] : null

  const [draft, setDraft] = useState({ mode: 'neutral', strength: 1, volatility: 1, speed: 1 })
  const [fastForwardHours, setFastForwardHours] = useState({})
  const [bulkHours, setBulkHours] = useState('')
  const [showBulkInput, setShowBulkInput] = useState(false)

  function updateDraft(overrides) {
    setDraft((prev) => ({ ...prev, ...overrides }))
  }

  function handleApply() {
    if (!selectedSession) return
    applySessionScenario(selectedSession.id, selectedSymbol, draft.mode, draft.strength, draft.volatility, draft.speed)
  }

  function handlePreset(preset) {
    setDraft({ mode: preset.mode, strength: preset.strength, volatility: preset.volatility, speed: preset.speed })
    if (selectedSession) applySessionScenario(selectedSession.id, selectedSymbol, preset.mode, preset.strength, preset.volatility, preset.speed)
  }

  function handleReset(level) {
    if (!selectedSession) return
    resetSessionScenario(selectedSession.id, selectedSymbol, level)
  }

  function handleFastForward(sessionId) {
    const hours = parseFloat(fastForwardHours[sessionId])
    if (!hours || hours <= 0) return
    fastForwardSession(sessionId, hours)
    setFastForwardHours((prev) => ({ ...prev, [sessionId]: '' }))
  }

  function handleBulkFastForward() {
    const hours = parseFloat(bulkHours)
    if (!hours || hours <= 0) return
    fastForwardAllSessions(hours)
    setBulkHours('')
    setShowBulkInput(false)
  }

  // Flat, cross-session list of every symbol currently running a
  // scenario, anywhere — the "efficiency" view. Without this, seeing
  // what's actually biased right now means opening every session one
  // at a time and checking each symbol tab. This answers "what's
  // running right now" in one glance, with a one-click reset per row.
  const liveScenarios = []
  Object.entries(sessionScenarios).forEach(([sessionId, symbolScenarios]) => {
    const session = activeSessions.find((s) => s.id === Number(sessionId))
    if (!session) return
    Object.entries(symbolScenarios).forEach(([symbol, scenario]) => {
      liveScenarios.push({ session, symbol, scenario })
    })
  })

  return (
    <Layout pageTitle="Scenario Control">
      <h1 className="page-title">Scenario Control</h1>
      <p className="page-sub">
        Applies to ONE symbol within ONE session at a time. A session can run several
        different scenarios at once — BTC/USD bullish while EUR/USD stays normal in the
        same session — since each symbol's synthetic price ticks independently. Nothing
        here sets a balance or payout directly.
      </p>

      {liveScenarios.length > 0 && (
        <div className="glass-card fade-in-up-1" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h3><Activity size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Live right now ({liveScenarios.length})</h3>
          </div>
          <div style={{ padding: 16 }} className="stagger-in">
            {liveScenarios.map(({ session, symbol, scenario }) => {
              const owner = users.find((u) => u.id === session.userId)
              const Icon = symbolIcon(symbol)
              return (
                <div key={session.id + symbol} className="entity-card">
                  <div className="icon-badge"><Icon size={16} /></div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">
                      {symbol} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>on</span>{' '}
                      <Link to={`/admin/users/${session.userId}`} style={{ color: 'inherit' }}>{owner?.name || `User #${session.userId}`}</Link>
                    </div>
                    <div className="entity-card-meta">
                      {scenario.reset ? (
                        <span className="status-pill status-pending">Resetting ({formatResetTimeLeft(scenario.reset)})</span>
                      ) : (
                        <span className="status-pill status-pending">{scenario.mode}, strength {scenario.strength}/3</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                    <button
                      className="tx-btn"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => { setSelectedSessionId(session.id); setSelectedSymbol(symbol) }}
                    >
                      Control
                    </button>
                    {!scenario.reset && (
                      <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => resetSessionScenario(session.id, symbol, 'normal')}>
                        <RotateCcw size={12} /> Reset
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Session to control</h3></div>
        {activeSessions.length === 0 ? (
          <div className="empty-state"><p>No active sessions right now.</p></div>
        ) : (
          <div style={{ padding: '16px 20px' }}>
            <select
              value={selectedSession?.id || ''}
              onChange={(e) => setSelectedSessionId(Number(e.target.value))}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, minWidth: 320 }}
            >
              {activeSessions.map((s) => {
                const owner = users.find((u) => u.id === s.userId)
                const tier = getTier(s.tierId)
                const scenarioCount = Object.keys(sessionScenarios[s.id] || {}).length
                return (
                  <option key={s.id} value={s.id}>
                    {owner?.name || `User #${s.userId}`} — {tier?.name || s.tierId} — {formatMoney(s.amount)}
                    {scenarioCount > 0 ? ` — ${scenarioCount} scenario${scenarioCount === 1 ? '' : 's'} active` : ' — normal'}
                  </option>
                )
              })}
            </select>
          </div>
        )}
      </div>

      {selectedSession && (
        <>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head"><h3>Trading pair</h3></div>
            <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }} className="stagger-in">
              {symbols.map((symbol) => {
                const Icon = symbolIcon(symbol)
                const hasScenario = !!sessionScenarios[selectedSession.id]?.[symbol]
                const isSelected = symbol === selectedSymbol
                return (
                  <button
                    key={symbol}
                    onClick={() => setSelectedSymbol(symbol)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                      borderRadius: 10, border: '1px solid ' + (isSelected ? 'var(--accent)' : 'var(--border)'),
                      background: isSelected ? 'var(--accent-bg)' : 'var(--bg)',
                      color: isSelected ? 'var(--accent-bright)' : 'var(--text)',
                      cursor: 'pointer', position: 'relative'
                    }}
                  >
                    <Icon size={15} /> {symbol}
                    {hasScenario && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-bright)', marginLeft: 2 }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head"><h3>Status — {selectedSymbol} on this session</h3></div>
            <div className="stats-grid" style={{ padding: '16px 20px' }}>
              <div className="stat-card">
                <div className="stat-label">Current state</div>
                <div className="stat-value" style={{ fontSize: 16 }}>
                  {!selectedSymbolScenario
                    ? 'Normal market'
                    : selectedSymbolScenario.reset
                    ? `Resetting (${selectedSymbolScenario.reset.level})`
                    : `${selectedSymbolScenario.mode}, ${selectedSymbolScenario.strength}/3`}
                </div>
                {selectedSymbolScenario?.reset && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {formatResetTimeLeft(selectedSymbolScenario.reset)}
                  </div>
                )}
              </div>
              <div className="stat-card">
                <div className="stat-label">{selectedSymbol} price on this session</div>
                <div className="stat-value">{formatMoney(selectedSymbolScenario?.price ?? prices[selectedSymbol])}</div>
                {selectedSymbolScenario && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Real market: {formatMoney(prices[selectedSymbol])}</div>
                )}
              </div>
              <div className="stat-card">
                <div className="stat-label">Time left on session</div>
                <div className="stat-value">{formatTimeLeft(selectedSession.expiresAt)}</div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head"><h3>Quick presets — {selectedSymbol}, this session</h3></div>
            <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESETS.map((preset) => (
                <button key={preset.label} className="tx-btn deposit" style={{ padding: '10px 16px', fontSize: 13 }} onClick={() => handlePreset(preset)}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head"><h3>Custom scenario — {selectedSymbol}, this session</h3></div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Direction</div>
                <ToggleGroup options={MODES} value={draft.mode} onChange={(v) => updateDraft({ mode: v })} getValue={(o) => o.id} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Strength</div>
                <ToggleGroup options={STRENGTHS} value={draft.strength} onChange={(v) => updateDraft({ strength: v })} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Volatility</div>
                <ToggleGroup options={VOLATILITIES} value={draft.volatility} onChange={(v) => updateDraft({ volatility: v })} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Speed</div>
                <ToggleGroup options={SPEEDS} value={draft.speed} onChange={(v) => updateDraft({ speed: v })} />
              </div>
              <div>
                <button className="tx-btn deposit" style={{ padding: '10px 18px', fontSize: 13 }} onClick={handleApply}>
                  Apply to {selectedSymbol} on this session
                </button>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head"><h3>Reset</h3></div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0, marginBottom: 12 }}>
                Gradually interpolates {selectedSymbol}'s price on this session back to the real market — pick how
                fast. Other symbols on this session, and every other session, are untouched.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {RESET_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    disabled={!selectedSymbolScenario}
                    className="tx-btn withdraw"
                    style={{ padding: '10px 16px', fontSize: 13, opacity: selectedSymbolScenario ? 1 : 0.5, cursor: selectedSymbolScenario ? 'pointer' : 'not-allowed' }}
                    onClick={() => handleReset(level.id)}
                  >
                    {level.label}
                    <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>{level.hint}</div>
                  </button>
                ))}
              </div>
              {Object.keys(sessionScenarios[selectedSession.id] || {}).length > 1 && (
                <button
                  className="tx-btn withdraw"
                  style={{ padding: '8px 14px', fontSize: 12.5 }}
                  onClick={() => resetAllSessionScenarios(selectedSession.id, 'normal')}
                >
                  Reset all {Object.keys(sessionScenarios[selectedSession.id]).length} symbols on this session
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Merged: previously two separate tables ("at a glance" +
          "fast-forward") duplicating the same client/tier columns.
          One card list now covers both — status at a glance AND the
          fast-forward control live on the same row. */}
      <div className="panel">
        <div className="panel-head">
          <h3>All active sessions ({activeSessions.length})</h3>
          {activeSessions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {showBulkInput && (
                <input
                  type="number"
                  value={bulkHours}
                  onChange={(e) => setBulkHours(e.target.value)}
                  placeholder="Hours"
                  autoFocus
                  style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
                />
              )}
              <button
                className="tx-btn withdraw"
                style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => (showBulkInput ? handleBulkFastForward() : setShowBulkInput(true))}
              >
                <FastForward size={13} /> {showBulkInput ? 'Confirm' : 'Fast-forward all'}
              </button>
            </div>
          )}
        </div>
        {activeSessions.length === 0 ? (
          <div className="empty-state"><p>No active sessions right now.</p></div>
        ) : (
          <div style={{ padding: 16 }} className="stagger-in">
            {activeSessions.map((s) => {
              const owner = users.find((u) => u.id === s.userId)
              const tier = getTier(s.tierId)
              const symbolScenarios = sessionScenarios[s.id] || {}
              const scenarioEntries = Object.entries(symbolScenarios)
              return (
                <div key={s.id} className={'entity-card' + (s.id === selectedSession?.id ? ' entity-card-accent-pending' : '')} style={{ alignItems: 'flex-start' }}>
                  <div className="icon-badge"><Activity size={17} /></div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">
                      <Link to={`/admin/users/${s.userId}`} style={{ color: 'inherit', fontWeight: 600 }}>{owner?.name || `User #${s.userId}`}</Link> · {tier?.name || s.tierId} · {formatMoney(s.amount)}
                    </div>
                    <div className="entity-card-meta">
                      <span>{formatTimeLeft(s.expiresAt)}</span>
                      {scenarioEntries.length === 0 ? (
                        <span className="status-pill status-approved">Normal</span>
                      ) : (
                        scenarioEntries.map(([symbol, scenario]) => (
                          <span key={symbol} className="status-pill status-pending">
                            {symbol} {scenario.reset ? `resetting` : `${scenario.mode} ${scenario.strength}/3`}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                    {selectedSession?.id !== s.id && (
                      <button className="tx-btn" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setSelectedSessionId(s.id)}>
                        Control
                      </button>
                    )}
                    <input
                      type="number"
                      value={fastForwardHours[s.id] || ''}
                      onChange={(e) => setFastForwardHours((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="Hrs"
                      style={{ width: 56, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
                    />
                    <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleFastForward(s.id)}>
                      FF
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
