import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'
import { MAX_SIGNUP_BONUS } from '../utils/signupBonus.js'
import { ALL_TIERS, DEFAULT_TIERS, DEFAULT_VIP_TIERS, normalizeTierLists, packTiersForStorage, setTierConfig } from '../config/tiers.js'

const router = Router()

// Public on purpose — deposit instructions, crypto reference info,
// tier definitions, and the platform's brand config all need to be
// visible to a client before/without them needing a special
// permission, same as the frontend's SettingsContext being readable
// everywhere. Nothing written into `data` here should ever be a
// secret; if that changes, this route needs auth added at the same
// time.
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
  res.json({ settings: rows[0]?.data || {} })
})

// Shallow merge, same as the frontend's updateSettings(updates) —
// callers send only the keys they're changing, everything else is
// left untouched. A caller wanting to change a nested key (e.g.
// cryptoDepositInfo.usdt) still has to send that whole nested object,
// exactly like the frontend already does.
router.put('/', requireAuth, requirePermission('manageSettings'), async (req, res) => {
  const updates = { ...(req.body || {}) }
  const changedKeys = Object.keys(updates)
  const { rows: current } = await pool.query('SELECT data FROM settings WHERE id = 1')
  const currentData = current[0]?.data || {}

  // The signup bonus pays real money to every new client, so its two
  // settings are checked: a true/false switch and a sane amount.
  if ('signupBonusEnabled' in updates && typeof updates.signupBonusEnabled !== 'boolean') {
    return res.status(400).json({ error: 'Signup bonus enabled must be on or off.' })
  }
  if ('signupBonusAmount' in updates) {
    const amount = updates.signupBonusAmount
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > MAX_SIGNUP_BONUS) {
      return res.status(400).json({ error: `Signup bonus must be a number between 0 and ${MAX_SIGNUP_BONUS.toLocaleString()}.` })
    }
  }

  // Investment tiers drive real money rules (deposit limits, leverage,
  // payout cap), so a tier edit is validated and then applied to the
  // running server immediately — not just stored.
  let checkedTiers = null
  if ('tiers' in updates || 'vipTiers' in updates) {
    checkedTiers = normalizeTierLists(
      'tiers' in updates ? updates.tiers : currentData.tiers || DEFAULT_TIERS,
      'vipTiers' in updates ? updates.vipTiers : currentData.vipTiers || DEFAULT_VIP_TIERS
    )
    if (checkedTiers.error) return res.status(400).json({ error: checkedTiers.error })

    // A tier can't be deleted while sessions are still running on it —
    // they'd settle with no payout-cap rules at all.
    const keptIds = new Set([...checkedTiers.tiers, ...checkedTiers.vipTiers].map((t) => t.id))
    const removed = ALL_TIERS.filter((t) => !keptIds.has(t.id))
    if (removed.length > 0) {
      const { rows: live } = await pool.query(
        "SELECT tier_id, COUNT(*)::int AS n FROM trading_sessions WHERE tier_id = ANY($1) AND status IN ('active', 'awaiting_start') GROUP BY tier_id",
        [removed.map((t) => t.id)]
      )
      if (live.length > 0) {
        const name = removed.find((t) => t.id === live[0].tier_id)?.name || live[0].tier_id
        return res.status(400).json({ error: `Can't remove "${name}": ${live[0].n} session(s) are still running on it. Let them finish or cancel them first.` })
      }
    }

    // Store the cleaned version (known fields only, Infinity as a marker).
    if ('tiers' in updates) updates.tiers = packTiersForStorage(checkedTiers.tiers)
    if ('vipTiers' in updates) updates.vipTiers = packTiersForStorage(checkedTiers.vipTiers)
  }

  const merged = { ...currentData, ...updates }
  const { rows } = await pool.query(
    'UPDATE settings SET data = $1, updated_at = now() WHERE id = 1 RETURNING data',
    [JSON.stringify(merged)]
  )
  if (checkedTiers) setTierConfig(checkedTiers.tiers, checkedTiers.vipTiers)

  await logAudit({
    action: 'settings_updated',
    actor: req.user,
    details: { changedKeys }
  })

  res.json({ settings: rows[0].data })
})

export default router
