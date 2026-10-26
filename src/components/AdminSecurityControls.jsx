import { useEffect, useState } from 'react'
import { ShieldCheck, Mail } from 'lucide-react'
import ToggleSwitch from './ToggleSwitch.jsx'
import { apiRequest } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { hasPermission } from '../config/adminTiers.js'

// Two switches for the super admin, on the Admin Accounts page:
//  1. require two-factor login for every admin
//  2. automatically email clients about deposits and withdrawals
export default function AdminSecurityControls() {
  const { currentUser } = useAuth()
  const [c, setC] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiRequest('/api/admin/controls').then((r) => (r.error ? setError(r.error) : setC(r)))
  }, [])

  async function flip(path, body) {
    setError(''); setBusy(true)
    const r = await apiRequest(`/api/admin/controls/${path}`, { method: 'PUT', body })
    setBusy(false)
    if (r.error) return setError(r.error)
    setC(r)
  }

  const canTwoFactor = hasPermission(currentUser, 'manageAdmins')
  const canAutoEmail = hasPermission(currentUser, 'manageSettings')
  const row = { display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid var(--border)' }
  const muted = { fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }

  return (
    <div className="glass-card fade-in-up-1" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h3><ShieldCheck size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Security and email switches</h3>
      </div>
      <div style={{ padding: '0 20px 8px' }}>
        {error && <div className="form-error" style={{ marginBottom: 10 }}>{error}</div>}
        {!c ? <p style={muted}>Loading…</p> : (
          <>
            <div style={{ ...row, borderTop: 'none' }}>
              <div>
                <strong style={{ fontSize: 14 }}>Require two-factor login for all admins</strong>
                <div style={muted}>
                  Any admin without two-factor can only open Settings until they set it up.
                  {c.adminsWithoutTwoFactor > 0 && ` ${c.adminsWithoutTwoFactor} admin account(s) don't have it yet.`}
                </div>
                {!c.yourTwoFactorEnabled && !c.requireAdmin2fa && <div style={{ ...muted, color: 'var(--danger)' }}>Turn on two-factor for your own account first (Settings).</div>}
                {c.requireAdmin2faForcedByServer && <div style={muted}>Also forced on by the server setting REQUIRE_ADMIN_2FA, which can't be turned off here.</div>}
                {!canTwoFactor && <div style={muted}>Only a super admin can change this.</div>}
              </div>
              <ToggleSwitch checked={c.requireAdmin2fa} disabled={busy || !canTwoFactor || (c.requireAdmin2faForcedByServer && c.requireAdmin2fa)} onChange={(v) => flip('admin-2fa', { required: v })} />
            </div>
            <div style={row}>
              <div>
                <strong style={{ fontSize: 14 }}><Mail size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Automatically email clients about deposits and withdrawals</strong>
                <div style={muted}>Sends an email when a client makes a request and when it is approved or declined. Every email is recorded on the client's page.</div>
                {c.emailMode !== 'resend' && (
                  <div style={{ ...muted, color: 'var(--danger)' }}>
                    {c.emailMode === 'console' ? 'Email is in TEST MODE: messages are written to the server log, not delivered.' : 'No email provider is set up on the server, so nothing can be delivered yet.'}
                  </div>
                )}
                {!canAutoEmail && <div style={muted}>Needs the “manage settings” permission.</div>}
              </div>
              <ToggleSwitch checked={c.autoTransactionEmails} disabled={busy || !canAutoEmail} onChange={(v) => flip('auto-emails', { enabled: v })} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
