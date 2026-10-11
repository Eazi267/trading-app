// Investment tiers. These are `let` bindings on purpose, mirroring the
// frontend's src/config/tiers.js: Business Settings lets an admin add,
// remove and re-tune tiers, those edits are saved in the settings table,
// and services/tierSync.js pushes whatever is saved into setTierConfig()
// below (at boot, right after every settings change, and every 30s).
// ES module bindings are LIVE, so every file doing
// `import { getTier } from '../config/tiers.js'` sees the new values with
// no other change. DEFAULT_TIERS/DEFAULT_VIP_TIERS are only the fallback
// used before any tiers have been saved (they match the frontend defaults).

// JSON can't represent Infinity (it silently becomes null), so a tier's
// "no upper limit" maxDeposit travels and is stored as this marker string.
// Same constant as SettingsContext.jsx on the frontend.
export const INFINITY_MARKER = '__INFINITY__'

export const DEFAULT_TIERS = [
  { id: 'tier1', name: 'Tier 1 — Starter', maxPayoutMultiplier: 3, minDeposit: 100, maxDeposit: 999, durationDays: 2, durationRange: { min: 1, max: 3 }, leverageRange: { min: 1, max: 300 }, defaultLeverage: 2 },
  { id: 'tier2', name: 'Tier 2 — Standard', maxPayoutMultiplier: 5, minDeposit: 1000, maxDeposit: 4999, durationDays: 5, durationRange: { min: 3, max: 7 }, leverageRange: { min: 1, max: 500 }, defaultLeverage: 5 },
  { id: 'tier3', name: 'Tier 3 — Full Allocation', maxPayoutMultiplier: 10, minDeposit: 5000, maxDeposit: 24999, durationDays: 7, durationRange: { min: 5, max: 14 }, leverageRange: { min: 1, max: 1000 }, defaultLeverage: 10 }
]

export const DEFAULT_VIP_TIERS = [
  { id: 'mini_vip', name: 'Mini VIP', maxPayoutMultiplier: 2, minDeposit: 10, maxDeposit: 99, durationDays: 1, durationRange: { min: 1, max: 2 }, leverageRange: { min: 1, max: 100 }, defaultLeverage: 2, hidden: true },
  { id: 'major_vip', name: 'Major VIP', maxPayoutMultiplier: 15, minDeposit: 25001, maxDeposit: Infinity, durationDays: 14, durationRange: { min: 7, max: 30 }, leverageRange: { min: 1, max: 2000 }, defaultLeverage: 20, hidden: true }
]



export let TIERS = DEFAULT_TIERS
export let VIP_TIERS = DEFAULT_VIP_TIERS
export let ALL_TIERS = [...TIERS, ...VIP_TIERS]

export function setTierConfig(tiers, vipTiers) {
  TIERS = tiers
  VIP_TIERS = vipTiers
  ALL_TIERS = [...TIERS, ...VIP_TIERS]
}

export function getTier(tierId) {
  return ALL_TIERS.find((t) => t.id === tierId) || null
}

export function clampLeverage(tierId, requested) {
  const tier = getTier(tierId)
  if (!tier) return requested
  const { min, max } = tier.leverageRange
  return Math.min(max, Math.max(min, Math.round(requested)))
}

export function clampDuration(tierId, requestedDays) {
  const tier = getTier(tierId)
  if (!tier) return requestedDays
  const { min, max } = tier.durationRange
  return Math.min(max, Math.max(min, Math.round(requestedDays)))
}

// ---------------------------------------------------------------
// Validation for admin-submitted tier lists (PUT /api/settings).
//
// Deliberately checks only what could BREAK server-side money math,
// not business judgement: an admin may legitimately set min > max
// deposit while mid-edit, or a tiny leverage cap. But these would be
// genuinely dangerous, so they are refused:
//  - maxPayoutMultiplier < 1: the profit cap is amount * (multiplier - 1),
//    so below 1 the "cap" goes NEGATIVE and a winning session would pay
//    out as a loss.
//  - leverage or duration below 1 (zero/negative leverage inverts or
//    erases P&L; zero/negative duration makes a session expire instantly).
//  - non-numbers / NaN / Infinity where a finite number is required.
//  - duplicate or malformed ids (sessions reference tiers by id).
// Only known fields are kept, so junk can't ride along into the config.
// ---------------------------------------------------------------
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const MAX_TIERS_PER_LIST = 50

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

function normalizeTier(raw, listLabel, index) {
  const where = `${listLabel} #${index + 1}`
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: `${where} is not a valid tier.` }
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) return { error: `${where}: id must be 1-64 letters, numbers, - or _.` }
  const label = `${where} ("${typeof raw.name === 'string' ? raw.name.slice(0, 40) : raw.id}")`

  const fail = (msg) => ({ error: `${label}: ${msg}` })
  if (typeof raw.name !== 'string' || raw.name.length > 100) return fail('name must be text up to 100 characters.')
  if (!isNum(raw.maxPayoutMultiplier) || raw.maxPayoutMultiplier < 1) return fail('payout multiplier must be a number of at least 1.')
  if (!isNum(raw.minDeposit) || raw.minDeposit < 0) return fail('min deposit must be a number, 0 or more.')

  let maxDeposit = raw.maxDeposit
  if (maxDeposit === INFINITY_MARKER) maxDeposit = Infinity
  if (maxDeposit !== Infinity && (!isNum(maxDeposit) || maxDeposit < 0)) return fail('max deposit must be a number, 0 or more.')

  if (!isNum(raw.durationDays) || raw.durationDays < 1) return fail('default duration must be at least 1 day.')
  const dr = raw.durationRange
  if (!dr || !isNum(dr.min) || !isNum(dr.max) || dr.min < 1 || dr.max < 1) return fail('duration range must be at least 1 day.')
  const lr = raw.leverageRange
  if (!lr || !isNum(lr.min) || !isNum(lr.max) || lr.min < 1 || lr.max < 1) return fail('leverage range must be at least 1x.')
  if (!isNum(raw.defaultLeverage) || raw.defaultLeverage < 1) return fail('default leverage must be at least 1x.')

  return {
    tier: {
      id: raw.id,
      name: raw.name,
      description: typeof raw.description === 'string' ? raw.description.slice(0, 500) : '',
      maxPayoutMultiplier: raw.maxPayoutMultiplier,
      minDeposit: raw.minDeposit,
      maxDeposit,
      durationDays: raw.durationDays,
      durationRange: { min: dr.min, max: dr.max },
      leverageRange: { min: lr.min, max: lr.max },
      defaultLeverage: raw.defaultLeverage,
      ...(raw.hidden ? { hidden: true } : {})
    }
  }
}

// Returns { tiers, vipTiers } (clean, with real Infinity) or { error }.
// `vipTiers` may be empty; `tiers` must have at least one entry (a client
// needs something to pick) — same rule the admin UI already enforces.
export function normalizeTierLists(tiers, vipTiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) return { error: 'At least one standard tier is required.' }
  if (!Array.isArray(vipTiers)) return { error: 'vipTiers must be a list.' }
  if (tiers.length > MAX_TIERS_PER_LIST || vipTiers.length > MAX_TIERS_PER_LIST) return { error: `A list can hold at most ${MAX_TIERS_PER_LIST} tiers.` }

  const out = { tiers: [], vipTiers: [] }
  const seen = new Set()
  for (const [listKey, listLabel, list] of [['tiers', 'Tier', tiers], ['vipTiers', 'VIP tier', vipTiers]]) {
    for (const [i, raw] of list.entries()) {
      const result = normalizeTier(raw, listLabel, i)
      if (result.error) return { error: result.error }
      if (seen.has(result.tier.id)) return { error: `Two tiers share the id "${result.tier.id}" — ids must be unique.` }
      seen.add(result.tier.id)
      out[listKey].push(result.tier)
    }
  }
  return out
}

// The reverse of the Infinity translation, for writing back to the
// settings table (JSON can't hold Infinity).
export function packTiersForStorage(tiers) {
  return tiers.map((t) => ({ ...t, maxDeposit: t.maxDeposit === Infinity ? INFINITY_MARKER : t.maxDeposit }))
}
