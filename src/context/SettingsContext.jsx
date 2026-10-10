import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { LineChart, TrendingUp, Zap, Activity, BarChart3, Shield } from 'lucide-react'
import { BRAND as BRAND_DEFAULTS } from '../config/brand.js'
import { apiRequest } from '../api/client.js'
import { TIERS as DEFAULT_TIERS, VIP_TIERS as DEFAULT_VIP_TIERS, setTierConfig } from '../config/tiers.js'

const SettingsContext = createContext(null)

// localStorage is JSON, and JSON has no representation for Infinity
// (JSON.stringify(Infinity) silently becomes null) — but a tier's
// maxDeposit legitimately needs "no upper limit" (see Major VIP).
// These two functions are the only place that translation happens,
// so every other reader of settings.tiers/vipTiers just sees a
// normal JS Infinity, same as the original hardcoded config did.
const INFINITY_MARKER = '__INFINITY__'
function packTiers(tiers) {
  return tiers.map((t) => ({ ...t, maxDeposit: t.maxDeposit === Infinity ? INFINITY_MARKER : t.maxDeposit }))
}
function unpackTiers(tiers) {
  return tiers.map((t) => ({ ...t, maxDeposit: t.maxDeposit === INFINITY_MARKER ? Infinity : t.maxDeposit }))
}

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
  // Investment tiers — admin-editable in Business Settings ("Investment
  // Tiers"). Stored here (not just in config/tiers.js) so an admin's
  // edits persist and travel with the rest of the business config.
  // maxDeposit uses Infinity for "no upper limit" (see Major VIP) —
  // see packTiers/unpackTiers above for why that needs special
  // handling around localStorage specifically.
  tiers: DEFAULT_TIERS,
  vipTiers: DEFAULT_VIP_TIERS,

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

  // Which payment method a client can indicate they used — metadata
  // only, for the admin's own reconciliation. Deliberately does NOT
  // pair with any displayed wallet address or bank account on the
  // platform: real payment coordination happens through the
  // account manager's own channels, off-platform. Showing a
  // company-controlled receiving address here would recreate the
  // exact "send funds to this address, we'll manually credit you"
  // mechanic this project has avoided from day one — a deposit is
  // approved the same way regardless of method, based on the
  // admin's own verification outside this app, not on anything this
  // app can confirm.
  depositMethods: { usdt: true, btc: true, bank: true },

  // Per crypto-method + per-network reference info shown as a card
  // beneath the payment method picker on the client Deposit tab —
  // admin-authored free text only (e.g. "here's what a real
  // USDT-TRC20 contract address looks like, don't send to
  // lookalikes", network-specific warnings, fee notes). Deliberately
  // NOT a company receiving address — see the depositMethods comment
  // above for why Pulse never displays one. Keyed by method then
  // chain name (e.g. cryptoDepositInfo.usdt['TRC20 (Tron)']); methods
  // with no chain concept (bank) don't use this.
  cryptoDepositInfo: {},

  withdrawalMin: 10,
  withdrawalMax: 100000,
  withdrawalInstructions: '',

  // Which withdrawal methods a client can choose from. Bank requires
  // enhanced verification (see user.kycEnhanced) regardless of this
  // toggle — turning bank on here just makes it a choice; the
  // enhanced-KYC check still gates any individual client from
  // actually using it. Crypto methods don't move real crypto (no
  // broker/exchange integration exists) — a client just provides
  // their destination address, and the admin fulfills manually off
  // platform, same as every other withdrawal.
  withdrawalMethods: { usdt: true, btc: true, bank: false },

  // Automatic blockchain verification — OFF by default, and turning
  // it on doesn't make deposits actually verify yet (see
  // src/services/blockchainVerification.js for why). This just
  // records the intent + provider details so the switch is real
  // infrastructure the moment a backend exists, not a UI mockup.
  blockchainVerificationEnabled: false,
  blockchainProviderName: '',

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

// Turns whatever the server stored (or a cached copy of it) into a full
// settings object: defaults first, server values on top, tiers unpacked
// back to real Infinity values.
function hydrate(stored) {
  if (!stored || Object.keys(stored).length === 0) return DEFAULT_SETTINGS
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    tiers: stored.tiers ? unpackTiers(stored.tiers) : DEFAULT_SETTINGS.tiers,
    vipTiers: stored.vipTiers ? unpackTiers(stored.vipTiers) : DEFAULT_SETTINGS.vipTiers
  }
}

// Settings now live in the DATABASE (the server is the source of truth,
// so every browser/device sees the same brand, tiers, deposit info, and
// — importantly — the same investment mode the backend itself reads).
// localStorage only keeps a read-only CACHE of the last server copy so
// the brand name/logo don't flash the defaults on page load.
const CACHE_KEY = 'pulse_settings_cache'

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      return cached ? hydrate(JSON.parse(cached)) : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })
  const [saveError, setSaveError] = useState(null)
  const pendingSaves = useRef(0)

  const refreshSettings = useCallback(async () => {
    // Don't let a background refetch overwrite an edit that's still being saved.
    if (pendingSaves.current > 0) return
    const result = await apiRequest('/api/settings', { auth: false })
    if (!result.settings) return
    setSettings(hydrate(result.settings))
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(result.settings)) } catch { /* cache only */ }
  }, [])

  // Load on mount, and again whenever the tab regains focus (so a change
  // made by an admin on another device shows up without a manual reload).
  useEffect(() => {
    refreshSettings()
    const onVisible = () => { if (document.visibilityState === 'visible') refreshSettings() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshSettings])

  // Auto-clear the error toast after a few seconds.
  useEffect(() => {
    if (!saveError) return
    const id = setTimeout(() => setSaveError(null), 6000)
    return () => clearTimeout(id)
  }, [saveError])

  // Pushes whatever tier list is currently in settings (admin-edited
  // or still the defaults) into config/tiers.js's live bindings — see
  // that file's top comment for why this is the one place this needs
  // to happen for the whole app to pick up the change.
  useEffect(() => {
    setTierConfig(settings.tiers, settings.vipTiers)
  }, [settings.tiers, settings.vipTiers])

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

  // Sends ONLY the changed keys; the server shallow-merges them (and
  // requires the manageSettings permission + writes an audit entry).
  // The screen updates instantly (optimistic); if the server refuses,
  // we show why and re-sync with what the server really has.
  async function saveToServer(updates) {
    const payload = { ...updates }
    if (payload.tiers) payload.tiers = packTiers(payload.tiers)
    if (payload.vipTiers) payload.vipTiers = packTiers(payload.vipTiers)

    pendingSaves.current += 1
    const result = await apiRequest('/api/settings', { method: 'PUT', body: payload })
    pendingSaves.current -= 1

    if (result.error) {
      setSaveError(result.error)
      await refreshSettings()
      return { error: result.error }
    }
    if (pendingSaves.current === 0 && result.settings) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(result.settings)) } catch { /* cache only */ }
    }
    return { ok: true }
  }

  function updateSettings(updates) {
    setSettings((prev) => ({ ...prev, ...updates }))
    return saveToServer(updates)
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS)
    return saveToServer(DEFAULT_SETTINGS)
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
      {saveError && (
        <div role="alert" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 9999, maxWidth: '90vw', padding: '10px 16px', borderRadius: 10, background: '#7f1d1d', color: '#fff', fontSize: 13, boxShadow: '0 6px 24px rgba(0,0,0,.35)' }}>
          Couldn't save settings: {saveError}
        </div>
      )}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}
