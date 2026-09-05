import { Link } from 'react-router-dom'
import { ArrowRight, Layers, Building2 } from 'lucide-react'
import { useSettings } from '../context/SettingsContext.jsx'

// Same footer markup Home.jsx used to hardcode, pulled out for the
// same reason PublicNav.jsx already exists: About Us, Privacy Policy,
// and Help were rendering as dead ends with no way back to the rest
// of the site and no closing CTA, while Home had both. One shared
// definition keeps every public page consistent going forward.
export default function PublicFooter() {
  const { settings } = useSettings()

  return (
    <footer className="home-footer">
      <div className="home-footer-icon"><Layers size={22} /></div>
      <h2>Ready to get started?</h2>
      <Link to="/signup" className="btn-primary" style={{ padding: '13px 24px', fontSize: 15, margin: '0 auto' }}>
        Create your account <ArrowRight size={16} />
      </Link>
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 20, fontSize: 12.5, flexWrap: 'wrap' }}>
        <Link to="/about" style={{ color: 'var(--text-muted)' }}>About Us</Link>
        <Link to="/privacy" style={{ color: 'var(--text-muted)' }}>Privacy Policy</Link>
        <Link to="/help" style={{ color: 'var(--text-muted)' }}>Help</Link>
      </div>
      {settings.companyAddress && (
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Building2 size={12} /> {settings.companyAddress}
        </p>
      )}
    </footer>
  )
}
