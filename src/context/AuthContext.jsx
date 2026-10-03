import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { apiRequest, getToken, setToken } from '../api/client.js'

const AuthContext = createContext(null)

// Real backend now (see server/README.md) — every function below is
// a thin wrapper around apiRequest(), not a localStorage mutation.
// This file used to own its own user array; the backend owns that
// now, which is also why `users` below is fetched from
// GET /api/admin/users rather than seeded locally — an admin
// managing a client they can't see is exactly the broken state this
// rewrite exists to avoid.
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  // Distinguishes "we haven't checked yet" from "checked, nobody's
  // logged in" — ProtectedRoute needs this so it doesn't redirect to
  // /login for a split second on every page load while the session
  // restore (GET /api/auth/me) is still in flight.
  const [loading, setLoading] = useState(true)

  const refreshUsers = useCallback(async () => {
    if (!getToken()) return
    const result = await apiRequest('/api/admin/users')
    if (result.users) setUsers(result.users)
  }, [])

  // Session restore on load: a stored token doesn't mean it's still
  // valid (expired, or the account got deactivated since) — always
  // re-confirm against /me rather than trusting what's in
  // localStorage the way the old version trusted its cached user.
  useEffect(() => {
    async function restore() {
      const token = getToken()
      if (!token) {
        setLoading(false)
        return
      }
      const result = await apiRequest('/api/auth/me')
      if (result.user) {
        setCurrentUser(result.user)
        if (result.user.role === 'admin') refreshUsers()
      } else {
        setToken(null)
      }
      setLoading(false)
    }
    restore()
  }, [refreshUsers])

  async function login(email, password) {
    const result = await apiRequest('/api/auth/login', { method: 'POST', body: { email, password }, auth: false })
    if (result.error) return { error: result.error }
    setToken(result.token)
    setCurrentUser(result.user)
    if (result.user.role === 'admin') refreshUsers()
    return { user: result.user }
  }

  // No tier is assigned at signup anymore — a client picks a tier for
  // real once they've actually deposited and start a session (see
  // AppContext.startSession). This just creates the account.
  async function signup({ name, email, password, referralCodeUsed, country }) {
    const result = await apiRequest('/api/auth/signup', {
      method: 'POST',
      auth: false,
      body: { name, email, password, country, referredBy: referralCodeUsed || undefined }
    })
    if (result.error) return { error: result.error }
    setToken(result.token)
    setCurrentUser(result.user)
    return { user: result.user }
  }

  function logout() {
    setToken(null)
    setCurrentUser(null)
    setUsers([])
  }

  async function updateProfile(updates) {
    const result = await apiRequest('/api/users/me', { method: 'PATCH', body: updates })
    if (result.error) return { error: result.error }
    setCurrentUser(result.user)
    return { user: result.user }
  }

  async function changePassword(currentPassword, newPassword) {
    const result = await apiRequest('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } })
    if (result.error) return { error: result.error }
    return { ok: true }
  }

  async function getReferrals(userId) {
    const result = await apiRequest(`/api/users/${userId}/referrals`)
    return result.referrals || []
  }

  // super_admin-only (enforced by the calling UI via hasPermission,
  // same pattern as every other permission check — see
  // config/adminTiers.js). The backend enforces this for real too
  // (requirePermission('manageAdmins')), this UI-level check is just
  // what keeps the form from ever being reachable in the first place.
  async function createAdmin({ name, email, password, adminTier }) {
    const result = await apiRequest('/api/admin/users', { method: 'POST', body: { name, email, password, adminTier } })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { user: result.user }
  }

  async function updateAdminTier(adminId, adminTier) {
    const result = await apiRequest(`/api/admin/users/${adminId}/admin-tier`, { method: 'POST', body: { adminTier } })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { user: result.user }
  }

  async function setAdminActive(adminId, active) {
    const path = `/api/admin/users/${adminId}/${active ? 'reactivate' : 'deactivate'}`
    const result = await apiRequest(path, { method: 'POST' })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { user: result.user }
  }

  async function setUserTier(userId, tierId) {
    const result = await apiRequest(`/api/admin/users/${userId}/tier`, { method: 'POST', body: { tierId } })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { user: result.user }
  }

  async function setClientVip(userId, vipTierId) {
    const result = await apiRequest(`/api/admin/users/${userId}/vip`, { method: 'POST', body: { vipTierId } })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { user: result.user }
  }

  async function flagForReview(userId) {
    const result = await apiRequest(`/api/admin/users/${userId}/flag`, { method: 'POST' })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { user: result.user }
  }

  // Pure/local — `users` is already real backend data by the time
  // this is called, so this stays a synchronous filter rather than a
  // second network round trip for something already in memory.
  function getFlaggedUsers() {
    return users.filter((u) => u.flaggedForReview)
  }

  async function generateDemoClients(count) {
    const result = await apiRequest('/api/admin/demo-clients', { method: 'POST', body: { count } })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { users: result.users }
  }

  async function removeDemoClients() {
    const result = await apiRequest('/api/admin/demo-clients', { method: 'DELETE' })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { removedIds: result.removedIds }
  }

  async function submitKycDocument({ documentType, frontImageDataUrl, backImageDataUrl }) {
    const result = await apiRequest('/api/kyc', { method: 'POST', body: { documentType, frontImageDataUrl, backImageDataUrl } })
    if (result.error) return { error: result.error }
    setCurrentUser(result.user)
    return { user: result.user }
  }

  async function reviewKycSubmission(userId, approved, note) {
    const result = await apiRequest(`/api/kyc/${userId}/review`, { method: 'POST', body: { approved, note } })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { user: result.user }
  }

  async function submitEnhancedKyc({ frontImageDataUrl }) {
    const result = await apiRequest('/api/kyc/enhanced', { method: 'POST', body: { frontImageDataUrl } })
    if (result.error) return { error: result.error }
    setCurrentUser(result.user)
    return { user: result.user }
  }

  async function reviewEnhancedKyc(userId, approved, note) {
    const result = await apiRequest(`/api/kyc/enhanced/${userId}/review`, { method: 'POST', body: { approved, note } })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { user: result.user }
  }

  async function setKycRequired(userId, required) {
    const result = await apiRequest(`/api/admin/users/${userId}/kyc-required`, { method: 'POST', body: { required } })
    if (result.error) return { error: result.error }
    await refreshUsers()
    return { user: result.user }
  }

  // Binding itself IS the security feature (the client locking their
  // own withdrawal path down) — can only be set once from here;
  // changing it after requires a human on the support side (see
  // unbindWallet below), so a compromised account can't silently
  // redirect future withdrawals.
  async function bindWallet(method, chain, address) {
    const result = await apiRequest('/api/users/me/wallet', { method: 'POST', body: { method, chain, address } })
    if (result.error) return { error: result.error }
    setCurrentUser(result.user)
    return { ok: true }
  }

  // Admin/support-admin only (the backend gates this on the
  // `support` permission — see config/adminTiers.js).
  async function unbindWallet(userId) {
    const result = await apiRequest(`/api/admin/users/${userId}/wallet/unbind`, { method: 'POST' })
    if (result.error) return { error: result.error }
    await refreshUsers()
    if (currentUser?.id === userId) setCurrentUser(result.user)
    return { ok: true }
  }

  return (
    <AuthContext.Provider value={{
      currentUser, users, loading, refreshUsers,
      login, signup, logout, updateProfile, changePassword, getReferrals,
      setUserTier, setClientVip, flagForReview, getFlaggedUsers,
      generateDemoClients, removeDemoClients,
      submitKycDocument, reviewKycSubmission, setKycRequired, submitEnhancedKyc, reviewEnhancedKyc,
      createAdmin, updateAdminTier, setAdminActive, bindWallet, unbindWallet
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
