import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'
import { publicUser } from '../utils/publicUser.js'

const router = Router()

// Client submits (or resubmits, after a rejection) their document.
// A resubmission overwrites the previous one entirely and goes back
// to 'pending' — mirrors submitKycDocument()'s own comment: no
// history of a rejected image is kept once replaced.
router.post('/', requireAuth, async (req, res) => {
  const { documentType, frontImageDataUrl, backImageDataUrl } = req.body || {}
  if (!documentType || !frontImageDataUrl) return res.status(400).json({ error: 'Document type and front image are required.' })

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
  const { rows } = await pool.query('UPDATE users SET kyc = $1 WHERE id = $2 RETURNING *', [JSON.stringify(kyc), req.user.id])

  await logAudit({ action: 'kyc_submitted', actor: req.user, targetUserId: req.user.id, targetUserName: req.user.name, details: { documentType } })
  res.status(201).json({ user: publicUser(rows[0]) })
})

// ADMIN-ONLY: approves or rejects. A rejection requires a note so
// the client knows what to fix before resubmitting.
router.post('/:userId/review', requireAuth, requirePermission('finance'), async (req, res) => {
  const { approved, note } = req.body || {}
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.userId])
  const target = rows[0]
  if (!target?.kyc) return res.status(400).json({ error: 'No KYC submission found for this client.' })
  if (!approved && !note?.trim()) return res.status(400).json({ error: 'Enter a reason for rejecting this document.' })

  const nextKyc = { ...target.kyc, status: approved ? 'verified' : 'rejected', reviewedAt: new Date().toISOString(), reviewedByName: req.user.name, reviewNote: approved ? null : note.trim() }
  const { rows: updated } = await pool.query('UPDATE users SET kyc = $1 WHERE id = $2 RETURNING *', [JSON.stringify(nextKyc), target.id])

  await logAudit({ action: approved ? 'kyc_approved' : 'kyc_rejected', actor: req.user, targetUserId: target.id, targetUserName: target.name, details: approved ? {} : { reason: note.trim() } })
  res.json({ user: publicUser(updated[0]) })
})

// Enhanced tier (proof of address) — gates bank withdrawal. Requires
// basic KYC already verified: enhanced verification adds proof of
// address on top of a confirmed identity, not a substitute for one.
router.post('/enhanced', requireAuth, async (req, res) => {
  const { frontImageDataUrl } = req.body || {}
  if (!frontImageDataUrl) return res.status(400).json({ error: 'Upload a proof-of-address document.' })
  if (req.user.kyc?.status !== 'verified') return res.status(400).json({ error: 'Complete basic identity verification first.' })

  const kycEnhanced = { documentType: 'proof_of_address', frontImageDataUrl, backImageDataUrl: null, status: 'pending', submittedAt: new Date().toISOString(), reviewedAt: null, reviewedByName: null, reviewNote: null }
  const { rows } = await pool.query('UPDATE users SET kyc_enhanced = $1 WHERE id = $2 RETURNING *', [JSON.stringify(kycEnhanced), req.user.id])

  await logAudit({ action: 'kyc_enhanced_submitted', actor: req.user, targetUserId: req.user.id, targetUserName: req.user.name })
  res.status(201).json({ user: publicUser(rows[0]) })
})

router.post('/enhanced/:userId/review', requireAuth, requirePermission('finance'), async (req, res) => {
  const { approved, note } = req.body || {}
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.userId])
  const target = rows[0]
  if (!target?.kyc_enhanced) return res.status(400).json({ error: 'No enhanced verification submission found for this client.' })
  if (!approved && !note?.trim()) return res.status(400).json({ error: 'Enter a reason for rejecting this document.' })

  const next = { ...target.kyc_enhanced, status: approved ? 'verified' : 'rejected', reviewedAt: new Date().toISOString(), reviewedByName: req.user.name, reviewNote: approved ? null : note.trim() }
  const { rows: updated } = await pool.query('UPDATE users SET kyc_enhanced = $1 WHERE id = $2 RETURNING *', [JSON.stringify(next), target.id])

  await logAudit({ action: approved ? 'kyc_enhanced_approved' : 'kyc_enhanced_rejected', actor: req.user, targetUserId: target.id, targetUserName: target.name, details: approved ? {} : { reason: note.trim() } })
  res.json({ user: publicUser(updated[0]) })
})

export default router
