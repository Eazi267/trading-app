import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { logAudit } from '../utils/auditLog.js'

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
  const updates = req.body || {}
  const { rows: current } = await pool.query('SELECT data FROM settings WHERE id = 1')
  const merged = { ...(current[0]?.data || {}), ...updates }

  const { rows } = await pool.query(
    'UPDATE settings SET data = $1, updated_at = now() WHERE id = 1 RETURNING data',
    [JSON.stringify(merged)]
  )

  await logAudit({
    action: 'settings_updated',
    actor: req.user,
    details: { changedKeys: Object.keys(updates) }
  })

  res.json({ settings: rows[0].data })
})

export default router
