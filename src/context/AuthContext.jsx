import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

const SEED_USERS = [
  { id: 1, name: 'Demo Trader', email: 'trader@pulse.app', password: 'trader123', role: 'user', referralCode: 'TRADER01', referredBy: null, createdAt: new Date().toISOString(), tier: 'tier1', flaggedForReview: false },
  { id: 2, name: 'Demo Admin', email: 'admin@pulse.app', password: 'admin123', role: 'admin', referralCode: 'ADMIN01', referredBy: null, createdAt: new Date().toISOString(), tier: null, flaggedForReview: false }
]

function loadUsers() {
  const saved = localStorage.getItem('pulse_users')
  if (saved) return JSON.parse(saved)
  localStorage.setItem('pulse_users', JSON.stringify(SEED_USERS))
  return SEED_USERS
}

function loadProfiles() {
  const saved = localStorage.getItem('pulse_profiles')
  return saved ? JSON.parse(saved) : {}
}

// Merges a user's login record with any saved profile edits
// (name/email/phone/country/avatar) so the account "remembers" you.
function mergeProfile(user) {
  const profiles = loadProfiles()
  return { ...user, ...(profiles[user.id] || {}) }
}

// Initials + random 4 chars, re-rolled until it's unique among existing users.
function generateReferralCode(name, existingUsers) {
  const initials = (name || 'USR').trim().split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 3) || 'USR'
  let code
  do {
    const random = Math.random().toString(36).slice(2, 6).toUpperCase()
    code = `${initials}${random}`
  } while (existingUsers.some((u) => u.referralCode === code))
  return code
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(loadUsers)
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pulse_current_user')
    return saved ? JSON.parse(saved) : null
  })

  function persistUsers(next) {
    setUsers(next)
    localStorage.setItem('pulse_users', JSON.stringify(next))
  }

  function login(email, password) {
    const match = users.find(
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

  // No tier is assigned at signup anymore — a client picks a tier for
  // real once they've actually deposited and start a session (see
  // AppContext.startSession). This just creates the account.
  function signup({ name, email, password, referralCodeUsed }) {
    const emailTaken = users.some((u) => u.email.toLowerCase() === email.toLowerCase())
    if (emailTaken) return { error: 'An account with that email already exists.' }

    const referrer = referralCodeUsed
      ? users.find((u) => u.referralCode.toLowerCase() === referralCodeUsed.toLowerCase())
      : null

    const newUser = {
      id: Date.now(),
      name,
      email,
      password,
      role: 'user',
      referralCode: generateReferralCode(name, users),
      referredBy: referrer ? referrer.id : null,
      createdAt: new Date().toISOString(),
      tier: null,
      flaggedForReview: false
    }

    persistUsers([...users, newUser])
    setCurrentUser(newUser)
    localStorage.setItem('pulse_current_user', JSON.stringify(newUser))
    return { user: newUser }
  }

  // Admin can assign/change a client's tier directly (e.g. after
  // manually reviewing a flagged large account).
  function setUserTier(userId, tierId) {
    const nextUsers = users.map((u) =>
      u.id === userId ? { ...u, tier: tierId, flaggedForReview: false } : u
    )
    persistUsers(nextUsers)
    if (currentUser?.id === userId) {
      const next = { ...currentUser, tier: tierId, flaggedForReview: false }
      setCurrentUser(next)
      localStorage.setItem('pulse_current_user', JSON.stringify(next))
    }
  }

  // Marks an account for manual admin review (e.g. a real deposit
  // request came in above the large-account threshold). Does not
  // touch the tier — a human decides what happens next.
  function flagForReview(userId) {
    const nextUsers = users.map((u) => (u.id === userId ? { ...u, flaggedForReview: true } : u))
    persistUsers(nextUsers)
    if (currentUser?.id === userId) {
      const next = { ...currentUser, flaggedForReview: true }
      setCurrentUser(next)
      localStorage.setItem('pulse_current_user', JSON.stringify(next))
    }
  }

  function getFlaggedUsers() {
    return users.filter((u) => u.flaggedForReview)
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

  // Verifies the current password before allowing a change — basic
  // safeguard so anyone briefly at an unlocked session can't lock
  // the real owner out without knowing the existing password.
  function changePassword(currentPassword, newPassword) {
    if (currentUser.password !== currentPassword) {
      return { error: 'Current password is incorrect.' }
    }
    if (newPassword.length < 6) {
      return { error: 'New password must be at least 6 characters.' }
    }

    const nextUser = { ...currentUser, password: newPassword }
    setCurrentUser(nextUser)
    localStorage.setItem('pulse_current_user', JSON.stringify(nextUser))

    const nextUsers = users.map((u) => (u.id === currentUser.id ? { ...u, password: newPassword } : u))
    persistUsers(nextUsers)

    return { success: true }
  }

  function getReferrals(userId) {
    return users.filter((u) => u.referredBy === userId)
  }

  return (
    <AuthContext.Provider value={{ currentUser, users, login, signup, logout, updateProfile, changePassword, getReferrals, setUserTier, flagForReview, getFlaggedUsers }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}