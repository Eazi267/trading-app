// Mirrors src/config/tiers.js's default TIERS/VIP_TIERS exactly, as
// static values — NOT wired to the settings table's admin-editable
// tier list yet (see sql/008_sessions.sql's header comment on why).
// If the frontend's defaults change, update this the same way in the
// same batch, same sync obligation as config/adminTiers.js.

export const TIERS = [
  { id: 'tier1', name: 'Tier 1 — Starter', maxPayoutMultiplier: 3, minDeposit: 100, maxDeposit: 999, durationDays: 2, durationRange: { min: 1, max: 3 }, leverageRange: { min: 1, max: 300 }, defaultLeverage: 2 },
  { id: 'tier2', name: 'Tier 2 — Standard', maxPayoutMultiplier: 5, minDeposit: 1000, maxDeposit: 4999, durationDays: 5, durationRange: { min: 3, max: 7 }, leverageRange: { min: 1, max: 500 }, defaultLeverage: 5 },
  { id: 'tier3', name: 'Tier 3 — Full Allocation', maxPayoutMultiplier: 10, minDeposit: 5000, maxDeposit: 24999, durationDays: 7, durationRange: { min: 5, max: 14 }, leverageRange: { min: 1, max: 1000 }, defaultLeverage: 10 }
]

export const VIP_TIERS = [
  { id: 'mini_vip', name: 'Mini VIP', maxPayoutMultiplier: 2, minDeposit: 10, maxDeposit: 99, durationDays: 1, durationRange: { min: 1, max: 2 }, leverageRange: { min: 1, max: 100 }, defaultLeverage: 2, hidden: true },
  { id: 'major_vip', name: 'Major VIP', maxPayoutMultiplier: 15, minDeposit: 25001, maxDeposit: Infinity, durationDays: 14, durationRange: { min: 7, max: 30 }, leverageRange: { min: 1, max: 2000 }, defaultLeverage: 20, hidden: true }
]

export const ALL_TIERS = [...TIERS, ...VIP_TIERS]

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
