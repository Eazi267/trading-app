// The login session lives in an HttpOnly cookie: page scripts (including any
// injected by an attacker) cannot read it, unlike a token kept in localStorage.
export const COOKIE_NAME = 'pulse_session'
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // same 7 days as the token itself

function sameSite() {
  const v = String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase()
  return ['lax', 'strict', 'none'].includes(v) ? v : 'lax'
}

function cookieString(value, maxAge) {
  const ss = sameSite()
  // SameSite=None (site and API on different domains) is only accepted by
  // browsers together with Secure, i.e. HTTPS.
  const secure = process.env.NODE_ENV === 'production' || ss === 'none'
  return [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${ss.charAt(0).toUpperCase() + ss.slice(1)}`,
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : ''
  ].filter(Boolean).join('; ')
}

export function setAuthCookie(res, token) {
  res.append('Set-Cookie', cookieString(token, MAX_AGE_SECONDS))
}
export function clearAuthCookie(res) {
  res.append('Set-Cookie', cookieString('', 0))
}

export function readAuthCookie(req) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > -1 && part.slice(0, i).trim() === COOKIE_NAME) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

// Browsers attach cookies automatically, even to requests a hostile website
// triggers. So for cookie-authenticated requests that change data we also
// require a custom header: a foreign website cannot add it without our CORS
// allow-list approving it first.
export const CSRF_HEADER = 'x-requested-with'
export const CSRF_VALUE = 'pulse'
