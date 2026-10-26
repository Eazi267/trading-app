// The one place a DB user row (snake_case, includes password_hash)
// becomes the shape the frontend expects (camelCase, matching
// AuthContext.jsx's user objects). Previously duplicated between
// routes/auth.js and routes/admin.js — pulled out here once Batch 9
// needed to add ~10 more fields, since editing two copies in sync is
// exactly the kind of drift this project avoids elsewhere (see
// config/adminTiers.js's own duplication warning). password_hash is
// stripped here and ONLY here, so it can never leak via a wide
// `...user` spread somewhere else.
// KYC images never travel inside the user object any more (they used to make
// every login / client list megabytes big and exposed ID photos to anything that
// could read a user). Only status + "has image" flags are sent; the image itself
// comes from GET /api/kyc/:userId/image/:slot, which checks permission and audits.
function kycMeta(k) {
  if (!k) return k
  const { frontImageDataUrl, backImageDataUrl, ...rest } = k
  return { ...rest, hasFrontImage: rest.hasFrontImage ?? !!frontImageDataUrl, hasBackImage: rest.hasBackImage ?? !!backImageDataUrl }
}

export function publicUser(row) {
  return {
    id: row.id,
    uid: row.uid,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar,
    role: row.role,
    adminTier: row.admin_tier,
    referralCode: row.referral_code,
    referredBy: row.referred_by,
    tier: row.tier,
    flaggedForReview: row.flagged_for_review,
    vipUnlocked: row.vip_unlocked,
    country: row.country,
    currencyCode: row.currency_code,
    preferredCurrency: row.preferred_currency,
    kyc: kycMeta(row.kyc),
    kycEnhanced: kycMeta(row.kyc_enhanced),
    kycRequired: row.kyc_required,
    boundWallet: row.bound_wallet,
    isDemoGenerated: row.is_demo_generated,
    deactivatedAt: row.deactivated_at,
    twoFactorEnabled: !!row.totp_enabled,
    emailVerified: !!row.email_verified_at,
    createdAt: row.created_at
  }
}
