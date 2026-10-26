import { useEffect, useState } from 'react'
import { Mail, Send } from 'lucide-react'
import CollapsiblePanel from './CollapsiblePanel.jsx'
import { apiRequest } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { hasPermission } from '../config/adminTiers.js'

const field = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }
const STATUS_TEXT = { sent: 'sent', logged: 'test mode (not delivered)', skipped: 'not sent (no provider)', failed: 'failed' }
const KIND_TEXT = (k) => (k.startsWith('auto_') ? 'Automatic' : 'Manual') + ' · ' + k.replace(/^(auto|manual)_/, '').replace(/_/g, ' ')

// "Email this client": send a deposit / withdrawal confirmation for one of the
// client's transactions, or a custom message. Every email is recorded below.
export default function ClientEmailPanel({ userId, email, transactions }) {
  const { currentUser } = useAuth()
  const canFinance = hasPermission(currentUser, 'finance')
  const [template, setTemplate] = useState(canFinance ? 'deposit' : 'custom')
  const [txId, setTxId] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState([])
  const [mode, setMode] = useState('resend')

  async function loadHistory() {
    const r = await apiRequest(`/api/admin/email/${userId}`)
    if (r.emails) setHistory(r.emails)
  }
  useEffect(() => {
    loadHistory()
    apiRequest('/api/admin/controls').then((r) => r.emailMode && setMode(r.emailMode))
  }, [userId])

  const txOptions = (transactions || []).filter((t) => t.type === template)

  async function send() {
    setBusy(true); setResult(null)
    const body = template === 'custom' ? { template, subject, message } : { template, transactionId: Number(txId) }
    const r = await apiRequest(`/api/admin/email/${userId}`, { method: 'POST', body })
    setBusy(false)
    setResult(r.error ? { error: r.error } : { ok: r.message })
    if (!r.error) { loadHistory(); if (template === 'custom') { setSubject(''); setMessage('') } }
  }

  const ready = template === 'custom' ? subject.trim() && message.trim() : !!txId

  return (
    <CollapsiblePanel title="Email this client" style={{ marginTop: 16 }}>
      <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          <Mail size={13} style={{ verticalAlign: -2, marginRight: 5 }} />To: <strong>{email}</strong>
          {mode !== 'resend' && <span style={{ color: 'var(--danger)' }}> · {mode === 'console' ? 'test mode: emails are NOT delivered' : 'no email provider set up: nothing will be delivered'}</span>}
        </div>

        <select value={template} onChange={(e) => { setTemplate(e.target.value); setTxId(''); setResult(null) }} style={field}>
          {canFinance && <option value="deposit">Deposit confirmation</option>}
          {canFinance && <option value="withdrawal">Withdrawal confirmation</option>}
          <option value="custom">Custom message</option>
        </select>

        {template !== 'custom' ? (
          <select value={txId} onChange={(e) => setTxId(e.target.value)} style={field}>
            <option value="">{txOptions.length ? `Choose a ${template}…` : `This client has no ${template}s`}</option>
            {txOptions.map((t) => (
              <option key={t.id} value={t.id}>#{t.id} · ${Number(t.amount).toFixed(2)} · {t.status}</option>
            ))}
          </select>
        ) : (
          <>
            <input type="text" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={field} />
            <textarea value={message} maxLength={5000} onChange={(e) => setMessage(e.target.value)} placeholder="Write the message. The client's name and the site name are added automatically." rows={5} style={{ ...field, resize: 'vertical' }} />
          </>
        )}
        {template !== 'custom' && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>The wording follows the transaction's status (received / approved / declined). Internal rejection reasons are never included.</div>}

        <div>
          <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={send} disabled={busy || !ready}>
            <Send size={14} /> Send email
          </button>
        </div>
        {result?.error && <div className="form-error">{result.error}</div>}
        {result?.ok && <div style={{ fontSize: 13, color: 'var(--success)' }}>{result.ok}</div>}

        {history.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Emails sent to this client</div>
            {history.map((e) => (
              <div key={e.id} className="entity-card" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>{e.subject}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {KIND_TEXT(e.kind)}{e.sentByName ? ` · by ${e.sentByName}` : ''} · {new Date(e.createdAt).toLocaleString()} · {STATUS_TEXT[e.status] || e.status}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </CollapsiblePanel>
  )
}
