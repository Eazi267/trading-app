import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

// Same nav markup as Home.jsx's hardcoded header, pulled out so the
// public content pages (About, Privacy, Help) share one definition
// instead of three copies drifting apart over time.
export default function PublicNav() {
  const { currentUser } = useAuth()
  const { brand } = useSettings()

  return (
    <nav className="home-nav">
      <Link to="/" className="home-nav-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="home-nav-mark">
          {brand.logoImageDataUrl ? (
            <img src={brand.logoImageDataUrl} alt={brand.name} style={{ width: 18, height: 18, objectFit: 'contain' }} />
          ) : (
            <brand.LogoIcon size={18} />
          )}
        </div>
        <span className="home-nav-name">{brand.name}</span>
      </Link>
      <div className="home-nav-actions">
        {currentUser ? (
          <Link to="/dashboard" className="btn-primary home-nav-cta" style={{ padding: '9px 16px', fontSize: 13.5 }}>
            <span className="cta-long">Go to dashboard</span><span className="cta-short">Dashboard</span> <ArrowRight size={15} />
          </Link>
        ) : (
          <>
            <Link to="/login" className="home-nav-login">Log in</Link>
            <Link to="/signup" className="btn-primary home-nav-cta" style={{ padding: '9px 16px', fontSize: 13.5 }}>
              <span className="cta-long">Get started</span><span className="cta-short">Sign up</span> <ArrowRight size={15} />
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
