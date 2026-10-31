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
      <header className="dz-head">
        <h1 className="dz-title">Support</h1>
        <div className="dz-muted">Open a case for anything you need help with. Each one is tracked separately, with replies landing here and in your notifications.</div>
      </header>

      <div className="sp-grid">
        <div className="dz-card sp-list">
          <div className="dz-card-head">
            <h3>Your cases ({myCases.length})</h3>
            <button className="btn-primary sp-new" onClick={() => { setShowNewCase(true); setSelectedCaseId(null) }}>
              <Plus size={13} /> New
            </button>
          </div>
          {myCases.length === 0 ? (
            <div className="dz-empty"><LifeBuoy size={20} /><br />No cases yet.</div>
          ) : (
            <div className="sp-cases">
              {myCases.map((c) => {
                const lastMsg = c.messages[c.messages.length - 1]
                return (
                  <button key={c.id} type="button" className={'sp-case' + (c.id === selectedCaseId ? ' on' : '')} onClick={() => setSelectedCaseId(c.id)}>
                    <div className="sp-case-top">
                      <strong>{c.subject}</strong>
                      {c.unreadForClient && <span className="sp-dot" aria-label="Unread reply" />}
                    </div>
                    <div className="sp-case-meta">
                      <span className={'status-pill status-' + (c.status === 'resolved' ? 'approved' : 'pending')}>{c.status}</span>
                      <span className="dz-muted">{CASE_CATEGORIES[c.category]}</span>
                    </div>
                    <div className="sp-case-last">{lastMsg?.senderRole === 'client' ? 'You: ' : ''}{lastMsg?.body}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="dz-card sp-pane">
          {showNewCase ? (
            <>
              <div className="dz-card-head"><h3><Plus size={15} className="st-ico" />New case</h3></div>
              <div className="st-form">
                <label className="st-f">
                  <span className="pg-label">Category</span>
                  <select className="pg-field" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                    {Object.entries(CASE_CATEGORIES).filter(([id]) => id !== 'appeal').map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="st-f">
                  <span className="pg-label">Subject (optional)</span>
                  <input className="pg-field" type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder={CASE_CATEGORIES[newCategory]} />
                </label>
                <label className="st-f st-wide">
                  <span className="pg-label">Message</span>
                  <textarea className="pg-field" value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="What do you need help with?" style={{ minHeight: 120, resize: 'vertical' }} />
                </label>
              </div>
              {newError && <div className="form-error" style={{ marginTop: 10 }}>{newError}</div>}
              <button className="btn-primary pg-start-btn" onClick={handleCreateCase}>Open case</button>
            </>
          ) : !selected ? (
            <div className="dz-empty"><LifeBuoy size={20} /><br />Select a case, or open a new one.</div>
          ) : (
            <>
              <div className="dz-card-head sp-thread-head">
                <div>
                  <h3>{selected.subject}</h3>
                  <div className="dz-muted">Case #{selected.id} · {CASE_CATEGORIES[selected.category]}</div>
                </div>
                <button className="dz-btn-o" onClick={() => setCaseStatus(selected.id, selected.status === 'resolved' ? 'open' : 'resolved')}>
                  {selected.status === 'resolved' ? <><RotateCcw size={13} /> Reopen</> : <><CheckCircle2 size={13} /> Mark resolved</>}
                </button>
              </div>

              {selected.relatedTransactionId && (
                <span className="dz-chip sp-linked"><Receipt size={11} /> Linked to Transaction #{selected.relatedTransactionId}</span>
              )}

              <div className="chat-thread" ref={threadRef}>
                {selected.messages.map((m) => (
                  <div key={m.id} className={'chat-bubble ' + (m.senderRole === 'client' ? 'chat-bubble-mine' : 'chat-bubble-theirs')}>
                    {m.body}
                    <div className="chat-bubble-meta">{m.senderRole === 'admin' ? m.senderName : 'You'} · {formatTime(m.createdAt)}</div>
                  </div>
                ))}
              </div>

              {replyError && <div className="form-error" style={{ margin: '0 0 12px' }}>{replyError}</div>}

              <div className="chat-composer">
                <textarea
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setReplyError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                  placeholder="Type a message..."
                />
                <button className="btn-primary" style={{ padding: '0 18px', flex: 'none' }} onClick={handleReply} aria-label="Send">
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
