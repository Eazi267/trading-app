import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LifeBuoy, Send, Plus, CheckCircle2, RotateCcw, Receipt } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSupport, CASE_CATEGORIES } from '../context/SupportContext.jsx'

function formatTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function Support() {
  const { currentUser } = useAuth()
  const { myCases, createCase, sendCaseMessage, setCaseStatus, markCaseReadByClient } = useSupport()
  const [searchParams] = useSearchParams()
  const [selectedCaseId, setSelectedCaseId] = useState(null)
  const [showNewCase, setShowNewCase] = useState(myCases.length === 0)
  const [newSubject, setNewSubject] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [newBody, setNewBody] = useState('')
  const [newError, setNewError] = useState('')
  const [draft, setDraft] = useState('')
  const [replyError, setReplyError] = useState('')
  const threadRef = useRef(null)

  const selected = myCases.find((c) => c.id === selectedCaseId) || null

  useEffect(() => {
    const caseParam = searchParams.get('case')
    if (caseParam && myCases.some((c) => String(c.id) === caseParam)) {
      setSelectedCaseId(Number(caseParam))
    } else if (!selectedCaseId && myCases.length > 0) {
      setSelectedCaseId(myCases[0].id)
    }
  }, [myCases.length])

  useEffect(() => {
    if (selectedCaseId) {
      markCaseReadByClient(selectedCaseId)
      setShowNewCase(false)
    }
  }, [selectedCaseId, selected?.messages?.length])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [selected?.messages?.length])

  async function handleCreateCase() {
    const result = await createCase({ subject: newSubject, category: newCategory, body: newBody })
    if (result.error) return setNewError(result.error)
    setNewError('')
    setNewSubject('')
    setNewBody('')
    setSelectedCaseId(result.case.id)
  }

  async function handleReply() {
    const result = await sendCaseMessage(selectedCaseId, draft)
    if (result.error) return setReplyError(result.error)
    setReplyError('')
    setDraft('')
  }

  return (
    <Layout pageTitle="Support">
      <h1 className="page-title">Support</h1>
      <p className="page-sub">
        Open a case for anything you need help with — each one is tracked separately, with replies landing here and in your notifications.
      </p>

      <div className="tx-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 300px) 1fr', gap: 20, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head">
            <h3>Your cases ({myCases.length})</h3>
            <button className="tx-btn deposit" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => { setShowNewCase(true); setSelectedCaseId(null) }}>
              <Plus size={13} /> New
            </button>
          </div>
          {myCases.length === 0 ? (
            <div className="empty-state"><LifeBuoy size={20} /><p>No cases yet.</p></div>
          ) : (
            <div style={{ padding: 12 }} className="stagger-in">
              {myCases.map((c) => {
                const isActive = c.id === selectedCaseId
                const lastMsg = c.messages[c.messages.length - 1]
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    style={{
                      width: '100%', textAlign: 'left', display: 'block', padding: '10px 12px', borderRadius: 10,
                      border: 'none', cursor: 'pointer', marginBottom: 4,
                      background: isActive ? 'var(--accent-bg)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.subject}</span>
                      {c.unreadForClient && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-bright)', flex: 'none', marginTop: 4 }} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span className={'status-pill status-' + (c.status === 'resolved' ? 'approved' : 'pending')} style={{ fontSize: 10 }}>{c.status}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{CASE_CATEGORIES[c.category]}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lastMsg?.senderRole === 'client' ? 'You: ' : ''}{lastMsg?.body}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="glass-card">
          {showNewCase ? (
            <>
              <div className="panel-head"><h3><Plus size={15} style={{ verticalAlign: -2, marginRight: 6 }} />New case</h3></div>
              <div style={{ padding: '0 20px 20px' }}>
                <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{ width: '100%', marginBottom: 10, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                >
                  {Object.entries(CASE_CATEGORIES).filter(([id]) => id !== 'appeal').map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
                <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Subject (optional)</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder={CASE_CATEGORIES[newCategory]}
                  style={{ width: '100%', marginBottom: 10, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                />
                <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="What do you need help with?"
                  style={{ width: '100%', minHeight: 100, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'none' }}
                />
                {newError && <div className="form-error" style={{ marginTop: 10 }}>{newError}</div>}
                <button className="tx-btn deposit" style={{ marginTop: 10, padding: '9px 16px', fontSize: 13 }} onClick={handleCreateCase}>
                  Open case
                </button>
              </div>
            </>
          ) : !selected ? (
            <div className="empty-state"><LifeBuoy size={20} /><p>Select a case, or open a new one.</p></div>
          ) : (
            <>
              <div className="panel-head">
                <div>
                  <h3>{selected.subject}</h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    Case #{selected.id} · {CASE_CATEGORIES[selected.category]}
                  </div>
                </div>
                <button
                  className="tx-btn withdraw"
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={() => setCaseStatus(selected.id, selected.status === 'resolved' ? 'open' : 'resolved')}
                >
                  {selected.status === 'resolved' ? <><RotateCcw size={13} /> Reopen</> : <><CheckCircle2 size={13} /> Mark resolved</>}
                </button>
              </div>

              {selected.relatedTransactionId && (
                <div style={{ padding: '10px 20px 0' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: 'var(--accent-bg)', color: 'var(--accent-bright)' }}>
                    <Receipt size={11} /> Linked to Transaction #{selected.relatedTransactionId}
                  </span>
                </div>
              )}

              <div className="chat-thread" ref={threadRef}>
                {selected.messages.map((m) => (
                  <div key={m.id} className={'chat-bubble ' + (m.senderRole === 'client' ? 'chat-bubble-mine' : 'chat-bubble-theirs')}>
                    {m.body}
                    <div className="chat-bubble-meta">{m.senderRole === 'admin' ? m.senderName : 'You'} · {formatTime(m.createdAt)}</div>
                  </div>
                ))}
              </div>

              {replyError && <div className="form-error" style={{ margin: '0 20px 12px' }}>{replyError}</div>}

              <div className="chat-composer">
                <textarea
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setReplyError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                  placeholder="Type a message..."
                />
                <button className="tx-btn deposit" style={{ padding: '0 18px', flex: 'none' }} onClick={handleReply}>
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
