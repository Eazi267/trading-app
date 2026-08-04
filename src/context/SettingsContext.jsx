import { createContext, useContext, useState, useEffect } from 'react'
import { LineChart, TrendingUp, Zap, Activity, BarChart3, Shield } from 'lucide-react'
import { BRAND as BRAND_DEFAULTS } from '../config/brand.js'

const SettingsContext = createContext(null)

// Preset icon choices an admin can pick from without touching code.
// Keyed by string since a React component can't be stored in
// localStorage/JSON directly.
export const LOGO_ICONS = {
  LineChart, TrendingUp, Zap, Activity, BarChart3, Shield
}

const DEFAULT_SETTINGS = {
  brandName: BRAND_DEFAULTS.name,
  brandTagline: BRAND_DEFAULTS.tagline,
  logoIconKey: 'LineChart',
  // Feature toggles — this is the actual "differentiate one
  // installation from another" mechanism. Everything defaults to
  // matching current behavior (nothing changes for an existing
  // install) — a buyer turns things off deliberately, nothing is
  // silently hidden.
  showReferrals: true,
  showVipTiers: true,
  // The bulk demo-client generator exists for YOUR OWN sales demos.
  // It's safe by design (generated accounts are tagged and excluded
  // from every real financial flow), but a real account manager
  // running this for real clients shouldn't have a "generate fake
  // accounts" button sitting in their production admin panel by
  // default — so this is the one toggle that's worth turning off
  // once a deployment goes live with real clients.
  demoModeEnabled: true
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('pulse_business_settings')
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
  })

  useEffect(() => {
    localStorage.setItem('pulse_business_settings', JSON.stringify(settings))
  }, [settings])

  function updateSettings(updates) {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS)
  }

  // Shaped exactly like the old static BRAND export, so components
  // that just need name/tagline/icon can swap `BRAND.x` for
  // `brand.x` with minimal changes.
  const brand = {
    name: settings.brandName,
    tagline: settings.brandTagline,
    LogoIcon: LOGO_ICONS[settings.logoIconKey] || LineChart
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, brand }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}
