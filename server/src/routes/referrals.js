import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'

const router = Router()

function publicCampaign(row) {
  return {
    id: row.id,
    name: row.name,
    bonusAmount: Number(row.bonus_amount),
    startDate: row.start_date,
    endDate: row.end_date,
    note: row.note,
    active: row.active,
    createdAt: row.created_at
  }
}

router.post('/campaigns', requireAuth, requirePermission('manageSettings'), async (req, res) => {
  const { name, bonusAmount, startDate, endDate, note } = req.body || {}
  if (!name?.trim()) return res.status(400).json({ error: 'Give the campaign a name.' })
  if (!bonusAmount || bonusAmount <= 0) return res.status(400).json({ error: 'Enter a bonus amount above zero.' })
  if (!startDate || !endDate) return res.status(400).json({ error: 'Set a start and end date.' })
  if (new Date(endDate) < new Date(startDate)) return res.status(400).json({ error: 'End date must be on or after the start date.' })

  const { rows } = await pool.query(
    `INSERT INTO referral_campaigns (name, bonus_amount, start_date, end_date, note, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name.trim(), bonusAmount, startDate, endDate, note?.trim() || null, req.user.id]
  )
  await logAudit({ action: 'referral_campaign_created', actor: req.user, details: { campaignId: rows[0].id, name: rows[0].name, bonusAmount } })
  res.status(201).json({ campaign: publicCampaign(rows[0]) })
})

// Every campaign, with real stats derived from actual referral_bonus
// transactions — never a separate counter that could drift, same as
// getCampaignStats() on the frontend.
router.get('/campaigns', requireAuth, requirePermission('manageSettings'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM referral_campaigns ORDER BY created_at DESC')
  const withStats = await Promise.all(rows.map(async (c) => {
    const { rows: stats } = await pool.query(
      "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total_paid FROM transactions WHERE type = 'referral_bonus' AND details->>'campaignId' = $1",
      [String(c.id)]
    )
    return { ...publicCampaign(c), stats: { count: Number(stats[0].count), totalPaid: Number(stats[0].total_paid) } }
  }))
  res.json({ campaigns: withStats })
})

router.patch('/campaigns/:id', requireAuth, requirePermission('manageSettings'), async (req, res) => {
  const { name, bonusAmount, startDate, endDate, note } = req.body || {}
  const { rows } = await pool.query(
    `UPDATE referral_campaigns SET
       name = COALESCE($1, name), bonus_amount = COALESCE($2, bonus_amount),
       start_date = COALESCE($3, start_date), end_date = COALESCE($4, end_date), note = COALESCE($5, note)
     WHERE id = $6 RETURNING *`,
    [name?.trim(), bonusAmount, startDate, endDate, note, req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Campaign not found.' })
  await logAudit({ action: 'referral_campaign_updated', actor: req.user, details: { campaignId: rows[0].id } })
  res.json({ campaign: publicCampaign(rows[0]) })
})

router.post('/campaigns/:id/active', requireAuth, requirePermission('manageSettings'), async (req, res) => {
  const { active } = req.body || {}
  const { rows } = await pool.query('UPDATE referral_campaigns SET active = $1 WHERE id = $2 RETURNING *', [!!active, req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Campaign not found.' })
  await logAudit({ action: active ? 'referral_campaign_activated' : 'referral_campaign_deactivated', actor: req.user, details: { campaignId: rows[0].id } })
  res.json({ campaign: publicCampaign(rows[0]) })
})

export default router
