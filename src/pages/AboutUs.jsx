import PublicNav from '../components/PublicNav.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

export default function AboutUs() {
  const { settings, brand } = useSettings()

  return (
    <div className="home">
      <PublicNav />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        <h1 className="page-title">About Us</h1>
        {settings.aboutUsHtml ? (
          // Admin-authored only (edited in AdminBusinessSettings.jsx,
          // an admin-only route) — same trust boundary as an admin
          // already having full account-management access.
          <div dangerouslySetInnerHTML={{ __html: settings.aboutUsHtml }} />
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>{brand.name} hasn't added an About Us page yet.</p>
        )}
      </div>
    </div>
  )
}
