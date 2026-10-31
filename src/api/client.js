// Where the API lives. Local development: http://localhost:4000 (the default).
// When the SERVER also serves the website (SERVE_FRONTEND=1) build with
// VITE_API_URL=same-origin so requests go to the same address as the page.
const RAW_API_URL = import.meta.env.VITE_API_URL
const API_URL = RAW_API_URL === 'same-origin' ? '' : (RAW_API_URL || 'http://localhost:4000')

// The login itself now lives in an HttpOnly cookie that the server sets: page
// scripts cannot read it, so a script injected by an attacker cannot steal the
// session. All the browser keeps is this harmless marker ("I think I'm logged
// in"), used only to decide whether to ask the server who you are.
const SESSION_MARKER_KEY = 'pulse_session'

// Older versions stored the real token here, readable by any script. Remove it
// (people just log in once more).
try { localStorage.removeItem('pulse_token') } catch { /* storage unavailable */ }

// Same names as before so the rest of the app is unchanged: getToken() now
// answers "is there a session?", setToken(x) marks one, setToken(null) ends it.
export function getToken() {
  try { return localStorage.getItem(SESSION_MARKER_KEY) } catch { return null }
}

export function setToken(token) {
  try {
    if (token === null) localStorage.removeItem(SESSION_MARKER_KEY)
    else localStorage.setItem(SESSION_MARKER_KEY, '1')
  } catch { /* storage unavailable */ }
  // An HttpOnly cookie can only be cleared by the server.
  if (token === null) {
    fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'pulse' } }).catch(() => {})
  }
}

// The one place every request to the backend goes through — sends the session
// cookie, adds the security header the server requires on cookie requests,
// parses the JSON body, and turns a non-2xx response into the same
// `{ error }` shape every AuthContext/AppContext function already returns on
// failure, so call sites don't need to know whether a failure came from
// validation or the network.
// A super admin can require an emailed code for some client actions. When the
// server answers "otpRequired", the website shows a small dialog (OtpHost), then
// repeats the SAME request with the code in the X-Otp-Code header. Call sites
// need no changes. Set by OtpHost; returns the typed code, or null if cancelled.
let otpHandler = null
export function setOtpHandler(fn) { otpHandler = fn }

async function sendOnce(path, method, body, otp) {
  const headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'pulse' }
  if (otp) headers['X-Otp-Code'] = otp
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch {
    // status 0 = the server never answered (network trouble), as opposed to a real "no".
    return { network: true }
  }
  let data = null
  try {
    data = await response.json()
  } catch {
    // No JSON body (e.g. a 204): fine for some endpoints, handled below.
  }
  return { response, data }
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  let otp = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { response, data, network } = await sendOnce(path, method, body, otp)
    if (network) return { error: "Can't reach the server. Check your connection and that the backend is running.", status: 0 }
    if (response.ok) return data || {}
    if (response.status === 403 && data?.otpRequired && otpHandler) {
      const typed = await otpHandler({ operation: data.operation, message: data.error, wrongCode: !!data.wrongCode })
      if (!typed) return { error: 'Cancelled: no code was entered, so nothing was changed.', status: 403, cancelled: true }
      otp = typed
      continue
    }
    return { error: data?.error || `Request failed (${response.status}).`, status: response.status }
  }
  return { error: 'Too many wrong codes. Start again to get a new one.', status: 403 }
}
