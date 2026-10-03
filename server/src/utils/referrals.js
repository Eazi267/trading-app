import { pool } from '../db.js'

// The campaign (if any) actually live right now — active AND today's
// date inside [startDate, endDate]. Referral bonuses only ever check
// against this, mirroring getActiveReferralCampaign() exactly.
export async function getActiveReferralCampaign() {
  const { rows } = await pool.query(
    "SELECT * FROM referral_campaigns WHERE active = true AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE ORDER BY created_at DESC LIMIT 1"
  )
  return rows[0] || null
}

// True only the FIRST time this user has ever had a deposit approved
// — the qualifying event for a referral bonus, same principle as the
// frontend: nothing happens at signup, a genuine funded deposit is
// what counts, so a referral can't be gamed by creating an account
// and never depositing.
export async function isFirstApprovedDeposit(userId, excludingTransactionId) {
  const { rows } = await pool.query(
    "SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'deposit' AND status = 'approved' AND id != $2 LIMIT 1",
    [userId, excludingTransactionId]
  )
  return rows.length === 0
}
