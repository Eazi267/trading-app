import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { apiRequest } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import CopyButton from './CopyButton.jsx'

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: 14
}

// Admin-only card on the Settings page: turn authenticator-app login on or off.
// Steps: Set up -> add the key to your app -> type the 6-digit code -> save the
// recovery codes (shown once). Turning it off needs your password and a code.
export default function TwoFactorPanel() {
  const { currentUser } = useAuth()
  const [enabled, setEnabled] = useState(!!currentUser.twoFactorEnabled)
  const [setup, setSetup] = useState(null)      // { secret, otpauthUri } while setting up
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [recovery, setRecovery] = useState(null) // shown once after enabling
  const [disabling, setDisabling] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function start() {
    setError(''); setBusy(true)
    const r = await apiRequest('/api/auth/2fa/setup', { method: 'POST' })
    setBusy(false)
    if (r.error) return setError(r.error)
    setSetup(r)
  }
  async function confirm() {
    setError(''); setBusy(true)
    const r = await apiRequest('/api/auth/2fa/enable', { method: 'POST', body: { code } })
    setBusy(false)
    if (r.error) return setError(r.error)
    setEnabled(true); setSetup(null); setCode(''); setRecovery(r.recoveryCodes)
  }
  async function turnOff() {
    setError(''); setBusy(true)
    const r = await apiRequest('/api/auth/2fa/disable', { method: 'POST', body: { password, code } })
    setBusy(false)
    if (r.error) return setError(r.error)
    setEnabled(false); setDisabling(false); setPassword(''); setCode('')
  }

  return (
    <div className="panel" style={{ maxWidth: 480, marginTop: 16 }}>
      <div className="panel-head">
        <h3><ShieldCheck size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Two-factor login</h3>
      </div>
      <div style={{ padding: '0 20px 20px', fontSize: 13.5 }}>
        {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

        {recovery && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ color: 'var(--success)', marginTop: 0 }}>Two-factor login is on.</p>
            <p>Save these recovery codes somewhere safe. Each works once if you lose your phone. <strong>They will not be shown again.</strong></p>
            <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 14, lineHeight: 1.7 }}>{recovery.join('\n')}</pre>
            <CopyButton value={recovery.join('\n')} label="Copy codes" />
            <button className="btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={() => setRecovery(null)}>I have saved them</button>
          </div>
        )}

        {!recovery && !enabled && !setup && (
          <>
            <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
              Adds a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password…) to your login, so a stolen password alone can't open your admin account.
            </p>
            <button className="btn-primary" style={{ width: '100%' }} onClick={start} disabled={busy}>Set up two-factor</button>
          </>
        )}

        {!recovery && !enabled && setup && (
          <>
            <p style={{ marginTop: 0 }}>1. In your authenticator app choose <strong>Add account → Enter a setup key</strong> and type this key:</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontFamily: 'monospace', fontSize: 14, wordBreak: 'break-all' }}>
              <span style={{ flex: 1 }}>{setup.secret}</span>
              <CopyButton value={setup.secret} label="Copy key" />
            </div>
            <p>2. Type the 6-digit code the app now shows:</p>
            <input style={inputStyle} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            <button className="btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={confirm} disabled={busy}>Turn on</button>
          </>
        )}

        {!recovery && enabled && !disabling && (
          <>
            <p style={{ marginTop: 0, color: 'var(--success)' }}>Two-factor login is on for this account.</p>
            <button className="tx-btn" style={{ padding: '8px 14px' }} onClick={() => { setDisabling(true); setError('') }}>Turn off…</button>
          </>
        )}

        {!recovery && enabled && disabling && (
          <>
            <label style={{ display: 'block', marginBottom: 6 }}>Your password</label>
            <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <label style={{ display: 'block', margin: '14px 0 6px' }}>Current 6-digit code (or a recovery code)</label>
            <input style={inputStyle} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" />
            <button className="btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={turnOff} disabled={busy}>Turn off two-factor</button>
            <button className="tx-btn" style={{ marginTop: 8, width: '100%' }} onClick={() => { setDisabling(false); setError('') }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}
