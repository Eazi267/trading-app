import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { OTP_OPERATIONS } from '../utils/appControls.js'
import { sendOperationCode } from '../utils/accountEmails.js'

// "Send me a new code" button in the confirmation dialog.
const router = Router()
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Try again in a few minutes.' } })

router.post('/resend', limiter, requireAuth, async (req, res) => {
  const op = req.body?.operation
  if (!OTP_OPERATIONS[op] || req.user.role !== 'user' || !req.user.email_verified_at) return res.status(400).json({ error: 'Cannot send a code for that.' })
  const sent = await sendOperationCode(req.user, op)
  if (!sent) return res.status(429).json({ error: 'A code was sent a moment ago. Wait a minute before asking for another.' })
  res.json({ ok: true })
})

export default router
