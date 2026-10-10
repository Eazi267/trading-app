import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { apiRequest } from '../api/client.js'
import { useAuth } from './AuthContext.jsx'

const SupportContext = createContext(null)

export const CASE_CATEGORIES = {
  appeal: 'Transaction Appeal',
  account: 'Account Issue',
  general: 'General Question',
  other: 'Other'
}

// Real case files, not one flat thread per client. A client can have
// several open cases at once — an appeal about one deposit and an
// unrelated question about their tier, say — each independently
// trackable: its own ID, its own status, its own message thread, and
// optionally a linked transaction. This replaced an earlier one-
// conversation-per-client model once it became clear that flattening
// every reason someone might contact support into a single thread
// made it impossible to tell "this was resolved" from "this new
// message is a different topic."
//
// Sits below AuthContext (needs currentUser) and below Notification/
// Audit (writes to both) — same reasoning as AppContext's own
// position in the provider tree; see AuditContext's comment on why
// that ordering avoids a circular dependency.
export function SupportProvider({ children }) {
  const { currentUser } = useAuth()
  const [cases, setCases] = useState([])

  const userId = currentUser?.id
  const isAdmin = currentUser?.role === 'admin'

  // Cases live in the DATABASE now. A client gets only their own
  // (GET /cases/mine); an admin with the support permission gets
  // everyone's (GET /cases). Each case arrives with its full message
  // thread. Polled every 15s so replies show up without a refresh.
  // Audit entries and the client's "support replied" notification are
  // written by the server itself, so nothing is logged from here.
  const refreshCases = useCallback(async () => {
    if (!userId) return
    const result = await apiRequest(isAdmin ? '/api/support/cases' : '/api/support/cases/mine')
    if (result.cases) setCases(result.cases)
  }, [userId, isAdmin])

  useEffect(() => {
    setCases([])
    if (!userId) return
    refreshCases()
    const id = setInterval(refreshCases, 15000)
    return () => clearInterval(id)
  }, [userId, refreshCases])

  function getCase(caseId) {
    return cases.find((c) => c.id === caseId) || null
  }

  function getCasesForUser(forUserId) {
    return cases.filter((c) => c.userId === forUserId).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
  }

  async function createCase({ subject, category, body, relatedTransactionId = null }) {
    if (!body?.trim()) return { error: 'Message cannot be empty.' }
    if (!CASE_CATEGORIES[category]) return { error: 'Invalid case category.' }
    const result = await apiRequest('/api/support/cases', {
      method: 'POST',
      body: { subject, category, body, relatedTransactionId }
    })
    if (result.error) return { error: result.error }
    await refreshCases()
    return { case: result.case }
  }

  // One function for both directions: a client replying to their own
  // case and an admin replying to any case (the server works out which
  // from the logged-in user, and reopens a resolved case automatically).
  async function sendCaseMessage(caseId, body) {
    if (!body?.trim()) return { error: 'Message cannot be empty.' }
    const result = await apiRequest(`/api/support/cases/${caseId}/messages`, { method: 'POST', body: { body } })
    if (result.error) return { error: result.error }
    await refreshCases()
    return { message: result.message }
  }

  async function setCaseStatus(caseId, status) {
    const result = await apiRequest(`/api/support/cases/${caseId}/status`, { method: 'POST', body: { status } })
    if (result.error) return { error: result.error }
    await refreshCases()
    return {}
  }

  // Opening a case clears its unread dot. Updates the screen instantly,
  // then tells the server (skipped if it's already read, so polling
  // doesn't cause a request storm).
  function markCaseRead(caseId, flag) {
    const target = cases.find((c) => c.id === caseId)
    if (!target || !target[flag]) return
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, [flag]: false } : c)))
    apiRequest(`/api/support/cases/${caseId}/read`, { method: 'POST' })
  }
  function markCaseReadByAdmin(caseId) { markCaseRead(caseId, 'unreadForAdmin') }
  function markCaseReadByClient(caseId) { markCaseRead(caseId, 'unreadForClient') }

  const myCases = currentUser && currentUser.role !== 'admin' ? getCasesForUser(currentUser.id) : []
  const myUnreadCount = myCases.filter((c) => c.unreadForClient).length
  const openCaseCount = cases.filter((c) => c.status === 'open').length
  const unreadForAdminCount = cases.filter((c) => c.unreadForAdmin).length

  return (
    <SupportContext.Provider
      value={{
        cases,
        myCases,
        myUnreadCount,
        openCaseCount,
        unreadForAdminCount,
        getCase,
        getCasesForUser,
        createCase,
        sendCaseMessage,
        setCaseStatus,
        markCaseReadByAdmin,
        markCaseReadByClient
      }}
    >
      {children}
    </SupportContext.Provider>
  )
}

export function useSupport() {
  const ctx = useContext(SupportContext)
  if (!ctx) throw new Error('useSupport must be used inside <SupportProvider>')
  return ctx
}
