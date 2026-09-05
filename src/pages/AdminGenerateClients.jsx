import { useState } from 'react'
import { Users, Sparkles, Trash2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function AdminGenerateClients() {
  const { users, generateDemoClients, removeDemoClients } = useAuth()
  const { generateDemoActivity, purgeDataForUsers } = useApp()
  const { settings } = useSettings()

  const [count, setCount] = useState(10)
  const [minDeposit, setMinDeposit] = useState(300)
  const [maxDeposit, setMaxDeposit] = useState(8000)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [clearedCount, setClearedCount] = useState(null)

  if (!settings.demoModeEnabled) {
    return (
      <Layout pageTitle="Generate Demo Clients">
        <div className="empty-state">
          <p>Demo mode is turned off for this deployment. Turn it on in Business Settings to use this tool.</p>
        </div>
      </Layout>
    )
  }

  const existingDemoCount = users.filter((u) => u.isDemoGenerated).length

  function handleGenerate() {
    setError('')
    setResult(null)
    setClearedCount(null)
    const { users: newUsers, error: genError } = generateDemoClients(parseInt(count, 10))
    if (genError) {
      setError(genError)
      return
    }
    const stats = generateDemoActivity(
      newUsers.map((u) => u.id),
      { minDeposit: parseFloat(minDeposit), maxDeposit: parseFloat(maxDeposit) }
    )
    setResult(stats)
  }

  function handleClear() {
    const removedIds = removeDemoClients()
    purgeDataForUsers(removedIds)
    setClearedCount(removedIds.length)
    setResult(null)
  }

  return (
    <Layout pageTitle="Generate Demo Clients">
      <h1 className="page-title">Generate Demo Clients</h1>
      <p className="page-sub">
        Populate the platform with real client accounts, real deposits, and real trading sessions for a
        presentation — every number here still comes from the same calculation the rest of the app uses, not a
        typed-in balance.
      </p>

      <div className="panel" style={{ marginBottom: 16, maxWidth: 560 }}>
        <div className="panel-head"><h3><Sparkles size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Generate clients</h3></div>
        {error && <div className="form-error" style={{ margin: '16px 20px 0' }}>{error}</div>}
        <div style={{ padding: '16px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            Number of clients
            <input
              type="number"
              min="1"
              max="200"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              style={{ width: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            Min deposit (USD)
            <input
              type="number"
              value={minDeposit}
              onChange={(e) => setMinDeposit(e.target.value)}
              style={{ width: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            Max deposit (USD)
            <input
              type="number"
              value={maxDeposit}
              onChange={(e) => setMaxDeposit(e.target.value)}
              style={{ width: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </label>
        </div>
        <div style={{ padding: '0 20px 16px' }}>
          <button className="tx-btn deposit" style={{ padding: '9px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={handleGenerate}>
            <Sparkles size={14} /> Generate
          </button>
        </div>
        {result && (
          <div style={{ margin: '0 20px 16px', padding: 12, borderRadius: 8, background: 'var(--success-bg)', color: 'var(--success)', fontSize: 13 }}>
            Created {result.usersGenerated} clients, {formatMoney(result.totalDeposited)} in deposits,{' '}
            {result.sessionsCreated} sessions ({result.sessionsClosed} settled, {result.sessionsCreated - result.sessionsClosed} still active).
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 16px' }}>
          Each account gets a real deposit and 1–3 real trading sessions, some settled through the actual
          settlement engine, some left active — a mix, not a uniform pattern.
        </p>
      </div>

      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="panel-head"><h3><Users size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Generated clients ({existingDemoCount})</h3></div>
        {clearedCount !== null && (
          <div style={{ margin: '16px 20px 0', fontSize: 13, color: 'var(--text-muted)' }}>Removed {clearedCount} generated clients and their data.</div>
        )}
        <div style={{ padding: '16px 20px' }}>
          {existingDemoCount === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No generated clients right now.</p>
          ) : (
            <button
              className="tx-btn withdraw"
              style={{ padding: '9px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={handleClear}
            >
              <Trash2 size={14} /> Remove all generated clients
            </button>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 16px' }}>
          Only removes accounts created by this tool — real clients are never affected.
        </p>
      </div>
    </Layout>
  )
}
