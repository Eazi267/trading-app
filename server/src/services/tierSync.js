import { pool } from '../db.js'
import { setTierConfig, normalizeTierLists, DEFAULT_TIERS, DEFAULT_VIP_TIERS } from '../config/tiers.js'

// Keeps the server's live tier config (config/tiers.js) equal to what an
// admin has saved in Business Settings. Runs at boot, immediately after
// any settings change that touches tiers (see routes/settings.js), and on
// a timer so a second server instance or a manual DB edit also converges.
//
// Fails SAFE: if the saved tiers are missing or somehow invalid, the
// server keeps what it already has (or the built-in defaults on first
// load) and logs a warning — a bad settings row must never leave the
// server with no tiers.
export async function refreshTierConfig() {
  try {
    const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
    const data = rows[0]?.data || {}
    if (!data.tiers) {
      setTierConfig(DEFAULT_TIERS, DEFAULT_VIP_TIERS) // nothing saved yet: built-in defaults
      return
    }
    const checked = normalizeTierLists(data.tiers, data.vipTiers || [])
    if (checked.error) {
      console.warn(`Saved tiers ignored (keeping current config): ${checked.error}`)
      return
    }
    setTierConfig(checked.tiers, checked.vipTiers)
  } catch (err) {
    console.warn(`Could not refresh tiers from settings: ${err.message}`)
  }
}

export function startTierSync() {
  const intervalMs = Number(process.env.TIER_REFRESH_MS) || 30000
  setInterval(refreshTierConfig, intervalMs).unref()
}
