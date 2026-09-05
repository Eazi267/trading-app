import { createContext, useContext, useState } from 'react'
import { useAudit } from './AuditContext.jsx'
import { useEmail, fillTemplate } from './EmailContext.jsx'
import { useSettings } from './SettingsContext.jsx'
import { COUNTRY_CURRENCY } from '../config/currencies.js'
import { ADMIN_TIERS } from '../config/adminTiers.js'

const AuthContext = createContext(null)

const SEED_USERS = [
  { id: 1, name: 'Demo Trader', email: 'trader@pulse.app', password: 'trader123', role: 'user', uid: '100000001', referralCode: 'TRADER01', referredBy: null, createdAt: new Date().toISOString(), tier: 'tier1', flaggedForReview: false, vipUnlocked: null },
  { id: 2, name: 'Demo Admin', email: 'admin@pulse.app', password: 'admin123', role: 'admin', adminTier: 'super_admin', uid: '100000002', referralCode: 'ADMIN01', referredBy: null, createdAt: new Date().toISOString(), tier: null, flaggedForReview: false, vipUnlocked: null }
]

function loadUsers() {
  const saved = localStorage.getItem('pulse_users')
  if (!saved) {
    localStorage.setItem('pulse_users', JSON.stringify(SEED_USERS))
    return SEED_USERS
  }
  const parsed = JSON.parse(saved)
  // Backfill for accounts created before uid existed — every user
  // needs one, not just accounts created going forward.
  if (parsed.some((u) => !u.uid)) {
    const withUids = parsed.map((u) => (u.uid ? u : { ...u, uid: generateUid(parsed) }))
    localStorage.setItem('pulse_users', JSON.stringify(withUids))
    return withUids
  }
  return parsed
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

// A unique, alternate login credential — separate from email, never
// changes, and usable in place of it (see login() below). Purely
// numeric and fixed-length on purpose: unlike an email, it can be
// read aloud over a support call or written on a note without any
// ambiguity about formatting. Not offered as a visible login option
// anywhere in the UI (Login.jsx never mentions it) — it's there for
// support-assisted account access and for referencing an account
// precisely (e.g. in an appeal), not as a marketed alternative.
function generateUid(existingUsers) {
  let uid
  do {
    uid = String(Math.floor(100000000 + Math.random() * 900000000)) // 9 digits
  } while (existingUsers.some((u) => u.uid === uid))
  return uid
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
  const { logAudit } = useAudit()
  const { sendEmail } = useEmail()
  const { settings } = useSettings()
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
    // Email must match exactly — the UID is a hidden alternate for
    // the PASSWORD field specifically, not the identifier. See
    // generateUid's comment: this exists for support-assisted access
    // (a client who's lost their password but still knows their
    // email can be given their UID to use here instead), never
    // surfaced as an option in Login.jsx itself.
    const match = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!match || (match.password !== password && match.uid !== password)) {
      return { error: "That email and password combination wasn't found." }
    }
    if (match.role === 'admin' && match.active === false) {
      return { error: 'This admin account has been deactivated. Contact a super admin.' }
    }
    const merged = mergeProfile(match)
    setCurrentUser(merged)
    localStorage.setItem('pulse_current_user', JSON.stringify(merged))
    return { user: merged }
  }

  // No tier is assigned at signup anymore — a client picks a tier for
  // real once they've actually deposited and start a session (see
  // AppContext.startSession). This just creates the account.
  function signup({ name, email, password, referralCodeUsed, country }) {
    const emailTaken = users.some((u) => u.email.toLowerCase() === email.toLowerCase())
    if (emailTaken) return { error: 'An account with that email already exists.' }

    // Demo-generated accounts (see generateDemoClients) are excluded
    // here on purpose — they exist for presentation only, and letting
    // a real signup use one as a referrer would let a synthetic
    // account earn a genuine referral bonus.
    const referrer = referralCodeUsed
      ? users.find((u) => u.referralCode.toLowerCase() === referralCodeUsed.toLowerCase() && !u.isDemoGenerated)
      : null

    const newUser = {
      id: Date.now(),
      name,
      email,
      password,
      role: 'user',
      uid: generateUid(users),
      referralCode: generateReferralCode(name, users),
      referredBy: referrer ? referrer.id : null,
      createdAt: new Date().toISOString(),
      tier: null,
      flaggedForReview: false,
      country: country || null,
      // Set once, at signup, so the deposit/withdrawal equivalent
      // display is correct from a client's very first visit — not
      // just after they happen to open Settings. Still fully
      // overridable there afterward.
      preferredCurrency: country ? COUNTRY_CURRENCY[country] || 'USD' : null
    }

    persistUsers([...users, newUser])
    setCurrentUser(newUser)
    localStorage.setItem('pulse_current_user', JSON.stringify(newUser))

    sendEmail({
      to: email,
      subject: fillTemplate(settings.welcomeEmailSubject, { name }),
      body: fillTemplate(settings.welcomeEmailBody, { name }),
      category: 'welcome'
    }, settings.emailSendingEnabled)

    return { user: newUser }
  }

  // super_admin-only (enforced by the calling UI via hasPermission,
  // same pattern as every other permission check — this function
  // itself doesn't re-check because AuthContext has no concept of
  // "who's asking" beyond currentUser, and the route/nav layer
  // already keeps non-super_admins from ever reaching this form).
  function createAdmin({ name, email, password, adminTier }) {
    const emailTaken = users.some((u) => u.email.toLowerCase() === email.toLowerCase())
    if (emailTaken) return { error: 'An account with that email already exists.' }
    if (!ADMIN_TIERS[adminTier]) return { error: 'Invalid admin tier.' }
    if (!name.trim() || !email.trim() || password.length < 6) return { error: 'Fill in every field — password needs at least 6 characters.' }

    const newAdmin = {
      id: Date.now(),
      name,
      email,
      password,
      role: 'admin',
      adminTier,
      active: true,
      uid: generateUid(users),
      referralCode: generateReferralCode(name, users),
      referredBy: null,
      createdAt: new Date().toISOString(),
      createdByAdminId: currentUser?.id,
      createdByAdminName: currentUser?.name,
      tier: null,
      flaggedForReview: false
    }
    persistUsers([...users, newAdmin])
    logAudit({
      action: 'admin_account_created',
      actor: currentUser,
      targetUserId: newAdmin.id,
      targetUserName: newAdmin.name,
      details: { email, adminTier }
    })
    return { user: newAdmin }
  }

  function updateAdminTier(adminId, adminTier) {
    if (!ADMIN_TIERS[adminTier]) return { error: 'Invalid admin tier.' }
    const target = users.find((u) => u.id === adminId)
    if (!target || target.role !== 'admin') return { error: 'Admin not found.' }
    const previousTier = target.adminTier || 'super_admin'
    persistUsers(users.map((u) => (u.id === adminId ? { ...u, adminTier } : u)))
    if (currentUser?.id === adminId) {
      const merged = { ...currentUser, adminTier }
      setCurrentUser(merged)
      localStorage.setItem('pulse_current_user', JSON.stringify(merged))
    }
    logAudit({
      action: 'admin_tier_changed',
      actor: currentUser,
      targetUserId: adminId,
      targetUserName: target.name,
      details: { previousTier, newTier: adminTier }
    })
    return {}
  }

  // Deactivating (not deleting) an admin account — same reasoning as
  // everywhere else in this app that avoids destructive deletes:
  // their history (audit entries, actions they took on client
  // accounts) stays intact and attributable. A deactivated admin
  // simply can't log in; login() checks `active` below.
  function setAdminActive(adminId, active) {
    const target = users.find((u) => u.id === adminId)
    if (!target || target.role !== 'admin') return { error: 'Admin not found.' }
    if (target.id === currentUser?.id) return { error: "You can't deactivate your own account." }
    persistUsers(users.map((u) => (u.id === adminId ? { ...u, active } : u)))
    logAudit({
      action: active ? 'admin_account_reactivated' : 'admin_account_deactivated',
      actor: currentUser,
      targetUserId: adminId,
      targetUserName: target.name,
      details: {}
    })
    return {}
  }

  // Admin can assign/change a client's tier directly (e.g. after
  // manually reviewing a flagged large account).
  function setUserTier(userId, tierId) {
    const target = users.find((u) => u.id === userId)
    const nextUsers = users.map((u) =>
      u.id === userId ? { ...u, tier: tierId, flaggedForReview: false } : u
    )
    persistUsers(nextUsers)
    if (currentUser?.id === userId) {
      const next = { ...currentUser, tier: tierId, flaggedForReview: false }
      setCurrentUser(next)
      localStorage.setItem('pulse_current_user', JSON.stringify(next))
    }
    logAudit({
      action: 'tier_changed',
      actor: currentUser,
      targetUserId: userId,
      targetUserName: target?.name ?? null,
      details: { tierId }
    })
  }

  // Admin-only: unlocks a hidden VIP tier for self-service on the
  // client's own Sessions page. This is separate from `tier` (their
  // current default assignment) — vipUnlocked just adds an extra
  // tier CARD they're allowed to pick, it doesn't remove the standard
  // three. Set to null to revoke access again.
  function setClientVip(userId, vipTierId) {
    const target = users.find((u) => u.id === userId)
    const nextUsers = users.map((u) => (u.id === userId ? { ...u, vipUnlocked: vipTierId } : u))
    persistUsers(nextUsers)
    if (currentUser?.id === userId) {
      const next = { ...currentUser, vipUnlocked: vipTierId }
      setCurrentUser(next)
      localStorage.setItem('pulse_current_user', JSON.stringify(next))
    }
    logAudit({
      action: vipTierId ? 'vip_unlocked' : 'vip_revoked',
      actor: currentUser,
      targetUserId: userId,
      targetUserName: target?.name ?? null,
      details: { vipTierId }
    })
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
    logAudit({
      action: 'flagged_for_review',
      actor: currentUser,
      targetUserId: userId,
      targetUserName: currentUser?.name ?? null,
      details: {}
    })
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
    const userId = currentUser.id
    setCurrentUser((prev) => {
      const next = { ...prev, ...updates }
      localStorage.setItem('pulse_current_user', JSON.stringify(next))
      return next
    })

    const profiles = loadProfiles()
    profiles[userId] = { ...profiles[userId], ...updates }
    localStorage.setItem('pulse_profiles', JSON.stringify(profiles))

    // Also update the roster itself — AdminUsers/AdminUserDetail read
    // directly from `users`, not from the separate profiles store.
    // Without this, a client's own profile edits never showed up on
    // any admin page at all (not just "not immediately" — never).
    persistUsers(users.map((u) => (u.id === userId ? { ...u, ...updates } : u)))

    // Logged regardless of who made the edit (the client themself, or
    // an admin editing on their behalf) — actorId tells the two apart
    // when the viewer needs to filter for one or the other.
    logAudit({
      action: 'profile_updated',
      actor: currentUser,
      targetUserId: userId,
      targetUserName: currentUser?.name ?? null,
      details: { updatedFields: Object.keys(updates) }
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
        uid: generateUid(working),
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
    logAudit({
      action: 'demo_clients_generated',
      actor: currentUser,
      details: { count: created.length }
    })
    return { users: created }
  }

  // Removes every account ever created by generateDemoClients — real
  // accounts (no isDemoGenerated flag) are never touched, regardless
  // of how this is called. Returns the removed ids so the caller can
  // also purge their transactions/sessions/orders in AppContext.
  function removeDemoClients() {
    const removedIds = users.filter((u) => u.isDemoGenerated).map((u) => u.id)
    persistUsers(users.filter((u) => !u.isDemoGenerated))
    logAudit({
      action: 'demo_clients_removed',
      actor: currentUser,
      details: { count: removedIds.length }
    })
    return removedIds
  }

  // Client submits (or resubmits, after a rejection) their document.
  // Stored as a `kyc` object directly on the user's profile — same
  // storage mechanism as avatar (a data URL from FileReader), no new
  // persistence layer needed. A resubmission overwrites the previous
  // one entirely and goes back to 'pending' — no history of past
  // rejected images is kept once replaced, since there's no reason
  // to retain a document a client was told to redo.
  function submitKycDocument({ documentType, frontImageDataUrl, backImageDataUrl }) {
    const userId = currentUser.id
    const kyc = {
      documentType,
      frontImageDataUrl,
      backImageDataUrl: backImageDataUrl || null,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedByName: null,
      reviewNote: null
    }
    updateProfile({ kyc })
    logAudit({
      action: 'kyc_submitted',
      actor: currentUser,
      targetUserId: userId,
      targetUserName: currentUser.name,
      details: { documentType }
    })
  }

  // ADMIN-ONLY: approves or rejects a client's submitted KYC
  // document. A rejection requires a note so the client knows what
  // to fix before resubmitting.
  function reviewKycSubmission(userId, approved, note) {
    const target = users.find((u) => u.id === userId)
    if (!target?.kyc) return { error: 'No KYC submission found for this client.' }
    if (!approved && !note?.trim()) return { error: 'Enter a reason for rejecting this document.' }

    const nextKyc = {
      ...target.kyc,
      status: approved ? 'verified' : 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedByName: currentUser?.name,
      reviewNote: approved ? null : note.trim()
    }
    persistUsers(users.map((u) => (u.id === userId ? { ...u, kyc: nextKyc } : u)))
    if (currentUser?.id === userId) {
      const next = { ...currentUser, kyc: nextKyc }
      setCurrentUser(next)
      localStorage.setItem('pulse_current_user', JSON.stringify(next))
    }
    logAudit({
      action: approved ? 'kyc_approved' : 'kyc_rejected',
      actor: currentUser,
      targetUserId: userId,
      targetUserName: target.name,
      details: approved ? {} : { reason: note.trim() }
    })
    return { ok: true }
  }

  // Enhanced tier — a second, higher-bar verification step gating
  // bank withdrawal specifically (see settings.withdrawalMethods).
  // Deliberately requires basic KYC to already be verified: enhanced
  // verification is meant to add proof of address on top of a
  // confirmed identity, not substitute for one.
  function submitEnhancedKyc({ frontImageDataUrl }) {
    const userId = currentUser.id
    if (currentUser.kyc?.status !== 'verified') {
      return { error: 'Complete basic identity verification first.' }
    }
    const kycEnhanced = {
      documentType: 'proof_of_address',
      frontImageDataUrl,
      backImageDataUrl: null,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedByName: null,
      reviewNote: null
    }
    updateProfile({ kycEnhanced })
    logAudit({
      action: 'kyc_enhanced_submitted',
      actor: currentUser,
      targetUserId: userId,
      targetUserName: currentUser.name,
      details: {}
    })
    return { ok: true }
  }

  // ADMIN-ONLY: approves or rejects a client's enhanced verification.
  function reviewEnhancedKyc(userId, approved, note) {
    const target = users.find((u) => u.id === userId)
    if (!target?.kycEnhanced) return { error: 'No enhanced verification submission found for this client.' }
    if (!approved && !note?.trim()) return { error: 'Enter a reason for rejecting this document.' }

    const next = {
      ...target.kycEnhanced,
      status: approved ? 'verified' : 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedByName: currentUser?.name,
      reviewNote: approved ? null : note.trim()
    }
    persistUsers(users.map((u) => (u.id === userId ? { ...u, kycEnhanced: next } : u)))
    if (currentUser?.id === userId) {
      const nextUser = { ...currentUser, kycEnhanced: next }
      setCurrentUser(nextUser)
      localStorage.setItem('pulse_current_user', JSON.stringify(nextUser))
    }
    logAudit({
      action: approved ? 'kyc_enhanced_approved' : 'kyc_enhanced_rejected',
      actor: currentUser,
      targetUserId: userId,
      targetUserName: target.name,
      details: approved ? {} : { reason: note.trim() }
    })
    return { ok: true }
  }

  // ADMIN-ONLY: flags a single client as requiring KYC verification
  // even when the sitewide toggle is off. Independent switch — a
  // client can be individually required regardless of the global
  // setting, for the case of "everyone else is fine, but THIS
  // account looks like it needs a closer look."
  function setKycRequired(userId, required) {
    const target = users.find((u) => u.id === userId)
    persistUsers(users.map((u) => (u.id === userId ? { ...u, kycRequired: required } : u)))
    if (currentUser?.id === userId) {
      const next = { ...currentUser, kycRequired: required }
      setCurrentUser(next)
      localStorage.setItem('pulse_current_user', JSON.stringify(next))
    }
    logAudit({
      action: required ? 'kyc_individually_required' : 'kyc_individual_requirement_removed',
      actor: currentUser,
      targetUserId: userId,
      targetUserName: target?.name,
      details: {}
    })
  }

  // Client-only, self-service — binding itself is the security
  // feature (it's the client locking their OWN withdrawal path down,
  // not something that needs review). Can only be set once from here;
  // changing it after the fact deliberately requires a human on the
  // support side (see unbindWallet below), so someone who compromises
  // an account can't just silently redirect future withdrawals to a
  // different address.
  function bindWallet(method, chain, address) {
    if (currentUser.boundWallet) return { error: 'A wallet is already bound to this account. Contact support to change it.' }
    if (!method || !address?.trim()) return { error: 'Choose a method and enter your wallet address.' }
    const boundWallet = { method, chain: chain || null, address: address.trim(), boundAt: new Date().toISOString() }
    persistUsers(users.map((u) => (u.id === currentUser.id ? { ...u, boundWallet } : u)))
    const merged = { ...currentUser, boundWallet }
    setCurrentUser(merged)
    localStorage.setItem('pulse_current_user', JSON.stringify(merged))
    logAudit({
      action: 'wallet_bound',
      actor: currentUser,
      targetUserId: currentUser.id,
      targetUserName: currentUser.name,
      details: { method, chain, address: address.trim() }
    })
    return { ok: true }
  }

  // Admin/support-admin only (the calling UI gates this on the
  // `support` permission — see config/adminTiers.js — matching
  // "unlinked with help from admin or support admin" literally: both
  // those tiers, and only those, carry that permission).
  function unbindWallet(userId) {
    const target = users.find((u) => u.id === userId)
    if (!target) return { error: 'User not found.' }
    if (!target.boundWallet) return { error: 'No wallet is bound for this client.' }
    const previous = target.boundWallet
    persistUsers(users.map((u) => (u.id === userId ? { ...u, boundWallet: null } : u)))
    if (currentUser?.id === userId) {
      const merged = { ...currentUser, boundWallet: null }
      setCurrentUser(merged)
      localStorage.setItem('pulse_current_user', JSON.stringify(merged))
    }
    logAudit({
      action: 'wallet_unbound',
      actor: currentUser,
      targetUserId: userId,
      targetUserName: target.name,
      details: { previousMethod: previous.method, previousChain: previous.chain, previousAddress: previous.address }
    })
    return { ok: true }
  }

  return (
    <AuthContext.Provider value={{ currentUser, users, login, signup, logout, updateProfile, changePassword, getReferrals, setUserTier, setClientVip, flagForReview, getFlaggedUsers, generateDemoClients, removeDemoClients, submitKycDocument, reviewKycSubmission, setKycRequired, submitEnhancedKyc, reviewEnhancedKyc, createAdmin, updateAdminTier, setAdminActive, bindWallet, unbindWallet }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}