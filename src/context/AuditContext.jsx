import { createContext, useContext, useEffect, useState } from 'react'

const AuditContext = createContext(null)

// Single audit trail for every state-changing action across the
// platform — deliberately its OWN context, not folded into AppContext
// or AuthContext. Both of those need to write here (AuthContext for
// profile/tier changes, AppContext for transactions/fees/campaigns),
// and AppContext already depends on AuthContext (useAuth()), so this
// context has to sit above both with zero dependencies of its own —
// otherwise AuthContext would need to import AppContext, a circular
// dependency. It's also the natural single source for a future
// compliance/read-only role to read from, rather than two logs.
export function AuditProvider({ children }) {
  const [auditLog, setAuditLog] = useState(() => {
    const saved = localStorage.getItem('pulse_audit_log')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem('pulse_audit_log', JSON.stringify(auditLog))
  }, [auditLog])

  // actor = who performed the action (usually the logged-in admin).
  // target = the client the action affects, if any (null for actions
  // with no single client, e.g. a broadcast to everyone).
  // details = a plain object of whatever's relevant to that action —
  // shape varies per action, this log doesn't enforce one schema
  // beyond the envelope fields below.
  function logAudit({ action, actor, targetUserId = null, targetUserName = null, details = {} }) {
    setAuditLog((prev) => [
      {
        id: Date.now() + Math.random().toString(36).slice(2, 8),
        action,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? 'System',
        targetUserId,
        targetUserName,
        details,
        timestamp: new Date().toISOString()
      },
      ...prev
    ])
  }

  return (
    <AuditContext.Provider value={{ auditLog, logAudit }}>
      {children}
    </AuditContext.Provider>
  )
}

export function useAudit() {
  const ctx = useContext(AuditContext)
  if (!ctx) throw new Error('useAudit must be used inside <AuditProvider>')
  return ctx
}
