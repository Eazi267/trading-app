import { useState } from 'react'
import { UserPlus, ShieldCheck, Search } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import ToggleSwitch from '../components/ToggleSwitch.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ADMIN_TIER_LIST } from '../config/adminTiers.js'

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function AdminAccounts() {
  const { currentUser, users, createAdmin, updateAdminTier, setAdminActive } = useAuth()
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminTier, setAdminTier] = useState('support_admin')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  const admins = users.filter((u) => u.role === 'admin')
  const q = search.trim().toLowerCase()
  const filtered = q ? admins.filter((a) => a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q)) : admins

  async function handleCreate() {
    setError('')
    const result = await createAdmin({ name: name.trim(), email: email.trim(), password, adminTier })
    if (result.error) return setError(result.error)
    setCreated(true)
    setName('')
    setEmail('')
    setPassword('')
    setAdminTier('support_admin')
    setTimeout(() => setCreated(false), 2500)
  }

  return (
    <Layout pageTitle="Admin Accounts">
      <h1 className="page-title">Admin Accounts</h1>
      <p className="page-sub">
        Create staff accounts and control what each one can access. Every admin tier's exact permissions are
        listed below the form — none of this is guesswork once an account exists.
      </p>

      <div className="glass-card fade-in-up-1" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3><UserPlus size={15} style={{ verticalAlign: -2, marginRight: 6 }} />New admin account</h3>
        </div>
        <div className="responsive-grid-2" style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Full name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Temporary password</label>
            <input
              type="text" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Admin tier</label>
            <select
              value={adminTier} onChange={(e) => setAdminTier(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            >
              {ADMIN_TIER_LIST.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          {error && <div className="form-error" style={{ gridColumn: '1 / -1', margin: 0 }}>{error}</div>}
          {created && <div style={{ gridColumn: '1 / -1', fontSize: 13, color: 'var(--success)' }}>Admin account created.</div>}
          <button className="tx-btn deposit" style={{ gridColumn: '1 / -1', width: 'fit-content', padding: '9px 18px' }} onClick={handleCreate}>
            <UserPlus size={15} /> Create admin account
          </button>
        </div>
      </div>

      <div className="glass-card fade-in-up-2" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3><ShieldCheck size={15} style={{ verticalAlign: -2, marginRight: 6 }} />What each tier can do</h3>
        </div>
        <div style={{ padding: 16 }} className="stagger-in">
          {ADMIN_TIER_LIST.map((t) => (
            <div key={t.id} className="entity-card" style={{ alignItems: 'flex-start' }}>
              <div className="entity-card-body">
                <div className="entity-card-title">{t.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{t.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>All admin accounts ({admins.length})</h3>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search admins..."
              style={{ padding: '7px 10px 7px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state"><p>{admins.length === 0 ? 'No admin accounts yet.' : 'No admins match this search.'}</p></div>
        ) : (
          <div style={{ padding: 16 }} className="stagger-in">
            {filtered.map((a) => {
              const isSelf = a.id === currentUser.id
              const isActive = a.active !== false
              return (
                <div key={a.id} className="entity-card">
                  <div className="icon-badge" style={{ fontSize: 13, fontWeight: 700 }}>{initials(a.name)}</div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">
                      {a.name}{isSelf && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}> (you)</span>}
                    </div>
                    <div className="entity-card-meta"><span>{a.email}</span></div>
                  </div>
                  <select
                    value={a.adminTier || 'super_admin'}
                    onChange={(e) => updateAdminTier(a.id, e.target.value)}
                    disabled={isSelf}
                    style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, flex: 'none' }}
                  >
                    {ADMIN_TIER_LIST.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                    <span style={{ fontSize: 11, color: isActive ? 'var(--text-muted)' : 'var(--danger)' }}>
                      {isActive ? 'Active' : 'Deactivated'}
                    </span>
                    <ToggleSwitch checked={isActive} onChange={(val) => setAdminActive(a.id, val)} disabled={isSelf} />
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
