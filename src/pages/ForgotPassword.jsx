import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, KeyRound, ArrowRight } from 'lucide-react'
import { apiRequest } from '../api/client.js'
import { useSettings } from '../context/SettingsContext.jsx'
import PasswordField from '../components/PasswordField.jsx'

// Two steps: (1) enter your email, we email a 6-digit code; (2) enter the code
// and a new password. The first step always says the same thing whether or not
// the email has an account, so it can't be used to find out who is registered.
export default function ForgotPassword() {
  const { brand } = useSettings()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function requestCode(e) {
    e?.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    const r = await apiRequest('/api/auth/password-reset/request', { method: 'POST', body: { email } })
    setBusy(false)
    if (r.error) return setError(r.error)
    setInfo(r.message || "If an account with that email exists, we've sent it a code.")
    setStep('reset')
  }

  async function resetPassword(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    const r = await apiRequest('/api/auth/password-reset/confirm', { method: 'POST', body: { email, code, newPassword: password } })
    setBusy(false)
    if (r.error) return setError(r.error)
    setDone(true)
  }

  return (
    <div className="login-form-side" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form className="login-card" onSubmit={step === 'email' ? requestCode : resetPassword}>
        <h1>{done ? 'Password changed' : 'Reset your password'}</h1>
        <p className="login-sub">{brand.name}</p>

        {error && <div className="form-error">{error}</div>}

        {done ? (
          <>
            <p style={{ fontSize: 14 }}>Your password has been changed and you were signed out everywhere else. You can log in with the new one now.</p>
            <Link to="/login" className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>Go to login <ArrowRight size={16} /></Link>
          </>
        ) : step === 'email' ? (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Enter your account email and we'll send you a 6-digit code.</p>
            <label>Email</label>
            <div className="field-input-wrap">
              <Mail size={16} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="username" required />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>Send code <ArrowRight size={16} /></button>
          </>
        ) : (
          <>
            {info && <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{info} The code works for 15 minutes.</p>}
            <label>6-digit code</label>
            <div className="field-input-wrap">
              <KeyRound size={16} />
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" autoFocus required />
            </div>
            <label>New password</label>
            <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            <label>Confirm new password</label>
            <PasswordField value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required />
            <button type="submit" className="btn-primary" disabled={busy}>Change password <ArrowRight size={16} /></button>
            <p className="demo-note">
              No code? <a href="#" onClick={(e) => { e.preventDefault(); requestCode() }} style={{ color: 'var(--accent-bright)' }}>Send it again</a> (you can ask once a minute).
            </p>
          </>
        )}

        {!done && <p className="demo-note"><Link to="/login" style={{ color: 'var(--accent-bright)' }}>Back to login</Link></p>}
      </form>
    </div>
  )
}
