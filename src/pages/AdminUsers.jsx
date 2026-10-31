import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Flag, ChevronRight, Users, ArrowUpDown } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getClients, getClientCount, getFlaggedClientCount } from '../config/clients.js'
import { getClientBalances } from '../utils/adminAnalytics.js'
import { getTier } from '../config/tiers.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'pending', label: 'Has pending' }
]

export default function AdminUsers() {
  const { transactions, sessions } = useApp()
  const { users } = useAuth()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('balance')

  const clients = getClients(users)
  const balances = getClientBalances(users, transactions, sessions)
  const balanceFor = (id) => balances.find((b) => b.user.id === id)?.total ?? 0
  const pendingFor = (id) => transactions.filter((t) => t.userId === id && t.status === 'pending').length
  const totalPending = clients.reduce((n, u) => n + pendingFor(u.id), 0)
  const totalBalance = clients.reduce((n, u) => n + balanceFor(u.id), 0)

  const q = search.trim().toLowerCase()
  const rows = clients
    .filter((u) => !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.uid?.includes(q))
    .filter((u) => filter === 'all' || (filter === 'flagged' && u.flaggedForReview) || (filter === 'pending' && pendingFor(u.id) > 0))
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      return balanceFor(b.id) - balanceFor(a.id)
    })

  return (
    <Layout pageTitle="Clients">
      <header className="dz-head">
        <h1 className="dz-title">Clients</h1>
        <div className="dz-muted">Open a client to view and manage their account, including trades. Every change is audit-logged.</div>
      </header>

      <div className="ad-kpis ad-kpis-3">
        <div className="ad-kpi"><span className="ad-kpi-ico"><Users size={18} /></span><span className="ad-kpi-label">Total clients</span><b className="ad-kpi-value">{getClientCount(users)}</b></div>
        <div className={'ad-kpi' + (getFlaggedClientCount(users) > 0 ? ' alert' : '')}><span className="ad-kpi-ico"><Flag size={18} /></span><span className="ad-kpi-label">Flagged for review</span><b className="ad-kpi-value">{getFlaggedClientCount(users)}</b></div>
        <div className="ad-kpi"><span className="ad-kpi-ico"><Users size={18} /></span><span className="ad-kpi-label">Combined balance · {totalPending} pending</span><b className="ad-kpi-value">{formatMoney(totalBalance)}</b></div>
      </div>

      <div className="dz-card">
        <div className="cl-tools">
          <label className="cl-search">
            <Search size={15} />
            <input type="text" placeholder="Search by name, email or UID…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="cl-sort">
            <ArrowUpDown size={14} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort clients">
              <option value="balance">Highest balance</option>
              <option value="name">Name A–Z</option>
              <option value="newest">Newest first</option>
            </select>
          </label>
          <div className="dz-ranges" role="tablist" aria-label="Filter">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={'dz-range' + (filter === f.id ? ' on' : '')} onClick={() => setFilter(f.id)}>{f.label}</button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="dz-empty">No clients match.</div>
        ) : (
          <div className="rf-list">
            {rows.map((u) => {
              const pending = pendingFor(u.id)
              return (
                <Link key={u.id} to={`/admin/users/${u.id}`} className={'rf-item ad-link cl-row' + (u.flaggedForReview ? ' flagged' : '')}>
                  <span className="rf-av">{initials(u.name)}</span>
                  <span className="rf-who">
                    <strong>{u.name}{u.flaggedForReview && <Flag size={12} className="cl-flag" />}</strong>
                    <span className="dz-muted cl-meta">{u.email} · UID {u.uid}</span>
                    <span className="cl-tags">
                      <span className="dz-chip">{getTier(u.tier)?.name || 'No tier'}</span>
                      {u.isDemoGenerated && <span className="dz-chip cl-pending" title="Generated demo account">Demo</span>}
                      {pending > 0 && <span className="dz-chip cl-pending">{pending} pending</span>}
                    </span>
                  </span>
                  <span className="mono cl-bal">{formatMoney(balanceFor(u.id))}</span>
                  <ChevronRight size={16} className="cl-chev" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
