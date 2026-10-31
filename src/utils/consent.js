// Cookie / browser-storage consent. Stored in this browser only.
//   essential: always true (sign-in session, remembering this very choice)
//   preferences: theme, colours, favourite pages/markets. Only saved when allowed.
const KEY = 'pulse_cookie_consent'
const EVENT = 'pulse:consent-changed'

export function getConsent() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch { return null }
}

export function saveConsent(preferences) {
  const value = { essential: true, preferences: !!preferences, at: new Date().toISOString(), v: 1 }
  try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* storage blocked: choice lasts this visit only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }))
  return value
}

// Until the person chooses, remembering preferences stays off (privacy by default).
export function preferencesAllowed() { return getConsent()?.preferences === true }

export function onConsentChange(fn) {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

// Delete saved preference items when someone withdraws permission.
const PREFERENCE_KEYS = ['pulse_theme', 'pulse_accent', 'pulse_fav_markets']
export function clearPreferenceStorage() {
  try {
    for (const k of PREFERENCE_KEYS) localStorage.removeItem(k)
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith('pulse_fav_tabs_')) localStorage.removeItem(k)
    }
  } catch { /* ignore */ }
}

export function openCookieSettings() { window.dispatchEvent(new CustomEvent('pulse:open-cookie-settings')) }
