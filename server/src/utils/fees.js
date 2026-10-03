import { pool } from '../db.js'

// Amount actually owed on a fee RIGHT NOW — mirrors
// getFeeOwedAmount() in AppContext.jsx exactly, including its most
// important rule: once feeStatus is 'paid', that's permanent. Without
// this check first, a fee paid in full while a discount was active
// would silently become "owed again" the moment the discount expired,
// because the math below would then price it against the full
// (undiscounted) amount instead of what was actually agreed and paid.
// This was a real fixed bug on the frontend — see
// principles-and-architecture's "Known fixed bug" note — so the
// server-side port checks it first on purpose, not as an
// afterthought.
export function feeOwedAmount(fee) {
  if (fee.fee_status === 'paid') return 0
  const amount = Number(fee.amount)
  const amountPaid = Number(fee.amount_paid || 0)
  const discountActive =
    fee.discount_amount != null &&
    Number(fee.discount_amount) > 0 &&
    fee.discount_expires_at &&
    new Date(fee.discount_expires_at) > new Date()
  const base = discountActive ? Math.max(0, amount - Number(fee.discount_amount)) : amount
  return Math.max(0, base - amountPaid)
}

// Every fee still outstanding for this user, oldest first — same
// ordering payFeeBalance's allocation follows (oldest debt covered
// first).
export async function outstandingFees(userId) {
  const { rows } = await pool.query(
    "SELECT * FROM transactions WHERE user_id = $1 AND type = 'fee' ORDER BY created_at ASC",
    [userId]
  )
  return rows.filter((fee) => feeOwedAmount(fee) > 0)
}

// Greedy allocation against outstanding fees, oldest first — mirrors
// allocateAgainstOutstandingFees() exactly. Shared by the fee-payment
// creation route and (in a later batch, once fee_payment correction
// is unblocked) transaction correction, same as the frontend shares
// one function between payFeeBalance and correctTransactionAmount
// rather than two copies that could drift apart.
export async function allocateAgainstOutstandingFees(userId, amount) {
  const fees = await outstandingFees(userId)
  let remaining = amount
  const allocations = []
  for (const fee of fees) {
    if (remaining <= 0) break
    const owed = feeOwedAmount(fee)
    if (owed <= 0) continue
    const applied = Math.min(remaining, owed)
    allocations.push({ feeId: fee.id, amount: applied })
    remaining -= applied
  }
  return { allocations, spilloverAmount: Math.round(remaining * 100) / 100 }
}
