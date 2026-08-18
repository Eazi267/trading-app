import { createContext, useContext, useState, useEffect } from 'react'
import { LineChart, TrendingUp, Zap, Activity, BarChart3, Shield } from 'lucide-react'
import { BRAND as BRAND_DEFAULTS } from '../config/brand.js'

const SettingsContext = createContext(null)

// Derives the --accent-dark/--accent-bright/--accent-bg shades from
// one admin-picked hex, the same four variables every preset accent
// (ember/rose/amber/sky in index.css) already defines. Simple
// lighten/darken by mixing toward white/black — good enough for a
// UI accent, not meant to be perceptually precise.
function shade(hex, percent) {
  const num = parseInt(hex.slice(1), 16)
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255
  const mix = (channel) => Math.round(percent > 0 ? channel + (255 - channel) * percent : channel * (1 + percent))
  return `#${[mix(r), mix(g), mix(b)].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`
}

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
  // A real uploaded image (data URL), separate from the preset
  // logoIconKey above — if set, this takes visual priority. Kept
  // optional so a deployment can still just pick a preset icon
  // instead of uploading a file.
  logoImageDataUrl: null,
  faviconDataUrl: null,

  // Company info — shown on public pages (About, footer, contact)
  // and used for the <title>/meta description. Purely descriptive,
  // nothing here touches money or account logic.
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  metaTitle: '',
  metaDescription: '',

  // Signup bonus — a one-time, capped, real transaction (type
  // 'signup_bonus') granted once per real (non-demo) client, same
  // pattern as the existing referral bonus. NOT an editable balance
  // field — see AppContext's signup-bonus effect, which writes an
  // actual transaction the same way every other credit does.
  signupBonusEnabled: false,
  signupBonusAmount: 0,

  // Platform display currency — cosmetic only (symbol + code shown
  // throughout the UI). All amounts are still stored and calculated
  // in USD under the hood; this does NOT do currency conversion.
  // That's a deliberate scope line: a real conversion feature would
  // need live FX rates and a decision about which rate applies to
  // historical transactions, which is a bigger feature than a
  // display setting. Flagging so it's not assumed to be doing more
  // than it is.
  currencyCode: 'USD',
  currencySymbol: '$',

  // Deposit/withdrawal setup — min/max bounds enforced wherever a
  // client submits one (Transactions.jsx), plus instructional copy
  // shown alongside the form. Doesn't touch approval logic.
  depositMin: 10,
  depositMax: 100000,
  depositInstructions: '',
  withdrawalMin: 10,
  withdrawalMax: 100000,
  withdrawalInstructions: '',

  // Email sending — OFF by default. This is a genuine kill switch,
  // not a provider selector: some buyers already run a separate
  // system (CRM, helpdesk, their own mailer) for client email and
  // don't want Pulse also trying to send and creating duplicates.
  // Even when ON, no real email leaves the building yet — see
  // src/services/email.js for why (no backend to hold provider
  // credentials safely). This only controls whether the simulated
  // Outbox logs entries as "would have sent" vs "skipped, disabled".
  emailSendingEnabled: false,
  // Each real deployment needs to send from ITS OWN domain, not a
  // shared Pulse-owned one — otherwise SPF/DKIM/DMARC checks fail
  // and the email gets flagged as spoofed, and it looks exactly like
  // the scam pattern this project exists to avoid. Stored now,
  // meaningful once a real provider is wired to the backend.
  emailFromName: '',
  emailFromAddress: '',

  // Welcome email template — content only. Real delivery goes
  // through sendEmail() (see src/services/email.js), gated by
  // emailSendingEnabled above. Supports {{name}} in the body.
  welcomeEmailSubject: 'Welcome!',
  welcomeEmailBody: '',

  // Help page Q&A — a plain array of { id, question, answer }.
  helpQA: [],

  // Raw HTML content pages — rendered with dangerouslySetInnerHTML
  // on their public pages. Admin-authored only (this form isn't
  // exposed to clients), same trust boundary as an admin already
  // having full account-management access.
  aboutUsHtml: '',
  privacyPolicyHtml: '',

  // Custom primary accent color (hex) — separate from the existing
  // preset accent swatches in Configurator.jsx. If set, overrides
  // the preset for a more precise brand-color match.
  customPrimaryColor: null,

  // Investment mode — controls what happens when a CLIENT commits to
  // a session themselves. 'direct': funds commit and the session
  // starts immediately (original behavior). 'managed': funds still
  // leave the main balance right away (see getBalanceBreakdown's
  // `pending` calc, which already counts 'awaiting_start' sessions
  // the same as 'active' ones), but the timer doesn't begin — the
  // session sits in 'awaiting_start' until an admin explicitly
  // begins it via beginAwaitingSession(). Admin-initiated sessions
  // (from AdminUserDetail) always start immediately regardless of
  // this setting — the admin IS the human-in-the-loop already.
  investmentMode: 'direct',

  // KYC status — Off means no verification is requested from
  // clients at all. On means the client-facing KYC page and upload
  // flow are active, gated by the two settings below.
  kycEnabled: false,
  // Which document types a client is allowed to submit — a client
  // picks one of these when uploading. Kept as an array so more
  // types (e.g. driver's license) can be added later without a
  // schema change.
  kycAcceptedDocumentTypes: ['passport', 'id'],
  // Whether a back-side image is required. Only actually asked for
  // when the chosen document type has a meaningful back side — a
  // passport's photo page is the whole document, so this never
  // applies to 'passport' regardless of this setting; it only
  // affects 'id' (and any future two-sided document type).
  kycRequireBackSide: true,

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

  // Overrides the four accent CSS variables directly on the root
  // element when a custom color is set — inline style on the element
  // beats the [data-accent="x"] attribute-selector rules in
  // index.css, so this correctly takes priority over whichever
  // preset swatch is also selected in Configurator.jsx. Clearing the
  // setting removes the inline overrides, falling back to the preset.
  useEffect(() => {
    const root = document.documentElement
    if (settings.customPrimaryColor) {
      root.style.setProperty('--accent', settings.customPrimaryColor)
      root.style.setProperty('--accent-bright', shade(settings.customPrimaryColor, 0.2))
      root.style.setProperty('--accent-dark', shade(settings.customPrimaryColor, -0.2))
      root.style.setProperty('--accent-bg', shade(settings.customPrimaryColor, -0.85))
    } else {
      ;['--accent', '--accent-bright', '--accent-dark', '--accent-bg'].forEach((v) => root.style.removeProperty(v))
    }
  }, [settings.customPrimaryColor])

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
    LogoIcon: LOGO_ICONS[settings.logoIconKey] || LineChart,
    logoImageDataUrl: settings.logoImageDataUrl
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
