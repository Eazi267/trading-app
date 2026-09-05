import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Flag, ChevronRight } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getClients, getClientCount, getFlaggedClientCount } from '../config/clients.js'
import { getClientBalances } from '../utils/adminAnalytics.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function AdminUsers() {
  const { transactions, sessions } = useApp()
  const { users } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const clients = getClients(users)
  const balances = getClientBalances(users, transactions, sessions)

  function balanceFor(userId) {
    return balances.find((b) => b.user.id === userId)?.total ?? 0
  }

  function pendingCountFor(userId) {
    return transactions.filter((t) => t.userId === userId && t.status === 'pending').length
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? clients.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.uid?.includes(q))
    : clients

  return (
    <Layout pageTitle="Clients">
      <h1 className="page-title">Clients</h1>
      <p className="page-sub">Click a client to view and manage their account, including trades.</p>

      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Total clients</div>
          <div className="stat-value">{getClientCount(users)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Flagged for review</div>
          <div className="stat-value">{getFlaggedClientCount(users)}</div>
        </div>
      </div>

      <div style={{ position: 'relative', maxWidth: 340, marginBottom: 14 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search clients by name, email, or UID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
        />
      </div>

      <div className="panel">
        <div style={{ padding: 16 }}>
          {filtered.length === 0 ? (
            <div className="empty-state"><p>No clients match your search.</p></div>
          ) : (
            filtered.map((u) => {
              const pendingCount = pendingCountFor(u.id)
              return (
                <div
                  key={u.id}
                  className={'entity-card' + (u.flaggedForReview ? ' entity-card-accent-loss' : '')}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/users/${u.id}`)}
                >
                  <div className="icon-badge" style={{ fontSize: 13, fontWeight: 700 }}>{initials(u.name)}</div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">
                      {u.name}
                      {u.flaggedForReview && <Flag size={12} style={{ color: 'var(--danger)', marginLeft: 6, verticalAlign: -1 }} />}
                    </div>
                    <div className="entity-card-meta">
                      <span>{u.email}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>UID {u.uid}</span>
                      <span style={{ textTransform: 'capitalize' }}>{u.tier || 'No tier'}</span>
                      {pendingCount > 0 && (
                        <span style={{ color: 'var(--accent-bright)' }}>{pendingCount} pending</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, flex: 'none' }}>
                    {formatMoney(balanceFor(u.id))}
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)', flex: 'none' }} />
                </div>
              )
            })
          )}
        </div>
      </div>
    </Layout>
  )
}
