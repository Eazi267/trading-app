import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { apiRequest } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

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
      <div className="ve-wrap">
        <div className="dz-card ve-card">
          <div className="ve-icon"><MailCheck size={26} /></div>
          {verified ? (
            <>
              <h1 className="ve-title">Email verified</h1>
              <p className="dz-muted">Your email address is confirmed. You're all set.</p>
              <button className="btn-primary pg-start-btn" onClick={() => window.location.assign('/dashboard')}>Continue</button>
            </>
          ) : (
            <>
              <h1 className="ve-title">Verify your email</h1>
              <p className="dz-muted">We emailed a 6-digit code to <strong>{currentUser.email}</strong>. It works for 15 minutes.</p>
              {error && <div className="form-error" style={{ textAlign: 'left' }}>{error}</div>}
              {info && <p className="st-ok">{info}</p>}
              <input className="ve-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" aria-label="6-digit code" />
              <button className="btn-primary pg-start-btn" onClick={confirm} disabled={busy || !code.trim()}>Verify</button>
              <button className="dz-btn-o ve-resend" onClick={resend} disabled={busy}>Send me a new code</button>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
