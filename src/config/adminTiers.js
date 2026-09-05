// Admin accounts are no longer just "admin" — every admin has an
// adminTier that determines what they can actually do. This is the
// single source of truth both the UI (nav, route guards, in-page
// buttons) and any future backend check against, so a permission can
// never be enforced in one place and forgotten in another.
//
// super_admin is the only tier that can create/edit other admins or
// change Business Settings — deliberately, so a lower-tier admin can
// never grant themselves more access than they were given.

export const ADMIN_TIERS = {
  super_admin: {
    label: 'Super Admin',
    description: 'Full access to everything, including creating other admin accounts and changing Business Settings.',
    permissions: { trade: true, finance: true, support: true, manageAdmins: true, manageSettings: true }
  },
  finance_admin: {
    label: 'Finance Admin',
    description: 'Approves deposits and withdrawals, manages fees, reviews KYC. Cannot trade or change site settings.',
    permissions: { trade: false, finance: true, support: false, manageAdmins: false, manageSettings: false }
  },
  trading_admin: {
    label: 'Trading Admin',
    description: 'Runs the Trading Console — opens/closes positions, adjusts leverage and duration. Cannot approve payments or change settings.',
    permissions: { trade: true, finance: false, support: false, manageAdmins: false, manageSettings: false }
  },
  support_admin: {
    label: 'Support Admin',
    description: 'Handles the support inbox and broadcast messages. View-only everywhere else.',
    permissions: { trade: false, finance: false, support: true, manageAdmins: false, manageSettings: false }
  }
}

export const ADMIN_TIER_LIST = Object.entries(ADMIN_TIERS).map(([id, tier]) => ({ id, ...tier }))

// Every admin account should have an adminTier, but accounts created
// before this system existed (or the original seed admin) won't —
// treat missing as super_admin rather than locking out the very
// account someone's currently using to manage the platform.
export function getAdminTier(user) {
  return ADMIN_TIERS[user?.adminTier] || ADMIN_TIERS.super_admin
}

export function hasPermission(user, permission) {
  if (!user || user.role !== 'admin') return false
  return !!getAdminTier(user).permissions[permission]
}
