import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useAudit } from './AuditContext.jsx'
import { useNotifications } from './NotificationContext.jsx'

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
  const { logAudit } = useAudit()
  const { notify } = useNotifications()

  const [cases, setCases] = useState(() => {
    const saved = localStorage.getItem('pulse_support_cases')
    if (saved) return JSON.parse(saved)
    // One-time migration from the old flat-thread model, so nobody's
    // existing support history disappears just because the shape
    // changed underneath it. Each old conversation becomes exactly
    // one case, category "general" since the old model had none.
    const legacy = localStorage.getItem('pulse_support_conversations')
    if (legacy) {
      const conversations = JSON.parse(legacy)
      return conversations.map((c) => ({
        id: c.id,
        userId: c.userId,
        userName: c.userName,
        subject: 'General Question',
        category: 'general',
        relatedTransactionId: null,
        status: c.status,
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
        unreadForAdmin: c.unreadForAdmin,
        unreadForClient: c.unreadForClient,
        messages: c.messages
      }))
    }
    return []
  })

  useEffect(() => {
    localStorage.setItem('pulse_support_cases', JSON.stringify(cases))
  }, [cases])

  function getCase(caseId) {
    return cases.find((c) => c.id === caseId) || null
  }

  function getCasesForUser(userId) {
    return cases.filter((c) => c.userId === userId).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
  }

  function createCase({ subject, category, body, relatedTransactionId = null }) {
    const text = body.trim()
    if (!text) return { error: 'Message cannot be empty.' }
    if (!CASE_CATEGORIES[category]) return { error: 'Invalid case category.' }
    const now = new Date().toISOString()
    const message = {
      id: Date.now() + Math.random().toString(36).slice(2, 7),
      senderId: currentUser.id,
      senderRole: 'client',
      senderName: currentUser.name,
      body: text,
      createdAt: now
    }
    const newCase = {
      id: Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      subject: subject?.trim() || CASE_CATEGORIES[category],
      category,
      relatedTransactionId,
      status: 'open',
      createdAt: now,
      lastMessageAt: now,
      unreadForAdmin: true,
      unreadForClient: false,
      messages: [message]
    }
    setCases((prev) => [...prev, newCase])
    return { case: newCase }
  }

  // Used by both a client replying to their own case and an admin
  // replying to any case — the sender's role/name comes from
  // currentUser either way, so this one function covers both
  // directions instead of the old sendClientMessage/sendAdminReply
  // split.
  function sendCaseMessage(caseId, body) {
    const text = body.trim()
    if (!text) return { error: 'Message cannot be empty.' }
    const target = getCase(caseId)
    if (!target) return { error: 'Case not found.' }
    const isAdminSender = currentUser.role === 'admin'
    const message = {
      id: Date.now() + Math.random().toString(36).slice(2, 7),
      senderId: currentUser.id,
      senderRole: isAdminSender ? 'admin' : 'client',
      senderName: currentUser.name,
      body: text,
      createdAt: new Date().toISOString()
    }
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              messages: [...c.messages, message],
              status: 'open', // a new message reopens a resolved case automatically, either side
              lastMessageAt: message.createdAt,
              unreadForAdmin: isAdminSender ? c.unreadForAdmin : true,
              unreadForClient: isAdminSender ? true : c.unreadForClient
            }
          : c
      )
    )
    if (isAdminSender) {
      notify(target.userId, 'support_reply', `Support replied — ${target.subject}`, text.length > 100 ? text.slice(0, 100) + '…' : text, { caseId })
      logAudit({
        action: 'support_reply_sent',
        actor: currentUser,
        targetUserId: target.userId,
        targetUserName: target.userName,
        details: { caseId, preview: text.length > 80 ? text.slice(0, 80) + '…' : text }
      })
    }
    return { message }
  }

  function setCaseStatus(caseId, status) {
    const target = getCase(caseId)
    if (!target) return { error: 'Case not found.' }
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, status } : c)))
    logAudit({
      action: status === 'resolved' ? 'support_case_resolved' : 'support_case_reopened',
      actor: currentUser,
      targetUserId: target.userId,
      targetUserName: target.userName,
      details: { caseId, subject: target.subject }
    })
    return {}
  }

  function markCaseReadByAdmin(caseId) {
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, unreadForAdmin: false } : c)))
  }

  function markCaseReadByClient(caseId) {
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, unreadForClient: false } : c)))
  }

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
