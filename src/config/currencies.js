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
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rateFromUsd: 1.36 },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', rateFromUsd: 1.64 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', rateFromUsd: 83 },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', rateFromUsd: 278 },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', rateFromUsd: 120 },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', rateFromUsd: 58 },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', rateFromUsd: 15800 },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', rateFromUsd: 25400 },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', rateFromUsd: 35 },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', rateFromUsd: 4.7 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', rateFromUsd: 1.35 },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', rateFromUsd: 7.8 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', rateFromUsd: 7.25 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', rateFromUsd: 5.4 },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', rateFromUsd: 18.5 },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso', rateFromUsd: 4100 },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', rateFromUsd: 990 },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', rateFromUsd: 49 },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham', rateFromUsd: 9.7 },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', rateFromUsd: 34 },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty', rateFromUsd: 4.0 },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', rateFromUsd: 0.88 },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', rateFromUsd: 10.6 },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', rateFromUsd: 10.8 },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', rateFromUsd: 6.9 },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', rateFromUsd: 3.7 },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', rateFromUsd: 3.67 },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', rateFromUsd: 3.75 },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', rateFromUsd: 3700 },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', rateFromUsd: 2600 },
  { code: 'RWF', symbol: 'RF', name: 'Rwandan Franc', rateFromUsd: 1300 },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr', rateFromUsd: 123 },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc', rateFromUsd: 610 }
]

// Currencies typically shown with no decimal places (low unit value —
// nobody quotes NGN or IDR to the kobo/sen in everyday use).
const NO_DECIMAL_CURRENCIES = new Set(['JPY', 'NGN', 'KES', 'IDR', 'VND', 'UGX', 'TZS', 'RWF', 'XOF', 'COP'])

// Matches the COUNTRIES list below — kept as a simple fixed lookup
// rather than a geo/IP service, since there's no backend to call one
// from and the country is already a field the client sets themselves
// (see guessCountryFromTimezone for the closest honest equivalent to
// auto-detection this architecture can offer without one).
export const COUNTRY_CURRENCY = {
  Nigeria: 'NGN',
  'United States': 'USD',
  'United Kingdom': 'GBP',
  Canada: 'CAD',
  'South Africa': 'ZAR',
  Ghana: 'GHS',
  Kenya: 'KES',
  Uganda: 'UGX',
  Tanzania: 'TZS',
  Rwanda: 'RWF',
  Ethiopia: 'ETB',
  Senegal: 'XOF',
  "Côte d'Ivoire": 'XOF',
  Germany: 'EUR',
  France: 'EUR',
  Spain: 'EUR',
  Italy: 'EUR',
  Netherlands: 'EUR',
  Ireland: 'EUR',
  Portugal: 'EUR',
  Belgium: 'EUR',
  Austria: 'EUR',
  Poland: 'PLN',
  Switzerland: 'CHF',
  Sweden: 'SEK',
  Norway: 'NOK',
  Denmark: 'DKK',
  Turkey: 'TRY',
  Australia: 'AUD',
  'New Zealand': 'NZD',
  Japan: 'JPY',
  China: 'CNY',
  'Hong Kong': 'HKD',
  India: 'INR',
  Pakistan: 'PKR',
  Bangladesh: 'BDT',
  Philippines: 'PHP',
  Indonesia: 'IDR',
  Vietnam: 'VND',
  Thailand: 'THB',
  Malaysia: 'MYR',
  Singapore: 'SGD',
  'United Arab Emirates': 'AED',
  'Saudi Arabia': 'SAR',
  Israel: 'ILS',
  Egypt: 'EGP',
  Morocco: 'MAD',
  Brazil: 'BRL',
  Mexico: 'MXN',
  Colombia: 'COP',
  Argentina: 'ARS',
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
  const decimals = NO_DECIMAL_CURRENCIES.has(currency.code) ? 0 : 2
  return currency.symbol + converted.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// Best-guess country for a new signup, from the browser's own IANA
// timezone (Intl.DateTimeFormat) — not a geo-IP lookup. This is a
// deliberate choice, not a shortcut: an IP-geolocation service needs
// a backend to call it from (this app doesn't have one) and a paid
// API key, and silently guessing someone's location from their IP
// without asking is a heavier privacy move than reading a value the
// browser already exposes with no permission prompt. The result is
// always just a prefilled default on the signup form — the client
// sees their real country selected and can change it in one click
// before submitting, same as if they'd picked it themselves.
const TIMEZONE_COUNTRY = {
  'Africa/Lagos': 'Nigeria',
  'Africa/Johannesburg': 'South Africa',
  'Africa/Accra': 'Ghana',
  'Africa/Nairobi': 'Kenya',
  'Africa/Kampala': 'Uganda',
  'Africa/Dar_es_Salaam': 'Tanzania',
  'Africa/Kigali': 'Rwanda',
  'Africa/Addis_Ababa': 'Ethiopia',
  'Africa/Dakar': 'Senegal',
  'Africa/Abidjan': "Côte d'Ivoire",
  'Africa/Cairo': 'Egypt',
  'Africa/Casablanca': 'Morocco',
  'America/New_York': 'United States',
  'America/Chicago': 'United States',
  'America/Denver': 'United States',
  'America/Los_Angeles': 'United States',
  'America/Anchorage': 'United States',
  'Pacific/Honolulu': 'United States',
  'America/Toronto': 'Canada',
  'America/Vancouver': 'Canada',
  'America/Edmonton': 'Canada',
  'America/Winnipeg': 'Canada',
  'America/Halifax': 'Canada',
  'America/Sao_Paulo': 'Brazil',
  'America/Mexico_City': 'Mexico',
  'America/Bogota': 'Colombia',
  'America/Argentina/Buenos_Aires': 'Argentina',
  'Europe/London': 'United Kingdom',
  'Europe/Berlin': 'Germany',
  'Europe/Paris': 'France',
  'Europe/Madrid': 'Spain',
  'Europe/Rome': 'Italy',
  'Europe/Amsterdam': 'Netherlands',
  'Europe/Dublin': 'Ireland',
  'Europe/Lisbon': 'Portugal',
  'Europe/Brussels': 'Belgium',
  'Europe/Vienna': 'Austria',
  'Europe/Warsaw': 'Poland',
  'Europe/Zurich': 'Switzerland',
  'Europe/Stockholm': 'Sweden',
  'Europe/Oslo': 'Norway',
  'Europe/Copenhagen': 'Denmark',
  'Europe/Istanbul': 'Turkey',
  'Asia/Kolkata': 'India',
  'Asia/Calcutta': 'India',
  'Asia/Karachi': 'Pakistan',
  'Asia/Dhaka': 'Bangladesh',
  'Asia/Manila': 'Philippines',
  'Asia/Jakarta': 'Indonesia',
  'Asia/Ho_Chi_Minh': 'Vietnam',
  'Asia/Bangkok': 'Thailand',
  'Asia/Kuala_Lumpur': 'Malaysia',
  'Asia/Singapore': 'Singapore',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Shanghai': 'China',
  'Asia/Tokyo': 'Japan',
  'Asia/Dubai': 'United Arab Emirates',
  'Asia/Riyadh': 'Saudi Arabia',
  'Asia/Jerusalem': 'Israel',
  'Asia/Tel_Aviv': 'Israel',
  'Australia/Sydney': 'Australia',
  'Australia/Melbourne': 'Australia',
  'Australia/Brisbane': 'Australia',
  'Australia/Perth': 'Australia',
  'Australia/Adelaide': 'Australia',
  'Pacific/Auckland': 'New Zealand'
}

export function guessCountryFromTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return TIMEZONE_COUNTRY[tz] || null
  } catch {
    return null // Intl unsupported/unavailable — caller falls back to its own default
  }
}
