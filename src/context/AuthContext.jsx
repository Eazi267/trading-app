import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export const DEMO_USERS = [
  { id: 1, name: 'Demo Trader', email: 'trader@pulse.app', password: 'trader123', role: 'user' },
  { id: 2, name: 'Demo Admin', email: 'admin@pulse.app', password: 'admin123', role: 'admin' }
]

function loadProfiles() {
  const saved = localStorage.getItem('pulse_profiles')
  return saved ? JSON.parse(saved) : {}
}

// Merges a demo user's login record with any saved profile edits
// (name/email/phone/country/avatar) so the account "remembers" you.
function mergeProfile(user) {
  const profiles = loadProfiles()
  return { ...user, ...(profiles[user.id] || {}) }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pulse_current_user')
    return saved ? JSON.parse(saved) : null
  })

  function login(email, password) {
    const match = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (match) {
      const merged = mergeProfile(match)
      setCurrentUser(merged)
      localStorage.setItem('pulse_current_user', JSON.stringify(merged))
      return merged
    }
    return null
  }

  function logout() {
    setCurrentUser(null)
    localStorage.removeItem('pulse_current_user')
  }

  // Saves edits to the active session AND to a permanent per-user
  // store, so changes survive logging out and back in.
  function updateProfile(updates) {
    setCurrentUser((prev) => {
      const next = { ...prev, ...updates }
      localStorage.setItem('pulse_current_user', JSON.stringify(next))

      const profiles = loadProfiles()
      profiles[prev.id] = { ...profiles[prev.id], ...updates }
      localStorage.setItem('pulse_profiles', JSON.stringify(profiles))

      return next
    })
  }

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}