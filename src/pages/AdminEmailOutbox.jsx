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
  const wouldSend = outbox.filter((e) => e.status === 'simulated').length

  return (
    <Layout pageTitle="Email Outbox">
      <header className="dz-head">
        <h1 className="dz-title">Email Outbox</h1>
        <div className="dz-muted">This platform doesn't send real email yet, because that needs a backend to hold provider credentials safely. Every email the app would have sent is logged here instead, so you can see exactly what clients would receive once sending is connected.</div>
      </header>

      <div className="dz-card rf-campaign eo-note">
        <div className="icon-badge"><Mail size={17} /></div>
        <div>
          <strong>Simulated: nothing here was actually delivered</strong>
          <p className="dz-muted" style={{ margin: '2px 0 0' }}>{wouldSend} email{wouldSend === 1 ? '' : 's'} logged as "would send", {outbox.length - wouldSend} skipped.</p>
        </div>
      </div>

      <div className="dz-card">
        <div className="cl-tools">
          <label className="cl-search">
            <Search size={15} />
            <input type="text" placeholder="Search by recipient or subject…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
        <div className="dz-card-head"><h3>{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</h3></div>
        {filtered.length === 0 ? (
          <div className="dz-empty">{outbox.length === 0 ? 'Nothing has triggered an email yet.' : 'No emails match this search.'}</div>
        ) : (
          <div className="rf-list">
            {filtered.map((e) => (
              <div key={e.id} className="rf-item sc-row">
                <span className="rf-av">{e.status === 'simulated' ? <Mail size={15} /> : <MailX size={15} />}</span>
                <span className="rf-who">
                  <strong>{e.subject}</strong>
                  <span className="dz-muted">To: {e.to} · {formatDate(e.timestamp)} · <span style={{ textTransform: 'capitalize' }}>{e.category}</span></span>
                </span>
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
