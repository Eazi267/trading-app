import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeBuoy, Send, Search, CheckCircle2, RotateCcw, Receipt } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useSupport, CASE_CATEGORIES } from '../context/SupportContext.jsx'

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function formatTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const STATUS_FILTERS = ['all', 'open', 'resolved']

export default function AdminSupportInbox() {
  const { cases, sendCaseMessage, setCaseStatus, markCaseReadByAdmin } = useSupport()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedCaseId, setSelectedCaseId] = useState(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const threadRef = useRef(null)

  const sorted = [...cases].sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
  const q = search.trim().toLowerCase()
  const filtered = sorted
    .filter((c) => statusFilter === 'all' || c.status === statusFilter)
    .filter((c) => !q || c.userName?.toLowerCase().includes(q) || c.subject?.toLowerCase().includes(q))
  const selected = cases.find((c) => c.id === selectedCaseId) || null

  useEffect(() => {
    if ((!selectedCaseId || !filtered.some((c) => c.id === selectedCaseId)) && filtered.length > 0) {
      setSelectedCaseId(filtered[0].id)
    }
  }, [filtered.length, statusFilter])

  useEffect(() => {
    if (selectedCaseId) markCaseReadByAdmin(selectedCaseId)
  }, [selectedCaseId])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [selected?.messages?.length])

  function handleSend() {
    const result = sendCaseMessage(selectedCaseId, draft)
    if (result.error) return setError(result.error)
    setError('')
    setDraft('')
  }

  return (
    <Layout pageTitle="Support Inbox">
      <h1 className="page-title">Support Inbox</h1>
      <p className="page-sub">Every client's case in one place — each tracked separately, reply here and they see it instantly.</p>

      <div className="tx-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 320px) 1fr', gap: 20, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head">
            <h3>{filtered.length} case{filtered.length === 1 ? '' : 's'}</h3>
          </div>
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients or subjects..."
                style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '5px 11px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', textTransform: 'capitalize',
                    border: '1px solid ' + (statusFilter === s ? 'var(--accent)' : 'var(--border)'),
                    background: statusFilter === s ? 'var(--accent-bg)' : 'var(--bg)',
                    color: statusFilter === s ? 'var(--accent-bright)' : 'var(--text)'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="empty-state"><p>{cases.length === 0 ? 'No support cases yet.' : 'No cases match this filter.'}</p></div>
          ) : (
            <div style={{ padding: 12 }} className="stagger-in">
              {filtered.map((c) => {
                const lastMsg = c.messages[c.messages.length - 1]
                const isActive = c.id === selectedCaseId
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    style={{
                      width: '100%', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 4,
                      background: isActive ? 'var(--accent-bg)' : 'transparent'
                    }}
                  >
                    <div className="icon-badge" style={{ fontSize: 12, fontWeight: 700, flex: 'none', marginTop: 2 }}>{initials(c.userName)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.userName}</span>
                        {c.unreadForAdmin && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-bright)', flex: 'none', marginTop: 4 }} />}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                        {c.subject}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lastMsg?.senderRole === 'admin' ? 'You: ' : ''}{lastMsg?.body}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="glass-card">
          {!selected ? (
            <div className="empty-state">
              <LifeBuoy size={20} />
              <p>Select a case to view it.</p>
            </div>
          ) : (
            <>
              <div className="panel-head">
                <div>
                  <h3>{selected.userName}</h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {selected.subject} · Case #{selected.id} · {CASE_CATEGORIES[selected.category]}
                  </div>
                </div>
                <button
                  className="tx-btn withdraw"
                  style={{ padding: '6px 12px', fontSize: 12, flex: 'none' }}
                  onClick={() => setCaseStatus(selected.id, selected.status === 'resolved' ? 'open' : 'resolved')}
                >
                  {selected.status === 'resolved' ? <><RotateCcw size={13} /> Reopen</> : <><CheckCircle2 size={13} /> Mark resolved</>}
                </button>
              </div>

              {selected.relatedTransactionId && (
                <div style={{ padding: '10px 20px 0' }}>
                  <Link
                    to={`/admin/users/${selected.userId}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: 'var(--accent-bg)', color: 'var(--accent-bright)', textDecoration: 'none' }}
                  >
                    <Receipt size={11} /> Transaction #{selected.relatedTransactionId}
                  </Link>
                </div>
              )}

              <div className="chat-thread" ref={threadRef}>
                {selected.messages.map((m) => (
                  <div key={m.id} className={'chat-bubble ' + (m.senderRole === 'admin' ? 'chat-bubble-mine' : 'chat-bubble-theirs')}>
                    <div>{m.body}</div>
                    <div className="chat-bubble-meta">{m.senderRole === 'admin' ? m.senderName : selected.userName} · {formatTime(m.createdAt)}</div>
                  </div>
                ))}
              </div>

              {error && <div className="form-error" style={{ margin: '0 20px 12px' }}>{error}</div>}

              <div className="chat-composer">
                <textarea
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={`Reply to ${selected.userName}...`}
                />
                <button className="tx-btn deposit" style={{ padding: '0 18px', flex: 'none' }} onClick={handleSend}>
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
