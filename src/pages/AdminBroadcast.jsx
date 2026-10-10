import { useState } from 'react'
import { Megaphone, Send } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'

export default function AdminBroadcast() {
  const { users, currentUser } = useAuth()
  const { notifyBulk } = useNotifications()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sentCount, setSentCount] = useState(null)

  // Real clients only. Generated demo accounts (see the Generate Demo
  // Clients tool) are excluded so a broadcast's reach always reflects
  // genuine clients, not inflated by synthetic accounts nobody is
  // actually logged into.
  const realClients = users.filter((u) => u.role === 'user' && !u.isDemoGenerated)

  async function handleSend() {
    setError('')
    setSentCount(null)
    if (!title.trim()) {
      setError('Give the message a short title.')
      return
    }
    if (!body.trim()) {
      setError('Enter a message to send.')
      return
    }
    if (realClients.length === 0) {
      setError('No clients to send to yet.')
      return
    }
    // The server decides who really receives it (real, non-demo clients).
    const result = await notifyBulk(
      realClients.map((u) => u.id),
      'admin_broadcast',
      title.trim(),
      body.trim()
    )
    if (result.error) {
      setError(result.error)
      return
    }
    setSentCount(result.sentTo)
    setTitle('')
    setBody('')
  }

  return (
    <Layout pageTitle="Broadcast Message">
      <h1 className="page-title">Broadcast Message</h1>
      <p className="page-sub">
        Send one message to every real client at once — it lands in each of their notification bells
        immediately, the same as an individual message from a client's own detail page.
      </p>

      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="panel-head"><h3><Megaphone size={15} style={{ verticalAlign: -2, marginRight: 6 }} />New broadcast</h3></div>
        {error && <div className="form-error" style={{ margin: '16px 20px 0' }}>{error}</div>}
        {sentCount !== null && (
          <div style={{ margin: '16px 20px 0', fontSize: 13, color: 'var(--success)' }}>
            Sent to {sentCount} client{sentCount === 1 ? '' : 's'}.
          </div>
        )}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Title (e.g. "Scheduled maintenance")'
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message for every client..."
            rows={4}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div>
            <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={handleSend}>
              <Send size={14} /> Send to all {realClients.length} client{realClients.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 16px' }}>
          Only sent to real client accounts — generated demo clients are never included.
        </p>
      </div>
    </Layout>
  )
}
