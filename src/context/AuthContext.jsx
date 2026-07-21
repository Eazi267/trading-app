import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

const SEED_USERS = [
  { id: 1, name: 'Demo Trader', email: 'trader@pulse.app', password: 'trader123', role: 'user', referralCode: 'TRADER01', referredBy: null, createdAt: new Date().toISOString(), tier: 'tier1', flaggedForReview: false, vipUnlocked: null },
  { id: 2, name: 'Demo Admin', email: 'admin@pulse.app', password: 'admin123', role: 'admin', referralCode: 'ADMIN01', referredBy: null, createdAt: new Date().toISOString(), tier: null, flaggedForReview: false, vipUnlocked: null }
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

// Plausible-looking names/emails for the demo client generator below.
// Not tied to any real person — just a pool to draw from.
const DEMO_FIRST_NAMES = ['Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas', 'Mia', 'Elijah', 'Amelia', 'James', 'Harper', 'Benjamin', 'Evelyn', 'Henry', 'Abigail', 'Alexander', 'Ella', 'Sebastian', 'Scarlett', 'Jack', 'Grace', 'Owen', 'Chloe', 'Daniel', 'Victoria', 'Matthew', 'Riley', 'Samuel', 'Zoey', 'David', 'Lily', 'Joseph', 'Hannah', 'Carter', 'Layla', 'Wyatt']
const DEMO_LAST_NAMES = ['Bennett', 'Carter', 'Diaz', 'Evans', 'Foster', 'Grant', 'Hayes', 'Ibrahim', 'Jensen', 'Kelly', 'Lawson', 'Mitchell', 'Nguyen', 'Ortiz', 'Parker', 'Quinn', 'Reyes', 'Sullivan', 'Turner', 'Underwood', 'Vance', 'Walsh', 'Xu', 'Young', 'Zimmerman', 'Abbott', 'Brooks', 'Chavez', 'Dawson', 'Ellis']
const DEMO_EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'proton.me']

function randomDemoName() {
  const first = DEMO_FIRST_NAMES[Math.floor(Math.random() * DEMO_FIRST_NAMES.length)]
  const last = DEMO_LAST_NAMES[Math.floor(Math.random() * DEMO_LAST_NAMES.length)]
  return `${first} ${last}`
}

function demoEmailFor(name, existingUsers) {
  const domain = DEMO_EMAIL_DOMAINS[Math.floor(Math.random() * DEMO_EMAIL_DOMAINS.length)]
  const base = name.toLowerCase().replace(/[^a-z]+/g, '.')
  let suffix = ''
  let n = 1
  while (existingUsers.some((u) => u.email.toLowerCase() === `${base}${suffix}@${domain}`)) {
    suffix = String(n)
    n += 1
  }
  return `${base}${suffix}@${domain}`
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

  // Admin-only: unlocks a hidden VIP tier for self-service on the
  // client's own Sessions page. This is separate from `tier` (their
  // current default assignment) — vipUnlocked just adds an extra
  // tier CARD they're allowed to pick, it doesn't remove the standard
  // three. Set to null to revoke access again.
  function setClientVip(userId, vipTierId) {
    const nextUsers = users.map((u) => (u.id === userId ? { ...u, vipUnlocked: vipTierId } : u))
    persistUsers(nextUsers)
    if (currentUser?.id === userId) {
      const next = { ...currentUser, vipUnlocked: vipTierId }
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

  // ADMIN-ONLY, demo tool. Creates `count` real client accounts with
  // plausible names/emails. No balance or trade history is set here —
  // this only creates the account, exactly like a real signup would
  // (no tier, no transactions). Tagged `isDemoGenerated: true` so it
  // can always be told apart from a genuine client and safely bulk-
  // removed later (see removeDemoClients) without any risk of ever
  // touching a real account. Financial activity is a separate step —
  // see AppContext.generateDemoActivity — built from real deposits and
  // sessions that run through the same settlement math as everything
  // else, not typed-in balances.
  function generateDemoClients(count) {
    if (!count || count <= 0) return { error: 'Enter a number of clients above zero.' }
    if (count > 200) return { error: 'Generate at most 200 at a time.' }

    const created = []
    let working = [...users]
    for (let i = 0; i < count; i++) {
      const name = randomDemoName()
      const email = demoEmailFor(name, working)
      const daysAgo = Math.floor(Math.random() * 90)
      const newUser = {
        id: Date.now() + i,
        name,
        email,
        password: Math.random().toString(36).slice(2, 10),
        role: 'user',
        referralCode: generateReferralCode(name, working),
        referredBy: null,
        createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        tier: null,
        flaggedForReview: false,
        vipUnlocked: null,
        isDemoGenerated: true
      }
      working = [...working, newUser]
      created.push(newUser)
    }
    persistUsers(working)
    return { users: created }
  }

  // Removes every account ever created by generateDemoClients — real
  // accounts (no isDemoGenerated flag) are never touched, regardless
  // of how this is called. Returns the removed ids so the caller can
  // also purge their transactions/sessions/orders in AppContext.
  function removeDemoClients() {
    const removedIds = users.filter((u) => u.isDemoGenerated).map((u) => u.id)
    persistUsers(users.filter((u) => !u.isDemoGenerated))
    return removedIds
  }

  return (
    <AuthContext.Provider value={{ currentUser, users, login, signup, logout, updateProfile, changePassword, getReferrals, setUserTier, setClientVip, flagForReview, getFlaggedUsers, generateDemoClients, removeDemoClients }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}