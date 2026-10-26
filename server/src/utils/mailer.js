// Sends email. Which provider is chosen with environment variables:
//   EMAIL_PROVIDER=resend  + RESEND_API_KEY + EMAIL_FROM="Pulse <noreply@yourdomain.com>"
//   EMAIL_PROVIDER=console (default when NODE_ENV is not production): prints the
//        email in the server log instead of sending it. For local testing only.
// In production with no provider set, nothing is sent (and nothing is printed,
// because the message contains a secret code).
const isProduction = () => process.env.NODE_ENV === 'production'

function provider() {
  const p = String(process.env.EMAIL_PROVIDER || '').toLowerCase()
  if (p) return p
  return isProduction() ? 'none' : 'console'
}

// True when real emails can be delivered.
export function emailDeliveryConfigured() {
  return provider() === 'resend' && !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM
}

export async function sendMail({ to, subject, text, html }) {
  const p = provider()
  if (p === 'console') {
    console.log(`\n--- EMAIL (console mode, not really sent) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n--- end email ---\n`)
    return { delivered: false }
  }
  if (p === 'resend') {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('EMAIL_PROVIDER=resend needs RESEND_API_KEY and EMAIL_FROM')
    const response = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html })
    })
    if (!response.ok) throw new Error(`Email provider refused the message (HTTP ${response.status})`)
    return { delivered: true }
  }
  // Deliberately no subject/body here: they contain the secret code.
  console.warn('An email was NOT sent: no email provider is configured (set EMAIL_PROVIDER).')
  return { delivered: false }
}

// Never throws: a broken email provider must not break signup or reveal
// anything to the person on the other end. Failures are only logged.
export async function sendMailSafe(message) {
  try { return await sendMail(message) } catch (err) {
    console.error('Sending email failed:', err.message)
    return { delivered: false }
  }
}
