// Mirrors src/config/adminTiers.js exactly — same permission model,
// now enforced server-side too (see middleware/auth.js's
// requirePermission). If the frontend's copy changes, update this
// one the same way in the same batch, or the two enforcement layers
// drift apart. Extracting this into a package both projects import
// is the real long-term fix; duplicated-but-flagged is the pragmatic
// choice for now given the frontend and server are separate npm
// projects with no shared-code setup yet.

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

export function getAdminTier(user) {
  return ADMIN_TIERS[user?.adminTier] || ADMIN_TIERS.super_admin
}

export function hasPermission(user, permission) {
  if (!user || user.role !== 'admin') return false
  return !!getAdminTier(user).permissions[permission]
}
