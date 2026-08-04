import { useState } from 'react'
import { Building2, RotateCcw } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useSettings, LOGO_ICONS } from '../context/SettingsContext.jsx'

export default function AdminBusinessSettings() {
  const { settings, updateSettings, resetSettings } = useSettings()

  const [brandName, setBrandName] = useState(settings.brandName)
  const [brandTagline, setBrandTagline] = useState(settings.brandTagline)
  const [saved, setSaved] = useState(false)

  function handleSaveBrand() {
    updateSettings({ brandName: brandName.trim() || settings.brandName, brandTagline: brandTagline.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Layout pageTitle="Business Settings">
      <h1 className="page-title">Business Settings</h1>
      <p className="page-sub">
        These settings are what make one deployment of this platform different from another — brand identity
        and which features are turned on, all without touching any code.
      </p>

      <div className="panel" style={{ marginBottom: 16, maxWidth: 600 }}>
        <div className="panel-head"><h3><Building2 size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Brand identity</h3></div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Business name
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Tagline (shown on the public homepage and login screen)
            <input
              type="text"
              value={brandTagline}
              onChange={(e) => setBrandTagline(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </label>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Logo mark</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(LOGO_ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  onClick={() => updateSettings({ logoIconKey: key })}
                  className="tx-btn"
                  style={{
                    width: 42, height: 42, flex: 'none', padding: 0,
                    background: settings.logoIconKey === key ? 'var(--accent-bright)' : 'var(--bg)',
                    border: '1px solid ' + (settings.logoIconKey === key ? 'var(--accent-bright)' : 'var(--border)'),
                    color: settings.logoIconKey === key ? '#fff' : 'var(--text)'
                  }}
                  aria-label={key}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13, flex: 'none' }} onClick={handleSaveBrand}>
              Save brand identity
            </button>
            {saved && <span style={{ marginLeft: 10, fontSize: 12.5, color: 'var(--success)' }}>Saved.</span>}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16, maxWidth: 600 }}>
        <div className="panel-head"><h3>Feature toggles</h3></div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.showReferrals}
              onChange={(e) => updateSettings({ showReferrals: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ fontSize: 13.5 }}>Referral program</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Client referral links, bonus campaigns, and the Referrals nav link.</div>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.showVipTiers}
              onChange={(e) => updateSettings({ showVipTiers: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ fontSize: 13.5 }}>VIP tiers</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hidden higher tiers an admin can unlock for specific clients.</div>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.demoModeEnabled}
              onChange={(e) => updateSettings({ demoModeEnabled: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ fontSize: 13.5 }}>Demo mode (Generate Demo Clients tool)</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Only useful for your own sales presentations. Turn this off once you're onboarding real clients —
                a live customer-facing deployment shouldn't have a "generate fake accounts" button available.
              </div>
            </span>
          </label>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 600 }}>
        <div className="panel-head"><h3>Reset</h3></div>
        <div style={{ padding: '16px 20px' }}>
          <button
            className="tx-btn withdraw"
            style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => { resetSettings(); setBrandName(settings.brandName); setBrandTagline(settings.brandTagline) }}
          >
            <RotateCcw size={14} /> Reset to defaults
          </button>
        </div>
      </div>
    </Layout>
  )
}
