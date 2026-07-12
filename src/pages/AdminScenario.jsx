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

function formatResetTimeLeft(reset) {
  if (!reset) return null
  const elapsed = Date.now() - new Date(reset.startedAt).getTime()
  const remainingMs = Math.max(0, reset.durationMs - elapsed)
  const seconds = Math.ceil(remainingMs / 1000)
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}m left`
  return `${seconds}s left`
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
    sessions, sessionScenarios, applySessionScenario, resetSessionScenario,
    fastForwardSession, fastForwardAllSessions, sessionCurrentValue, getEffectivePricesForSession
  } = useApp()
  const { users } = useAuth()

  const activeSessions = sessions.filter((s) => s.status === 'active')
  const [selectedSessionId, setSelectedSessionId] = useState(activeSessions[0]?.id || null)
  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId) || activeSessions[0] || null
  const selectedScenario = selectedSession ? sessionScenarios[selectedSession.id] : null

  const [draft, setDraft] = useState({ mode: 'neutral', strength: 1, volatility: 1, speed: 1 })
  const [fastForwardHours, setFastForwardHours] = useState({})
  const [bulkHours, setBulkHours] = useState('')

  function updateDraft(overrides) {
    setDraft((prev) => ({ ...prev, ...overrides }))
  }

  function handleApply() {
    if (!selectedSession) return
    applySessionScenario(selectedSession.id, draft.mode, draft.strength, draft.volatility, draft.speed)
  }

  function handlePreset(preset) {
    setDraft({ mode: preset.mode, strength: preset.strength, volatility: preset.volatility, speed: preset.speed })
    if (selectedSession) applySessionScenario(selectedSession.id, preset.mode, preset.strength, preset.volatility, preset.speed)
  }

  function handleReset(level) {
    if (!selectedSession) return
    resetSessionScenario(selectedSession.id, level)
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
        Applies to ONE session at a time — every other session, including other
        sessions belonging to the same client, keeps reading the real, unbiased
        market. Nothing here sets a balance or payout directly.
      </p>

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
                const hasScenario = !!sessionScenarios[s.id]
                return (
                  <option key={s.id} value={s.id}>
                    {owner?.name || `User #${s.userId}`} — {tier?.name || s.tierId} — {formatMoney(s.amount)}
                    {hasScenario ? ' — scenario active' : ' — normal'}
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
            <div className="panel-head"><h3>Status — this session only</h3></div>
            <div className="stats-grid" style={{ padding: '16px 20px' }}>
              <div className="stat-card">
                <div className="stat-label">Current state</div>
                <div className="stat-value" style={{ fontSize: 16 }}>
                  {!selectedScenario
                    ? 'Normal market'
                    : selectedScenario.reset
                    ? `Resetting (${selectedScenario.reset.level})`
                    : `${selectedScenario.mode}, ${selectedScenario.strength}/3`}
                </div>
                {selectedScenario?.reset && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {formatResetTimeLeft(selectedScenario.reset)}
                  </div>
                )}
              </div>
              <div className="stat-card">
                <div className="stat-label">Live session value</div>
                <div className="stat-value">{formatMoney(sessionCurrentValue(selectedSession))}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Time left on session</div>
                <div className="stat-value">{formatTimeLeft(selectedSession.expiresAt)}</div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head"><h3>Quick presets — this session</h3></div>
            <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESETS.map((preset) => (
                <button key={preset.label} className="tx-btn deposit" style={{ padding: '10px 16px', fontSize: 13 }} onClick={() => handlePreset(preset)}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head"><h3>Custom scenario — this session</h3></div>
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
                  Apply to this session
                </button>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head"><h3>Reset — return this session to normal</h3></div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0, marginBottom: 12 }}>
                Gradually interpolates this session's price back to the real market —
                pick how fast. Doesn't apply to any other session.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {RESET_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    disabled={!selectedScenario}
                    className="tx-btn withdraw"
                    style={{ padding: '10px 16px', fontSize: 13, opacity: selectedScenario ? 1 : 0.5, cursor: selectedScenario ? 'pointer' : 'not-allowed' }}
                    onClick={() => handleReset(level.id)}
                  >
                    {level.label}
                    <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>{level.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>All active sessions — at a glance</h3></div>
        {activeSessions.length === 0 ? (
          <div className="empty-state"><p>No active sessions right now.</p></div>
        ) : (
          <table>
            <thead><tr><th>Client</th><th>Tier</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {activeSessions.map((s) => {
                const owner = users.find((u) => u.id === s.userId)
                const tier = getTier(s.tierId)
                const scenario = sessionScenarios[s.id]
                return (
                  <tr key={s.id}>
                    <td>{owner?.name || `User #${s.userId}`}</td>
                    <td>{tier?.name || s.tierId}</td>
                    <td>{formatMoney(s.amount)}</td>
                    <td>
                      {!scenario ? (
                        <span className="status-pill status-approved">Normal</span>
                      ) : scenario.reset ? (
                        <span className="status-pill status-pending">Resetting ({formatResetTimeLeft(scenario.reset)})</span>
                      ) : (
                        <span className="status-pill status-pending">{scenario.mode}, {scenario.strength}/3</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
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
            <thead><tr><th>Client</th><th>Tier</th><th>Time left</th><th>Fast-forward by</th></tr></thead>
            <tbody>
              {activeSessions.map((s) => {
                const owner = users.find((u) => u.id === s.userId)
                const tier = getTier(s.tierId)
                return (
                  <tr key={s.id}>
                    <td>{owner?.name || `User #${s.userId}`}</td>
                    <td>{tier?.name || s.tierId}</td>
                    <td>{formatTimeLeft(s.expiresAt)}</td>
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
      </div>
    </Layout>
  )
}
