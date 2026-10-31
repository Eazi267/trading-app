import DOMPurify from 'dompurify'
import { Link } from 'react-router-dom'
import PublicNav from './PublicNav.jsx'
import PublicFooter from './PublicFooter.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { defaultLegalHtml } from '../config/legalDefaults.js'

const TITLES = { terms: 'Terms of Service', privacy: 'Privacy Policy', cookies: 'Cookie Policy' }
const FIELDS = { terms: 'termsHtml', privacy: 'privacyPolicyHtml', cookies: 'cookiePolicyHtml' }

// One page for all three legal documents. Shows the admin's own text when it
// has been written (Admin > Business Settings), otherwise the standard template.
export default function LegalPage({ kind }) {
  const { settings, brand } = useSettings()
  const custom = settings[FIELDS[kind]]
  const html = custom || defaultLegalHtml(kind, brand.name, settings.companyAddress)
  return (
    <div className="home">
      <PublicNav />
      <div className="legal-page" style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px', minHeight: '50vh' }}>
        <h1 className="page-title">{TITLES[kind]}</h1>
        <p className="legal-links">
          <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/cookies">Cookies</Link>
        </p>
        {/* Admin-authored (or our template): sanitised before it is shown. */}
        <div className="legal-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
      </div>
      <PublicFooter />
    </div>
  )
}
