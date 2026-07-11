import { useState } from 'react'
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

const MODES = [
  { id: 'bearish', label: 'Bearish', hint: 'Tilts the walk downward' },
  { id: 'neutral', label: 'Neutral', hint: 'Pure random noise (default)' },
  { id: 'bullish', label: 'Bullish', hint: 'Tilts the walk upward' }
]

const STRENGTHS = [
  { value: 1, label: 'Mild' },
  { value: 2, label: 'Moderate' },
  { value: 3, label: 'Strong' }
]

const VOLATILITIES = [
  { value: 1, label: 'Calm' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'Choppy' }
]

const SPEEDS = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' }
]

// One-click combinations for quickly setting up a showcase, instead
// of clicking mode/strength/volatility/speed one at a time. Still
// just calls setMarketScenario under the hood — no new mechanism.
const PRESETS = [
  { label: 'Calm market', mode: 'neutral', strength: 1, volatility: 1, speed: 1 },
  { label: 'Trending bull run', mode: 'bullish', strength: 3, volatility: 2, speed: 3 },
  { label: 'Sharp sell-off', mode: 'bearish', strength: 3, volatility: 2, speed: 3 },
  { label: 'Chaotic swings', mode: 'neutral', strength: 1, volatility: 3, speed: 5 }
]

export default function AdminScenario() {
  const { prices, sessions, marketBias, setMarketScenario, fastForwardSession, fastForwardAllSessions, sessionCurrentValue } = useApp()
  const { users } = useAuth()

  const [fastForwardHours, setFastForwardHours] = useState({})
  const [bulkHours, setBulkHours] = useState('')

  const activeSessions = sessions.filter((s) => s.status === 'active')

  function applyScenario(overrides) {
    const next = { ...marketBias, ...overrides }
    setMarketScenario(next.mode, next.strength, next.volatility, next.speed)
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
  }

  return (
    <Layout pageTitle="Scenario Control">
      <h1 className="page-title">Scenario Control</h1>
      <p className="page-sub">
        Demo-only tools for showcasing sessions at an accelerated pace. Nothing here
        sets a balance or a payout directly — everything still runs through the real
        price feed and the same settlement math clients see.
      </p>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Quick presets</h3></div>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              className="tx-btn deposit"
              style={{ padding: '10px 16px', fontSize: 13 }}
              onClick={() => applyScenario(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 16px' }}>
          Each preset just sets mode/strength/volatility/speed in one click — the same
          four controls below, nothing more.
        </p>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Market bias</h3></div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
            Tilts the random walk that already drives every price. It's still random —
            this just weights it, the way a real trending market would. Set back to
            Neutral and the feed is exactly what it was before.
          </p>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Direction</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => applyScenario({ mode: m.id })}
                  className="tx-btn"
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    background: marketBias.mode === m.id ? 'var(--accent)' : 'var(--bg)',
                    color: marketBias.mode === m.id ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {m.label}
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>{m.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {marketBias.mode !== 'neutral' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Strength — how hard it leans</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {STRENGTHS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => applyScenario({ strength: s.value })}
                    className="tx-btn"
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      background: marketBias.strength === s.value ? 'var(--accent)' : 'var(--bg)',
                      color: marketBias.strength === s.value ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Volatility — size of each swing</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {VOLATILITIES.map((v) => (
                <button
                  key={v.value}
                  onClick={() => applyScenario({ volatility: v.value })}
                  className="tx-btn"
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    background: marketBias.volatility === v.value ? 'var(--accent)' : 'var(--bg)',
                    color: marketBias.volatility === v.value ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              Speed — how many price steps compound into each tick (higher = visibly faster market)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {SPEEDS.map((sp) => (
                <button
                  key={sp.value}
                  onClick={() => applyScenario({ speed: sp.value })}
                  className="tx-btn"
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    background: marketBias.speed === sp.value ? 'var(--accent)' : 'var(--bg)',
                    color: marketBias.speed === sp.value ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {sp.label}
                </button>
              ))}
            </div>
          </div>

          <div className="stats-grid" style={{ marginTop: 16 }}>
            {Object.entries(prices).map(([symbol, price]) => (
              <div className="stat-card" key={symbol}>
                <div className="stat-label">{symbol}</div>
                <div className="stat-value">{formatMoney(price)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Fast-forward all active sessions</h3></div>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            value={bulkHours}
            onChange={(e) => setBulkHours(e.target.value)}
            placeholder="Hours"
            style={{ width: 100, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <button className="tx-btn withdraw" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleBulkFastForward}>
            Apply to all {activeSessions.length} active session{activeSessions.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Fast-forward one session</h3></div>
        {activeSessions.length === 0 ? (
          <div className="empty-state"><p>No active sessions to fast-forward right now.</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>Client</th><th>Tier</th><th>Amount</th><th>Time left</th><th>Live value</th><th>Fast-forward by</th></tr>
            </thead>
            <tbody>
              {activeSessions.map((s) => {
                const owner = users.find((u) => u.id === s.userId)
                const tier = getTier(s.tierId)
                return (
                  <tr key={s.id}>
                    <td>{owner?.name || `User #${s.userId}`}</td>
                    <td>{tier?.name || s.tierId}</td>
                    <td>{formatMoney(s.amount)}</td>
                    <td>{formatTimeLeft(s.expiresAt)}</td>
                    <td>{formatMoney(sessionCurrentValue(s))}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          value={fastForwardHours[s.id] || ''}
                          onChange={(e) => setFastForwardHours((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          placeholder="Hours"
                          style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
                        />
                        <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleFastForward(s.id)}>
                          Apply
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 16px' }}>
          Pulling a session's countdown forward doesn't change its result — it only
          moves the deadline. If that pushes it into the past, the session settles
          automatically on the next price tick, off whatever the real (possibly
          biased) price feed did.
        </p>
      </div>
    </Layout>
  )
}
