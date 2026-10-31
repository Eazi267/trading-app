import { useAuth } from '../context/AuthContext.jsx'

// A slim reminder shown on every page until the email is confirmed.
export default function EmailVerifyBanner() {
  const { currentUser } = useAuth()
  if (!currentUser || currentUser.emailVerified) return null
  if (window.location.pathname === '/verify-email') return null
  return (
    <div className="verify-banner" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated, var(--bg))', fontSize: 13.5, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>Please verify your email address<span className="vb-email"> ({currentUser.email})</span>.</span>
      <a href="/verify-email" style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>Verify now</a>
    </div>
  )
}
