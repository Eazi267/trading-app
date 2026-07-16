// ---------------------------------------------------------
// Trading tier definitions. A tier bounds a client's session
// upside by capping the maximum profit PAID OUT — it never
// guarantees or "insures" a result. Losses are NEVER capped;
// only real, calculated gains are bounded, and only once a
// session closes. Nothing here promises a return up front.
//
// Single source of truth pattern — change the numbers here, nothing
// else should hardcode tier values.
// ---------------------------------------------------------

export const TIERS = [
  {
    id: 'tier1',
    name: 'Tier 1 — Starter',
    description: 'Smaller position sizing for clients new to the framework. Payout capped; downside is not.',
    maxPayoutMultiplier: 3, // max payout = 300% of session starting amount
    minDeposit: 100,
    maxDeposit: 999,
    durationDays: 2,
    durationRange: { min: 1, max: 3 },
    leverageRange: { min: 1, max: 300 },
    defaultLeverage: 2
  },
  {
    id: 'tier2',
    name: 'Tier 2 — Standard',
    description: 'Standard allocation for clients comfortable with regular position sizes.',
    maxPayoutMultiplier: 5,
    minDeposit: 1000,
    maxDeposit: 4999,
    durationDays: 5,
    durationRange: { min: 3, max: 7 },
    leverageRange: { min: 1, max: 500 },
    defaultLeverage: 5
  },
  {
    id: 'tier3',
    name: 'Tier 3 — Full Allocation',
    description: 'Full allocation for experienced clients.',
    maxPayoutMultiplier: 10,
    minDeposit: 5000,
    maxDeposit: 24999,
    durationDays: 7,
    durationRange: { min: 5, max: 14 },
    leverageRange: { min: 1, max: 1000 },
    defaultLeverage: 10
  }
]

// Hidden, admin-only tiers — never shown in a client's own tier
// picker (Sessions.jsx filters these out by checking `hidden`).
// Mini VIP covers accounts too small for Tier 1's $100 floor; Major
// VIP covers the same $25,000+ bracket that already gets flagged for
// manual review at deposit time (LARGE_ACCOUNT_THRESHOLD below) — so
// requiring an admin to set these up isn't a new rule, it's the same
// "large/unusual accounts get a human, not an auto-assignment" rule
// already in place, just extended to the tier itself.
export const VIP_TIERS = [
  {
    id: 'mini_vip',
    name: 'Mini VIP',
    description: 'Small-balance accounts below the standard Tier 1 floor. Admin-assigned only.',
    maxPayoutMultiplier: 2,
    minDeposit: 10,
    maxDeposit: 99,
    durationDays: 1,
    durationRange: { min: 1, max: 2 },
    leverageRange: { min: 1, max: 100 },
    defaultLeverage: 2,
    hidden: true
  },
  {
    id: 'major_vip',
    name: 'Major VIP',
    description: 'High-balance accounts above the standard tier ceiling. Admin-assigned only.',
    maxPayoutMultiplier: 15,
    minDeposit: 25001,
    maxDeposit: Infinity,
    durationDays: 14,
    durationRange: { min: 7, max: 30 },
    leverageRange: { min: 1, max: 2000 },
    defaultLeverage: 20,
    hidden: true
  }
]

// Every tier that actually exists, hidden or not — used anywhere a
// session's tier needs to resolve correctly regardless of whether a
// client would ever see it in their own picker (settlement math,
// leverage clamping, admin's own tier-assignment dropdown, etc).
export const ALL_TIERS = [...TIERS, ...VIP_TIERS]

// Deposits at or above this amount skip the automated tier
// bands entirely — they're flagged for the admin to review
// and set up by hand, rather than auto-assigned.
export const LARGE_ACCOUNT_THRESHOLD = 25000

export function getTier(tierId) {
  return ALL_TIERS.find((t) => t.id === tierId) || null
}

// Clamps a requested leverage into the tier's allowed range. Used
// anywhere leverage is set, so a session can never end up outside
// what its tier permits, no matter which UI/function set it.
export function clampLeverage(tierId, requested) {
  const tier = getTier(tierId)
  if (!tier) return requested
  const { min, max } = tier.leverageRange
  return Math.min(max, Math.max(min, Math.round(requested)))
}

// Same idea as clampLeverage, for a session's chosen duration (in
// days). Selectable at session creation, and editable afterward by
// an admin — same pattern as leverage.
export function clampDuration(tierId, requestedDays) {
  const tier = getTier(tierId)
  if (!tier) return requestedDays
  const { min, max } = tier.durationRange
  return Math.min(max, Math.max(min, Math.round(requestedDays)))
}

// Given a deposit amount, find the tier band it falls into.
// Returns null if it's at/above LARGE_ACCOUNT_THRESHOLD —
// callers should treat null as "needs manual review", not
// as an error.
export function tierForDeposit(amount) {
  if (amount >= LARGE_ACCOUNT_THRESHOLD) return null
  return TIERS.find((t) => amount >= t.minDeposit && amount <= t.maxDeposit) || null
}
