import { useState } from 'react'
import { Mail, MailX, Search } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useEmail } from '../context/EmailContext.jsx'

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminEmailOutbox() {
  const { outbox } = useEmail()
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const filtered = q
    ? outbox.filter((e) => e.to?.toLowerCase().includes(q) || e.subject?.toLowerCase().includes(q))
    : outbox

  return (
    <Layout pageTitle="Email Outbox">
      <h1 className="page-title">Email Outbox</h1>
      <p className="page-sub">
        This platform doesn't send real email yet — that needs a backend to hold provider credentials safely.
        Every email the app would have sent is logged here instead, so you can see exactly what clients would
        receive once sending is connected.
      </p>

      <div style={{ position: 'relative', maxWidth: 340, marginBottom: 14 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search by recipient or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
        />
      </div>

      <div className="panel">
        <div className="panel-head"><h3>{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</h3></div>
        {filtered.length === 0 ? (
          <div className="empty-state"><p>Nothing has triggered an email yet.</p></div>
        ) : (
          <div style={{ padding: 16 }}>
            {filtered.map((e) => (
              <div key={e.id} className={'entity-card ' + (e.status === 'simulated' ? 'entity-card-accent-pending' : '')}>
                <div className="icon-badge">{e.status === 'simulated' ? <Mail size={17} /> : <MailX size={17} />}</div>
                <div className="entity-card-body">
                  <div className="entity-card-title">{e.subject}</div>
                  <div className="entity-card-meta">
                    <span>To: {e.to}</span>
                    <span>{formatDate(e.timestamp)}</span>
                    <span style={{ textTransform: 'capitalize' }}>{e.category}</span>
                  </div>
                </div>
                <span className={'status-pill status-' + (e.status === 'simulated' ? 'pending' : 'rejected')}>
                  {e.status === 'simulated' ? 'would send' : 'skipped'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
