import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeBuoy, Send, Search, CheckCircle2, RotateCcw, Receipt, ArrowLeft, Inbox } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useSupport, CASE_CATEGORIES } from '../context/SupportContext.jsx'
import { useMediaQuery } from '../hooks/useMediaQuery.js'

function formatTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

const STATUS_FILTERS = ['open', 'resolved', 'all']

export default function AdminSupportInbox() {
  const { cases, sendCaseMessage, setCaseStatus, markCaseReadByAdmin } = useSupport()
  const isPhone = useMediaQuery('(max-width: 900px)')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedCaseId, setSelectedCaseId] = useState(null)
  const [showThread, setShowThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const threadRef = useRef(null)

  const sorted = [...cases].sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
  const q = search.trim().toLowerCase()
  const filtered = sorted
    .filter((c) => statusFilter === 'all' || c.status === statusFilter)
    .filter((c) => !q || c.userName?.toLowerCase().includes(q) || c.subject?.toLowerCase().includes(q))
  const selected = cases.find((c) => c.id === selectedCaseId) || null
  const unreadCount = cases.filter((c) => c.unreadForAdmin).length
  const openCount = cases.filter((c) => c.status !== 'resolved').length

  // Desktop shows the first case straight away. On a phone we wait for
  // a tap, so a case is never marked "read" without being opened.
  useEffect(() => {
    if (isPhone) return
    if ((!selectedCaseId || !filtered.some((c) => c.id === selectedCaseId)) && filtered.length > 0) {
      setSelectedCaseId(filtered[0].id)
    }
  }, [filtered.length, statusFilter, isPhone])

  useEffect(() => {
    if (selectedCaseId && (!isPhone || showThread)) markCaseReadByAdmin(selectedCaseId)
  }, [selectedCaseId, selected?.messages?.length, showThread, isPhone])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [selected?.messages?.length, showThread])

  async function handleSend() {
    const result = await sendCaseMessage(selectedCaseId, draft)
    if (result.error) return setError(result.error)
    setError('')
    setDraft('')
  }

  function openCase(id) {
    setSelectedCaseId(id)
    setShowThread(true)
  }

  const listHidden = isPhone && showThread
  const threadHidden = isPhone && !showThread

  return (
    <Layout pageTitle="Support Inbox">
      <header className="dz-head">
        <h1 className="dz-title">Support Inbox</h1>
        <div className="dz-muted">Every client's case in one place. Each is tracked separately, and replies reach the client instantly.</div>
      </header>

      <div className="ad-kpis ad-kpis-3">
        <div className={'ad-kpi' + (unreadCount > 0 ? ' alert' : '')}><span className="ad-kpi-ico"><Inbox size={18} /></span><span className="ad-kpi-label">Unread</span><b className="ad-kpi-value">{unreadCount}</b></div>
        <div className="ad-kpi"><span className="ad-kpi-ico"><LifeBuoy size={18} /></span><span className="ad-kpi-label">Open cases</span><b className="ad-kpi-value">{openCount}</b></div>
        <div className="ad-kpi"><span className="ad-kpi-ico"><CheckCircle2 size={18} /></span><span className="ad-kpi-label">Resolved</span><b className="ad-kpi-value">{cases.length - openCount}</b></div>
      </div>

      <div className="sp-grid ib-grid">
        {!listHidden && (
          <div className="dz-card sp-list">
            <div className="cl-tools">
              <label className="cl-search">
                <Search size={15} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients or subjects…" />
              </label>
              <div className="dz-ranges" role="tablist" aria-label="Status">
                {STATUS_FILTERS.map((s) => (
                  <button key={s} type="button" role="tab" aria-selected={statusFilter === s} className={'dz-range' + (statusFilter === s ? ' on' : '')} onClick={() => setStatusFilter(s)} style={{ textTransform: 'capitalize' }}>{s}</button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="dz-empty">{cases.length === 0 ? 'No support cases yet.' : 'No cases match this filter.'}</div>
            ) : (
              <div className="sp-cases">
                {filtered.map((c) => {
                  const lastMsg = c.messages[c.messages.length - 1]
                  return (
                    <button key={c.id} type="button" className={'sp-case ib-case' + (c.id === selectedCaseId && !isPhone ? ' on' : '')} onClick={() => openCase(c.id)}>
                      <span className="rf-av">{initials(c.userName)}</span>
                      <span className="ib-case-body">
                        <span className="sp-case-top"><strong>{c.userName}</strong>{c.unreadForAdmin && <span className="sp-dot" aria-label="Unread" />}</span>
                        <span className="ib-subject">{c.subject}</span>
                        <span className="sp-case-last">{lastMsg?.senderRole === 'admin' ? 'You: ' : ''}{lastMsg?.body}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!threadHidden && (
          <div className="dz-card sp-pane">
            {!selected ? (
              <div className="dz-empty"><LifeBuoy size={20} /><br />Select a case to view it.</div>
            ) : (
              <>
                {isPhone && (
                  <button type="button" className="cd-back" onClick={() => setShowThread(false)}><ArrowLeft size={14} /> All cases</button>
                )}
                <div className="dz-card-head sp-thread-head">
                  <div>
                    <h3>{selected.userName}</h3>
                    <div className="dz-muted">{selected.subject} · Case #{selected.id} · {CASE_CATEGORIES[selected.category]}</div>
                  </div>
                  <button className="dz-btn-o" onClick={() => setCaseStatus(selected.id, selected.status === 'resolved' ? 'open' : 'resolved')}>
                    {selected.status === 'resolved' ? <><RotateCcw size={13} /> Reopen</> : <><CheckCircle2 size={13} /> Resolve</>}
                  </button>
                </div>

                <div className="ib-links">
                  <Link to={`/admin/users/${selected.userId}`} className="dz-chip ad-link">Open client</Link>
                  {selected.relatedTransactionId && (
                    <Link to={`/admin/users/${selected.userId}`} className="dz-chip ad-link"><Receipt size={11} /> Transaction #{selected.relatedTransactionId}</Link>
                  )}
                </div>

                <div className="chat-thread" ref={threadRef}>
                  {selected.messages.map((m) => (
                    <div key={m.id} className={'chat-bubble ' + (m.senderRole === 'admin' ? 'chat-bubble-mine' : 'chat-bubble-theirs')}>
                      <div>{m.body}</div>
                      <div className="chat-bubble-meta">{m.senderRole === 'admin' ? m.senderName : selected.userName} · {formatTime(m.createdAt)}</div>
                    </div>
                  ))}
                </div>

                {error && <div className="form-error" style={{ margin: '0 0 12px' }}>{error}</div>}

                <div className="chat-composer">
                  <textarea
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); setError('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder={`Reply to ${selected.userName}…`}
                  />
                  <button className="btn-primary" style={{ padding: '0 18px', flex: 'none' }} onClick={handleSend} aria-label="Send reply">
                    <Send size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
