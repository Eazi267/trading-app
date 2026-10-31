import { useState } from 'react'
import { Megaphone, Send, Bell, AlertTriangle } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'

const TITLE_MAX = 80
const BODY_MAX = 500

export default function AdminBroadcast() {
  const { users } = useAuth()
  const { notifyBulk } = useNotifications()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sentCount, setSentCount] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)

  // Real clients only. Generated demo accounts are excluded so a
  // broadcast's reach always reflects genuine clients.
  const realClients = users.filter((u) => u.role === 'user' && !u.isDemoGenerated)
  const n = realClients.length

  function handleReview() {
    setError('')
    setSentCount(null)
    if (!title.trim()) return setError('Give the message a short title.')
    if (!body.trim()) return setError('Enter a message to send.')
    if (n === 0) return setError('No clients to send to yet.')
    setConfirming(true)
  }

  async function handleSend() {
    setSending(true)
    // The server decides who really receives it (real, non-demo clients).
    const result = await notifyBulk(realClients.map((u) => u.id), 'admin_broadcast', title.trim(), body.trim())
    setSending(false)
    setConfirming(false)
    if (result.error) return setError(result.error)
    setSentCount(result.sentTo)
    setTitle('')
    setBody('')
  }

  return (
    <Layout pageTitle="Broadcast Message">
      <header className="dz-head">
        <h1 className="dz-title">Broadcast</h1>
        <div className="dz-muted">Send one message to every real client at once. It lands in each client's notification bell immediately.</div>
      </header>

      <div className="dz-grid">
        <div className="dz-main">
          <div className="dz-card">
            <div className="dz-card-head"><h3><Megaphone size={15} className="st-ico" />New broadcast</h3></div>
            {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
            {sentCount !== null && <div className="st-ok" style={{ marginBottom: 12 }}>Sent to {sentCount} client{sentCount === 1 ? '' : 's'}.</div>}
            <div className="st-form">
              <label className="st-f st-wide">
                <span className="pg-label">Title <span className="dz-muted">{title.length}/{TITLE_MAX}</span></span>
                <input className="pg-field" type="text" maxLength={TITLE_MAX} value={title} onChange={(e) => { setTitle(e.target.value); setConfirming(false) }} placeholder='e.g. "Scheduled maintenance"' />
              </label>
              <label className="st-f st-wide">
                <span className="pg-label">Message <span className="dz-muted">{body.length}/{BODY_MAX}</span></span>
                <textarea className="pg-field" maxLength={BODY_MAX} value={body} onChange={(e) => { setBody(e.target.value); setConfirming(false) }} placeholder="Write a message for every client…" style={{ minHeight: 130, resize: 'vertical' }} />
              </label>
            </div>

            {confirming ? (
              <div className="bc-confirm">
                <AlertTriangle size={16} />
                <span>This goes to <strong>{n} client{n === 1 ? '' : 's'}</strong> right now and can't be unsent.</span>
                <button type="button" className="dz-btn-o" onClick={() => setConfirming(false)} disabled={sending}>Edit</button>
                <button type="button" className="btn-primary" onClick={handleSend} disabled={sending}><Send size={14} /> {sending ? 'Sending…' : 'Confirm and send'}</button>
              </div>
            ) : (
              <button type="button" className="btn-primary pg-start-btn" onClick={handleReview}><Send size={14} /> Review and send to {n} client{n === 1 ? '' : 's'}</button>
            )}
            <p className="dz-muted st-hint">Only real client accounts receive it. Generated demo clients are never included.</p>
          </div>
        </div>

        <aside className="dz-side">
          <div className="dz-card">
            <div className="dz-card-head"><h3><Bell size={15} className="st-ico" />What clients will see</h3></div>
            <div className="bc-preview">
              <span className="bc-ico"><Megaphone size={16} /></span>
              <div>
                <strong>{title.trim() || 'Your title'}</strong>
                <p>{body.trim() || 'Your message appears here as you type.'}</p>
                <small className="dz-muted">Just now</small>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  )
}
