import { useCallback, useEffect, useState } from 'react'
import { Users, Sparkles, Trash2, FlaskConical } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { apiRequest } from '../api/client.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function AdminGenerateClients() {
  const { generateDemoClients, removeDemoClients } = useAuth()
  const { generateDemoActivity, purgeDataForUsers } = useApp()
  const { settings } = useSettings()

  const [count, setCount] = useState(10)
  const [minDeposit, setMinDeposit] = useState(300)
  const [maxDeposit, setMaxDeposit] = useState(8000)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [clearedCount, setClearedCount] = useState(null)
  // The shared client list hides generated demo accounts on purpose, so
  // this page asks the server for its own count.
  const [existingDemoCount, setExistingDemoCount] = useState(0)
  const loadDemoCount = useCallback(async () => {
    const res = await apiRequest('/api/admin/users?includeDemo=1')
    if (res.users) setExistingDemoCount(res.users.filter((u) => u.isDemoGenerated).length)
  }, [])
  useEffect(() => { loadDemoCount() }, [loadDemoCount])

  if (!settings.demoModeEnabled) {
    return (
      <Layout pageTitle="Generate Demo Clients">
        <div className="empty-state">
          <p>Demo mode is turned off for this deployment. Turn it on in Business Settings to use this tool.</p>
        </div>
      </Layout>
    )
  }

  async function handleGenerate() {
    setError('')
    setResult(null)
    setClearedCount(null)
    const { users: newUsers, error: genError } = await generateDemoClients(parseInt(count, 10))
    if (genError) {
      setError(genError)
      return
    }
    // generateDemoActivity still writes fake transactions/sessions
    // into AppContext's own local arrays — AppContext isn't wired to
    // the real backend yet (that's the next wiring batch), so demo
    // activity for these now-real accounts is local-only for now,
    // same as it's always been. Nothing broken by this batch, just
    // not yet consistent with the real user records it's attached to.
    const stats = generateDemoActivity(
      newUsers.map((u) => u.id),
      { minDeposit: parseFloat(minDeposit), maxDeposit: parseFloat(maxDeposit) }
    )
    // generateDemoActivity currently refuses (sessions and transactions
    // come from the real backend now), so the accounts are created but
    // start empty. Say so plainly rather than crash on missing totals.
    if (stats?.error) {
      setResult({ usersGenerated: newUsers.length, emptyAccounts: true })
      loadDemoCount()
      return
    }
    setResult(stats)
    loadDemoCount()
  }

  async function handleClear() {
    const { removedIds } = await removeDemoClients()
    purgeDataForUsers(removedIds)
    setClearedCount(removedIds.length)
    setResult(null)
    loadDemoCount()
  }

  return (
    <Layout pageTitle="Generate Demo Clients">
      <header className="dz-head">
        <h1 className="dz-title">Generate Demo Clients</h1>
        <div className="dz-muted">Populate the platform with client accounts, deposits and trading sessions for a presentation. Every number still comes from the same calculation the rest of the app uses, not a typed-in balance.</div>
      </header>

      <div className="dz-card rf-campaign eo-note">
        <div className="icon-badge"><FlaskConical size={17} /></div>
        <div>
          <strong>Demo data only</strong>
          <p className="dz-muted" style={{ margin: '2px 0 0' }}>Generated clients are marked as demo accounts, are never included in broadcasts, and can be removed in one click. Real clients are never touched.</p>
        </div>
      </div>

      <div className="dz-grid">
        <div className="dz-main">
          <div className="dz-card">
            <div className="dz-card-head"><h3><Sparkles size={15} className="st-ico" />Generate clients</h3></div>
            {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="st-form gc-form">
              <label className="st-f">
                <span className="pg-label">Number of clients</span>
                <input className="pg-field" type="number" min="1" max="200" value={count} onChange={(e) => setCount(e.target.value)} />
              </label>
              <label className="st-f">
                <span className="pg-label">Min deposit (USD)</span>
                <input className="pg-field" type="number" value={minDeposit} onChange={(e) => setMinDeposit(e.target.value)} />
              </label>
              <label className="st-f">
                <span className="pg-label">Max deposit (USD)</span>
                <input className="pg-field" type="number" value={maxDeposit} onChange={(e) => setMaxDeposit(e.target.value)} />
              </label>
            </div>
            <button type="button" className="btn-primary pg-start-btn" onClick={handleGenerate}><Sparkles size={14} /> Generate</button>
            {result && (
              <div className="gc-result">
                {result.emptyAccounts ? (
                  <>Created {result.usersGenerated} demo client{result.usersGenerated === 1 ? '' : 's'}. They start with no deposits or sessions: demo activity can't be generated anymore because transactions and sessions now come from the real backend.</>
                ) : (
                  <>Created {result.usersGenerated} clients, {formatMoney(result.totalDeposited)} in deposits,{' '}
                  {result.sessionsCreated} sessions ({result.sessionsClosed} settled, {result.sessionsCreated - result.sessionsClosed} still active).</>
                )}
              </div>
            )}
            <p className="dz-muted st-hint">Each generated account is a real demo client record. Demo deposits and sessions are no longer generated automatically, so these accounts start empty; add activity to them from the Clients page if you need it for a presentation.</p>
          </div>
        </div>

        <aside className="dz-side">
          <div className="dz-card">
            <div className="dz-card-head"><h3><Users size={15} className="st-ico" />Generated clients ({existingDemoCount})</h3></div>
            {clearedCount !== null && <p className="dz-muted" style={{ marginTop: 0 }}>Removed {clearedCount} generated clients and their data.</p>}
            {existingDemoCount === 0 ? (
              <div className="dz-empty">No generated clients right now.</div>
            ) : (
              <button type="button" className="dz-btn-o" onClick={handleClear}><Trash2 size={14} /> Remove all generated clients</button>
            )}
            <p className="dz-muted st-hint">Only removes accounts created by this tool. Real clients are never affected.</p>
          </div>
        </aside>
      </div>
    </Layout>
  )
}
