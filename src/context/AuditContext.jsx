import { createContext, useContext, useCallback } from 'react'
import { apiRequest } from '../api/client.js'

const AuditContext = createContext(null)

// The audit log now lives in the DATABASE and is written ONLY by the
// server — every route that changes something (fees, tiers, sessions,
// settings, support replies, KYC...) records its own entry as part of
// the same request. That is deliberate: if the browser could write
// audit entries, anyone could forge them (or skip them) from the
// console, and a log you can forge is not an audit log. The database
// also refuses to UPDATE or DELETE entries (migration 014).
//
// So this context only READS. It still sits above AuthContext with no
// dependencies of its own (see the original reasoning: AppContext and
// AuthContext both used to write here, so it had to be above both).
export function AuditProvider({ children }) {
  // Admin-only on the server (403 for anyone else).
  // params: { action?, targetUserId?, limit? } -> { entries, hasMore } | { error }
  const fetchAuditLog = useCallback(async (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString()
    return apiRequest(`/api/audit${query ? `?${query}` : ''}`)
  }, [])

  // Kept as a harmless no-op so older call sites still compile. The one
  // remaining caller (the local signup-bonus effect in AppContext) is
  // acting on records that don't exist on the server, so there is
  // nothing real to record.
  function logAudit() {}

  return (
    <AuditContext.Provider value={{ fetchAuditLog, logAudit }}>
      {children}
    </AuditContext.Provider>
  )
}

export function useAudit() {
  const ctx = useContext(AuditContext)
  if (!ctx) throw new Error('useAudit must be used inside <AuditProvider>')
  return ctx
}
