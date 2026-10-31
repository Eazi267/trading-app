import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requireRole, requirePermission } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'
import { setControl, requireAdmin2faOn, forcedByServer, autoTransactionEmailsOn, OTP_OPERATIONS, otpSnapshot } from '../utils/appControls.js'
import { emailMode, sendMail } from '../utils/mailer.js'

// Super-admin switches shown on the Admin Accounts page.
const router = Router()
router.use(requireAuth, requireRole('admin'))

async function snapshot(user) {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND deactivated_at IS NULL AND NOT totp_enabled")
  return {
    requireAdmin2fa: requireAdmin2faOn(),
    requireAdmin2faForcedByServer: forcedByServer(),
    adminsWithoutTwoFactor: rows[0].n,
    yourTwoFactorEnabled: !!user.totp_enabled,
    autoTransactionEmails: autoTransactionEmailsOn(),
    otp: otpSnapshot(),
    otpLabels: Object.fromEntries(Object.entries(OTP_OPERATIONS).map(([k, v]) => [k, v.label])),
    emailMode: emailMode() // 'resend' = real delivery, 'console' = test mode, 'none' = not configured
  }
}

router.get('/', async (req, res) => res.json(await snapshot(req.user)))

// Super admin only (manageAdmins). Turning it ON requires the person doing it to
// have two-factor themselves, so they can't lock themselves out.
router.put('/admin-2fa', requirePermission('manageAdmins'), async (req, res) => {
  const required = req.body?.required
  if (typeof required !== 'boolean') return res.status(400).json({ error: 'Send required: true or false.' })
  if (required && !req.user.totp_enabled) {
    return res.status(400).json({ error: 'Turn on two-factor for your own account first (Settings), then you can require it for every admin.' })
  }
  await setControl('require_admin_2fa', required, req.user.id)
  await logAudit({ action: 'admin_2fa_requirement_changed', actor: req.user, details: { required } })
  res.json(await snapshot(req.user))
})

router.put('/auto-emails', requirePermission('manageSettings'), async (req, res) => {
  const enabled = req.body?.enabled
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Send enabled: true or false.' })
  await setControl('auto_transaction_emails', enabled, req.user.id)
  await logAudit({ action: 'auto_transaction_emails_changed', actor: req.user, details: { enabled } })
  res.json(await snapshot(req.user))
})

// "Send me a test email": proves the email provider is set up, without touching any client.
router.post('/test-email', requirePermission('manageSettings'), async (req, res) => {
  try {
    const r = await sendMail({ to: req.user.email, subject: 'Test email from your platform', text: 'If you can read this, email sending works.\n', html: '<p>If you can read this, email sending works.</p>' })
    res.json({ mode: r.mode, delivered: !!r.delivered, to: req.user.email })
  } catch (err) {
    res.status(502).json({ error: `The email provider refused it: ${err.message}` })
  }
})

// Turn the emailed confirmation code on/off for one client action.
router.put('/otp', requirePermission('manageSettings'), async (req, res) => {
  const { operation, enabled } = req.body || {}
  if (!OTP_OPERATIONS[operation] || typeof enabled !== 'boolean') return res.status(400).json({ error: 'Send operation and enabled: true or false.' })
  if (enabled && emailMode() === 'none') {
    return res.status(400).json({ error: 'No email provider is set up on the server, so clients could never receive the code. Set up email first.' })
  }
  await setControl(OTP_OPERATIONS[operation].key, enabled, req.user.id)
  await logAudit({ action: 'otp_requirement_changed', actor: req.user, details: { operation, enabled } })
  res.json(await snapshot(req.user))
})

export default router
