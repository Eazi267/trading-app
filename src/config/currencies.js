// Currency support for Pulse is DISPLAY-ONLY. Every balance,
// transaction, and calculation in the app is stored and computed in
// USD — nothing here changes that. This module only answers "what
// would this USD amount look like in the client's own currency?" so
// a deposit/withdrawal form can show a helpful equivalent alongside
// the real number.
//
// Rates are approximate and fixed (not live), the same honesty
// tradeoff already made for EUR/USD and GBP/USD pricing elsewhere in
// this app (see AppContext's SIMULATED_SYMBOLS comment) — a real
// live-FX feed needs a backend and a paid/keyed data source. If
// precise conversion ever matters for something other than a UI
// hint, this is the place to swap in a real feed.

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', rateFromUsd: 1 },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', rateFromUsd: 1550 },
  { code: 'EUR', symbol: '€', name: 'Euro', rateFromUsd: 0.92 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rateFromUsd: 0.78 },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', rateFromUsd: 18.3 },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', rateFromUsd: 15.2 },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', rateFromUsd: 129 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rateFromUsd: 149 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rateFromUsd: 1.52 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rateFromUsd: 1.36 }
]

// Matches the fixed COUNTRIES list in Settings.jsx/Signup.jsx — kept
// as a simple lookup rather than a geo/IP service, since there's no
// backend to call one from and the country is already a field the
// client sets themselves.
export const COUNTRY_CURRENCY = {
  Nigeria: 'NGN',
  'United States': 'USD',
  'United Kingdom': 'GBP',
  Canada: 'CAD',
  'South Africa': 'ZAR',
  Ghana: 'GHS',
  Kenya: 'KES',
  Other: 'USD'
}

// Single source of truth for the country picker — Settings.jsx and
// Signup.jsx both import this instead of keeping their own copies,
// so the two forms can never drift out of sync with each other or
// with the currency map above.
export const COUNTRIES = Object.keys(COUNTRY_CURRENCY)

export function getCurrency(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0]
}

// The currency to show equivalents in for a given user: their own
// explicit preference first, then whatever their country maps to,
// then the site-wide default (admin-set in Business Settings),
// finally USD if nothing else applies.
export function resolveDisplayCurrency(user, siteDefaultCode) {
  if (user?.preferredCurrency) return getCurrency(user.preferredCurrency)
  if (user?.country && COUNTRY_CURRENCY[user.country]) return getCurrency(COUNTRY_CURRENCY[user.country])
  if (siteDefaultCode) return getCurrency(siteDefaultCode)
  return CURRENCIES[0]
}

export function convertFromUsd(amountUsd, currencyCode) {
  const currency = getCurrency(currencyCode)
  return amountUsd * currency.rateFromUsd
}

export function formatCurrency(amountUsd, currencyCode) {
  const currency = getCurrency(currencyCode)
  const converted = convertFromUsd(amountUsd, currencyCode)
  const decimals = currency.code === 'JPY' || currency.code === 'NGN' || currency.code === 'KES' ? 0 : 2
  return currency.symbol + converted.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
