import { createContext, useContext, useEffect, useState } from 'react'

const EmailContext = createContext(null)

// This is the ONE place that "sends" email. Every trigger point in
// the app (signup, deposit approved, etc.) calls sendEmail() here —
// never a provider SDK directly. That's deliberate: today this
// function only logs to a simulated Outbox, because real sending
// needs a backend to hold provider credentials (an SMTP password or
// API key cannot live in frontend JS — anyone could read it out of
// the bundle and send email, or rack up the bill, as this
// deployment). When the backend exists, ONLY the inside of this one
// function changes to make a real API call — every call site in the
// rest of the app stays exactly as it is.
export function EmailProvider({ children }) {
  const [outbox, setOutbox] = useState(() => {
    const saved = localStorage.getItem('pulse_email_outbox')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem('pulse_email_outbox', JSON.stringify(outbox))
  }, [outbox])

  // enabled is passed in by the caller (from useSettings()) rather
  // than read here, since this context has no settings dependency —
  // keeping it that way is what lets it stay independent.
  function sendEmail({ to, subject, body, category = 'general' }, enabled) {
    setOutbox((prev) => [
      {
        id: Date.now() + Math.random().toString(36).slice(2, 8),
        to,
        subject,
        body,
        category,
        // Never "sent" — that would claim something false. 'simulated'
        // means the toggle was on and this is what would have gone
        // out; 'skipped' means the kill switch was off.
        status: enabled ? 'simulated' : 'skipped',
        timestamp: new Date().toISOString()
      },
      ...prev
    ])
  }

  return (
    <EmailContext.Provider value={{ outbox, sendEmail }}>
      {children}
    </EmailContext.Provider>
  )
}

export function useEmail() {
  const ctx = useContext(EmailContext)
  if (!ctx) throw new Error('useEmail must be used inside <EmailProvider>')
  return ctx
}

// Minimal {{placeholder}} substitution for templates stored in
// settings — enough for "{{name}}" in the welcome email without
// pulling in a templating library for one use case.
export function fillTemplate(template, vars) {
  return (template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}
