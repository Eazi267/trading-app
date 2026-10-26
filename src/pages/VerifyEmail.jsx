import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { apiRequest } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: 14
}

// Confirm your email with the 6-digit code we sent (at signup, or on request).
export default function VerifyEmail() {
  const { currentUser } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(!!currentUser.emailVerified)

  async function confirm() {
    setError(''); setInfo(''); setBusy(true)
    const r = await apiRequest('/api/auth/verify-email/confirm', { method: 'POST', body: { code } })
    setBusy(false)
    if (r.error) return setError(r.error)
    setVerified(true)
  }
  async function resend() {
    setError(''); setInfo(''); setBusy(true)
    const r = await apiRequest('/api/auth/verify-email/send', { method: 'POST' })
    setBusy(false)
    if (r.error) return setError(r.error)
    setInfo(`A new code is on its way to ${currentUser.email}.`)
  }

  return (
    <Layout pageTitle="Verify email">
      <div className="panel" style={{ maxWidth: 480 }}>
        <div className="panel-head">
          <h3><MailCheck size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Verify your email</h3>
        </div>
        <div style={{ padding: '0 20px 20px', fontSize: 13.5 }}>
          {verified ? (
            <>
              <p style={{ marginTop: 0, color: 'var(--success)' }}>Your email address is verified.</p>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => window.location.assign('/dashboard')}>Continue</button>
            </>
          ) : (
            <>
              {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}
              {info && <p style={{ color: 'var(--success)', marginTop: 0 }}>{info}</p>}
              <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>We emailed a 6-digit code to <strong>{currentUser.email}</strong>. Enter it below. It works for 15 minutes.</p>
              <input style={inputStyle} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
              <button className="btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={confirm} disabled={busy || !code.trim()}>Verify</button>
              <button className="tx-btn" style={{ marginTop: 8, width: '100%' }} onClick={resend} disabled={busy}>Send me a new code</button>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
