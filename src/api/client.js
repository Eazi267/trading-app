const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const TOKEN_KEY = 'pulse_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

// The one place every request to the backend goes through — attaches
// the bearer token automatically, parses the JSON body, and turns a
// non-2xx response into the same `{ error }` shape every
// AuthContext/AppContext function already returns on failure, so
// call sites don't need to know whether a failure came from
// validation or the network.
export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch {
    return { error: "Can't reach the server. Check your connection and that the backend is running." }
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // No JSON body (e.g. a 204) — fine for some endpoints, handled below.
  }

  if (!response.ok) {
    return { error: data?.error || `Request failed (${response.status}).` }
  }
  return data || {}
}
