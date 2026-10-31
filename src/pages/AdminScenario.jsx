import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FastForward, Activity, Bitcoin, Coins, Landmark, Gem, RotateCcw, Zap, Clock, TrendingUp } from 'lucide-react'
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
    <div className="sc-seg" role="group">
      {options.map((opt) => (
        <button key={getValue(opt)} type="button" aria-pressed={value === getValue(opt)} className={'sc-seg-btn' + (value === getValue(opt) ? ' on' : '')} onClick={() => onChange(getValue(opt))}>
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

  const stateLabel = !selectedSymbolScenario
    ? 'Normal market'
    : selectedSymbolScenario.reset
    ? `Resetting (${selectedSymbolScenario.reset.level})`
    : `${selectedSymbolScenario.mode}, ${selectedSymbolScenario.strength}/3`
  const scenarioCountFor = (id) => Object.keys(sessionScenarios[id] || {}).length

  return (
    <Layout pageTitle="Scenario Control">
      <header className="dz-head">
        <h1 className="dz-title">Scenario Control</h1>
        <div className="dz-muted">Applies to ONE symbol within ONE session at a time. A session can run several scenarios at once, since each symbol's synthetic price ticks independently. Nothing here sets a balance or payout directly.</div>
      </header>

      {liveScenarios.length > 0 && (
        <div className="dz-card">
          <div className="dz-card-head"><h3><Activity size={15} className="st-ico" />Live right now ({liveScenarios.length})</h3></div>
          <div className="rf-list">
            {liveScenarios.map(({ session, symbol, scenario }) => {
              const owner = users.find((u) => u.id === session.userId)
              const Icon = symbolIcon(symbol)
              return (
                <div key={session.id + symbol} className="rf-item sc-row">
                  <span className="rf-av"><Icon size={15} /></span>
                  <span className="rf-who">
                    <strong>{symbol} <span className="dz-muted">on</span> <Link to={`/admin/users/${session.userId}`} className="ad-link" style={{ color: 'var(--accent-bright)' }}>{owner?.name || `User #${session.userId}`}</Link></strong>
                    <span className="dz-muted">{scenario.reset ? `Resetting (${formatResetTimeLeft(scenario.reset)})` : `${scenario.mode}, strength ${scenario.strength}/3`}</span>
                  </span>
                  <span className="sc-actions">
                    <button type="button" className="dz-btn-o" onClick={() => { setSelectedSessionId(session.id); setSelectedSymbol(symbol) }}>Control</button>
                    {!scenario.reset && (
                      <button type="button" className="dz-btn-o" onClick={() => resetSessionScenario(session.id, symbol, 'normal')}><RotateCcw size={12} /> Reset</button>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="dz-card">
        <div className="dz-card-head"><h3>Session to control</h3></div>
        {activeSessions.length === 0 ? (
          <div className="dz-empty">No active sessions right now.</div>
        ) : (
          <select className="pg-field" value={selectedSession?.id || ''} onChange={(e) => setSelectedSessionId(Number(e.target.value))} aria-label="Session to control">
            {activeSessions.map((s) => {
              const owner = users.find((u) => u.id === s.userId)
              const tier = getTier(s.tierId)
              const n = scenarioCountFor(s.id)
              return (
                <option key={s.id} value={s.id}>
                  {owner?.name || `User #${s.userId}`} — {tier?.name || s.tierId} — {formatMoney(s.amount)}{n > 0 ? ` — ${n} scenario${n === 1 ? '' : 's'} active` : ' — normal'}
                </option>
              )
            })}
          </select>
        )}
      </div>

      {selectedSession && (
        <>
          <div className="sc-pairs" role="tablist" aria-label="Trading pair">
            {symbols.map((symbol) => {
              const Icon = symbolIcon(symbol)
              const hasScenario = !!sessionScenarios[selectedSession.id]?.[symbol]
              return (
                <button key={symbol} type="button" role="tab" aria-selected={symbol === selectedSymbol} className={'sc-pair' + (symbol === selectedSymbol ? ' on' : '')} onClick={() => setSelectedSymbol(symbol)}>
                  <Icon size={14} /> {symbol}{hasScenario && <i className="sc-dot" />}
                </button>
              )
            })}
          </div>

          <div className="ad-kpis ad-kpis-3">
            <div className="ad-kpi">
              <span className="ad-kpi-ico"><Zap size={18} /></span>
              <span className="ad-kpi-label">{selectedSymbol} state on this session</span>
              <b className="ad-kpi-value sc-small">{stateLabel}</b>
              {selectedSymbolScenario?.reset && <span className="dz-muted">{formatResetTimeLeft(selectedSymbolScenario.reset)}</span>}
            </div>
            <div className="ad-kpi">
              <span className="ad-kpi-ico"><TrendingUp size={18} /></span>
              <span className="ad-kpi-label">{selectedSymbol} price on this session</span>
              <b className="ad-kpi-value sc-small">{formatMoney(selectedSymbolScenario?.price ?? prices[selectedSymbol])}</b>
              {selectedSymbolScenario && <span className="dz-muted">Real market: {formatMoney(prices[selectedSymbol])}</span>}
            </div>
            <div className="ad-kpi">
              <span className="ad-kpi-ico"><Clock size={18} /></span>
              <span className="ad-kpi-label">Time left on session</span>
              <b className="ad-kpi-value sc-small">{formatTimeLeft(selectedSession.expiresAt)}</b>
            </div>
          </div>

          <div className="dz-grid">
            <div className="dz-main">
              <div className="dz-card">
                <div className="dz-card-head"><h3>Custom scenario · {selectedSymbol}</h3></div>
                <div className="sc-fields">
                  <div><span className="pg-label">Direction</span><ToggleGroup options={MODES} value={draft.mode} onChange={(v) => updateDraft({ mode: v })} getValue={(o) => o.id} /></div>
                  <div><span className="pg-label">Strength</span><ToggleGroup options={STRENGTHS} value={draft.strength} onChange={(v) => updateDraft({ strength: v })} /></div>
                  <div><span className="pg-label">Volatility</span><ToggleGroup options={VOLATILITIES} value={draft.volatility} onChange={(v) => updateDraft({ volatility: v })} /></div>
                  <div><span className="pg-label">Speed</span><ToggleGroup options={SPEEDS} value={draft.speed} onChange={(v) => updateDraft({ speed: v })} /></div>
                </div>
                <button type="button" className="btn-primary pg-start-btn" onClick={handleApply}>Apply to {selectedSymbol} on this session</button>
              </div>
            </div>

            <aside className="dz-side">
              <div className="dz-card">
                <div className="dz-card-head"><h3>Quick presets</h3></div>
                <div className="sc-presets">
                  {PRESETS.map((preset) => (
                    <button key={preset.label} type="button" className="dz-btn-o" onClick={() => handlePreset(preset)}>{preset.label}</button>
                  ))}
                </div>
                <p className="dz-muted st-hint">A preset applies immediately to {selectedSymbol} on this session.</p>
              </div>

              <div className="dz-card">
                <div className="dz-card-head"><h3>Reset</h3></div>
                <p className="dz-muted st-hint" style={{ marginTop: 0 }}>Gradually moves {selectedSymbol}'s price on this session back to the real market. Other symbols and sessions are untouched.</p>
                <div className="sc-presets">
                  {RESET_LEVELS.map((level) => (
                    <button key={level.id} type="button" disabled={!selectedSymbolScenario} className="dz-btn-o sc-reset" onClick={() => handleReset(level.id)}>
                      {level.label}<small>{level.hint}</small>
                    </button>
                  ))}
                </div>
                {scenarioCountFor(selectedSession.id) > 1 && (
                  <button type="button" className="dz-btn-o" style={{ marginTop: 10 }} onClick={() => resetAllSessionScenarios(selectedSession.id, 'normal')}>
                    Reset all {scenarioCountFor(selectedSession.id)} symbols on this session
                  </button>
                )}
              </div>
            </aside>
          </div>
        </>
      )}

      <div className="dz-card">
        <div className="dz-card-head">
          <h3>All active sessions ({activeSessions.length})</h3>
          {activeSessions.length > 0 && (
            <span className="sc-actions">
              {showBulkInput && <input className="pg-field sc-hrs" type="number" value={bulkHours} onChange={(e) => setBulkHours(e.target.value)} placeholder="Hours" autoFocus />}
              <button type="button" className="dz-btn-o" onClick={() => (showBulkInput ? handleBulkFastForward() : setShowBulkInput(true))}>
                <FastForward size={13} /> {showBulkInput ? 'Confirm' : 'Fast-forward all'}
              </button>
            </span>
          )}
        </div>
        {activeSessions.length === 0 ? (
          <div className="dz-empty">No active sessions right now.</div>
        ) : (
          <div className="rf-list">
            {activeSessions.map((s) => {
              const owner = users.find((u) => u.id === s.userId)
              const tier = getTier(s.tierId)
              const entries = Object.entries(sessionScenarios[s.id] || {})
              return (
                <div key={s.id} className={'rf-item sc-row' + (s.id === selectedSession?.id ? ' sc-selected' : '')}>
                  <span className="rf-av"><Activity size={15} /></span>
                  <span className="rf-who">
                    <strong><Link to={`/admin/users/${s.userId}`} className="ad-link">{owner?.name || `User #${s.userId}`}</Link> · {tier?.name || s.tierId} · {formatMoney(s.amount)}</strong>
                    <span className="dz-muted">{formatTimeLeft(s.expiresAt)}</span>
                    <span className="cl-tags">
                      {entries.length === 0 ? <span className="dz-chip">Normal</span> : entries.map(([symbol, scenario]) => (
                        <span key={symbol} className="dz-chip cl-pending">{symbol} {scenario.reset ? 'resetting' : `${scenario.mode} ${scenario.strength}/3`}</span>
                      ))}
                    </span>
                  </span>
                  <span className="sc-actions">
                    {selectedSession?.id !== s.id && <button type="button" className="dz-btn-o" onClick={() => setSelectedSessionId(s.id)}>Control</button>}
                    <input className="pg-field sc-hrs" type="number" value={fastForwardHours[s.id] || ''} onChange={(e) => setFastForwardHours((prev) => ({ ...prev, [s.id]: e.target.value }))} placeholder="Hrs" aria-label="Hours to fast-forward" />
                    <button type="button" className="dz-btn-o" onClick={() => handleFastForward(s.id)}>FF</button>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
