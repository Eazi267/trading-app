import PublicNav from '../components/PublicNav.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

export default function PrivacyPolicy() {
  const { settings, brand } = useSettings()

  return (
    <div className="home">
      <PublicNav />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        <h1 className="page-title">Privacy Policy</h1>
        {settings.privacyPolicyHtml ? (
          <div dangerouslySetInnerHTML={{ __html: settings.privacyPolicyHtml }} />
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>{brand.name} hasn't added a Privacy Policy page yet.</p>
        )}
      </div>
    </div>
  )
}
