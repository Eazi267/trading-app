// ---------------------------------------------------------
// Trading tier definitions. A tier bounds a client's session
// upside by capping the maximum profit PAID OUT — it never
// guarantees or "insures" a result. Losses are NEVER capped;
// only real, calculated gains are bounded, and only once a
// session closes. Nothing here promises a return up front.
//
// Single switch pattern, same as tradingMode.js — change the
// numbers here, nothing else should hardcode tier values.
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
    leverageRange: { min: 1, max: 1000 },
    defaultLeverage: 10
  }
]

// Deposits at or above this amount skip the automated tier
// bands entirely — they're flagged for the admin to review
// and set up by hand, rather than auto-assigned.
export const LARGE_ACCOUNT_THRESHOLD = 25000

export function getTier(tierId) {
  return TIERS.find((t) => t.id === tierId) || null
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

// Given a deposit amount, find the tier band it falls into.
// Returns null if it's at/above LARGE_ACCOUNT_THRESHOLD —
// callers should treat null as "needs manual review", not
// as an error.
export function tierForDeposit(amount) {
  if (amount >= LARGE_ACCOUNT_THRESHOLD) return null
  return TIERS.find((t) => amount >= t.minDeposit && amount <= t.maxDeposit) || null
}
