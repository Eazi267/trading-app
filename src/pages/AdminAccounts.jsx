import { useCallback, useEffect, useState } from 'react'
import { UserPlus, ShieldCheck, Search } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import ToggleSwitch from '../components/ToggleSwitch.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { apiRequest } from '../api/client.js'
import { ADMIN_TIER_LIST } from '../config/adminTiers.js'

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

import AdminSecurityControls from '../components/AdminSecurityControls.jsx'

export default function AdminAccounts() {
  const { currentUser, createAdmin, updateAdminTier, setAdminActive } = useAuth()
  const [admins, setAdmins] = useState([])
  const [listError, setListError] = useState('')
  // Staff accounts come from their own endpoint (the shared users list
  // is clients only), and are re-fetched after every change below.
  const loadAdmins = useCallback(async () => {
    const result = await apiRequest('/api/admin/admins')
    if (result.error) return setListError(result.error)
    setListError('')
    setAdmins(result.users)
  }, [])
  useEffect(() => { loadAdmins() }, [loadAdmins])
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminTier, setAdminTier] = useState('support_admin')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  const q = search.trim().toLowerCase()
  const filtered = q ? admins.filter((a) => a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q)) : admins

  async function handleCreate() {
    setError('')
    const result = await createAdmin({ name: name.trim(), email: email.trim(), password, adminTier })
    if (result.error) return setError(result.error)
    await loadAdmins()
    setCreated(true)
    setName('')
    setEmail('')
    setPassword('')
    setAdminTier('support_admin')
    setTimeout(() => setCreated(false), 2500)
  }

  return (
    <Layout pageTitle="Admin Accounts">
      <header className="dz-head">
        <h1 className="dz-title">Admin Accounts</h1>
        <div className="dz-muted">Create staff accounts and control what each one can access. Every admin tier's exact permissions are listed beside the form, so none of this is guesswork once an account exists.</div>
      </header>

      <AdminSecurityControls />

      <div className="dz-grid">
        <div className="dz-main">
          <div className="dz-card">
            <div className="cl-tools">
              <h3 style={{ margin: 0, flex: '1 1 auto' }}>All admin accounts ({admins.length})</h3>
              <label className="cl-search" style={{ flex: '0 1 240px' }}>
                <Search size={15} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search admins…" />
              </label>
            </div>
            {listError && <div className="form-error" style={{ marginBottom: 12 }}>{listError}</div>}
            {filtered.length === 0 ? (
              <div className="dz-empty">{admins.length === 0 ? 'No admin accounts yet.' : 'No admins match this search.'}</div>
            ) : (
              <div className="rf-list">
                {filtered.map((a) => {
                  const isSelf = a.id === currentUser.id
                  const isActive = !a.deactivatedAt
                  return (
                    <div key={a.id} className={'rf-item sc-row' + (isActive ? '' : ' aa-off')}>
                      <span className="rf-av">{initials(a.name)}</span>
                      <span className="rf-who">
                        <strong>{a.name}{isSelf && <span className="dz-muted"> (you)</span>}</strong>
                        <span className="dz-muted">{a.email}</span>
                      </span>
                      <span className="sc-actions">
                        <select className="pg-field aa-tier" value={a.adminTier || 'super_admin'} onChange={async (e) => { await updateAdminTier(a.id, e.target.value); loadAdmins() }} disabled={isSelf} aria-label={`Tier for ${a.name}`}>
                          {ADMIN_TIER_LIST.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                        <span className="aa-active">
                          <span style={{ fontSize: 12, color: isActive ? 'var(--text-muted)' : 'var(--danger)' }}>{isActive ? 'Active' : 'Deactivated'}</span>
                          <ToggleSwitch checked={isActive} onChange={async (val) => { await setAdminActive(a.id, val); loadAdmins() }} disabled={isSelf} />
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="dz-side">
          <div className="dz-card">
            <div className="dz-card-head"><h3><UserPlus size={15} className="st-ico" />New admin account</h3></div>
            {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
            {created && <div className="st-ok" style={{ marginBottom: 12 }}>Admin account created.</div>}
            <div className="st-form sc-form1">
              <label className="st-f st-wide"><span className="pg-label">Full name</span>
                <input className="pg-field" type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="st-f st-wide"><span className="pg-label">Email</span>
                <input className="pg-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label className="st-f st-wide"><span className="pg-label">Temporary password</span>
                <input className="pg-field" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
              <label className="st-f st-wide"><span className="pg-label">Admin tier</span>
                <select className="pg-field" value={adminTier} onChange={(e) => setAdminTier(e.target.value)}>
                  {ADMIN_TIER_LIST.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select></label>
            </div>
            <button type="button" className="btn-primary pg-start-btn" onClick={handleCreate}><UserPlus size={15} /> Create admin account</button>
          </div>

          <div className="dz-card">
            <div className="dz-card-head"><h3><ShieldCheck size={15} className="st-ico" />What each tier can do</h3></div>
            <div className="rf-list">
              {ADMIN_TIER_LIST.map((t) => (
                <div key={t.id} className="rf-item">
                  <span className="rf-who"><strong>{t.label}</strong><span className="dz-muted">{t.description}</span></span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  )
}
