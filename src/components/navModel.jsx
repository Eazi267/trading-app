import { LayoutDashboard, PiggyBank, ListChecks, ArrowLeftRight, Gift, Settings, Users, Sliders, CandlestickChart, BarChart3, Bell, History, Sparkles, Megaphone, Building2, ClipboardList, ShieldCheck, Mail, TrendingUp, UserCog, LifeBuoy } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSupport } from '../context/SupportContext.jsx'
import { hasPermission } from '../config/adminTiers.js'

// Nav is grouped to match the actual order a client moves through the
// platform: get oriented -> place a trade -> manage funds -> grow via
// referrals -> account admin. Each section only shows the role it's
// relevant to; the underlying pages already branch by role, so this
// is purely about ordering, not duplicating routes.
// Built as functions of `settings` so a feature toggle (Business
// Settings) can hide a whole nav entry without touching routes.
function clientSections(settings, currentUser, supportUnread) {
  return [
    {
      label: null, // top-level, no section header
      links: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/markets', label: 'Markets', icon: CandlestickChart }
      ]
    },
    {
      label: 'Trading',
      links: [
        { to: '/sessions', label: 'Investments', icon: ListChecks },
        { to: '/analytics', label: 'Analytics', icon: BarChart3 }
      ]
    },
    {
      label: 'Funds',
      links: [
        { to: '/balance', label: 'Balance', icon: PiggyBank },
        { to: '/transactions', label: 'Deposits & Withdrawals', icon: ArrowLeftRight },
        { to: '/transaction-history', label: 'Transaction History', icon: History }
      ]
    },
    ...(settings.showReferrals ? [{ label: 'Grow', links: [{ to: '/referral', label: 'Referrals', icon: Gift }] }] : []),
    {
      label: 'Account',
      links: [
        { to: '/notifications', label: 'Notifications', icon: Bell },
        { to: '/support', label: 'Support', icon: LifeBuoy, badge: supportUnread },
        ...(settings.kycEnabled || currentUser?.kycRequired ? [{ to: '/kyc', label: 'Verification', icon: ShieldCheck }] : []),
        { to: '/settings', label: 'Settings', icon: Settings }
      ]
    }
  ]
}

function adminSections(settings, currentUser, supportUnreadCount) {
  const can = (permission) => hasPermission(currentUser, permission)
  return [
    {
      label: null,
      links: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/markets', label: 'Markets', icon: CandlestickChart },
        { to: '/analytics', label: 'Analytics', icon: BarChart3 }
      ]
    },
    {
      label: 'Clients',
      links: [
        { to: '/admin/users', label: 'Clients', icon: Users },
        ...(can('trade') ? [{ to: '/admin/trading', label: 'Trading Console', icon: TrendingUp }] : []),
        ...(can('manageSettings') && settings.demoModeEnabled ? [{ to: '/admin/generate-clients', label: 'Generate Demo Clients', icon: Sparkles }] : []),
        ...(can('support') ? [{ to: '/admin/support', label: 'Support Inbox', icon: LifeBuoy, badge: supportUnreadCount }] : []),
        ...(can('support') ? [{ to: '/admin/broadcast', label: 'Broadcast Message', icon: Megaphone }] : []),
        ...(can('manageSettings') ? [{ to: '/admin/scenario', label: 'Scenario Control', icon: Sliders }] : []),
        ...(can('manageSettings') && settings.showReferrals ? [{ to: '/admin/referral-campaigns', label: 'Referral Campaigns', icon: Gift }] : [])
      ]
    },
    ...(can('finance') ? [{
      label: 'Funds',
      links: [
        { to: '/balance', label: 'Balance', icon: PiggyBank },
        { to: '/transactions', label: 'Deposits & Withdrawals', icon: ArrowLeftRight }
      ]
    }] : []),
    {
      label: 'Business',
      links: [
        ...(can('manageSettings') ? [{ to: '/admin/business-settings', label: 'Business Settings', icon: Building2 }] : []),
        { to: '/admin/audit-log', label: 'Audit Log', icon: ClipboardList }, // oversight tool — every admin tier can see it, none can hide their own actions
        ...(can('manageSettings') ? [{ to: '/admin/email-outbox', label: 'Email Outbox', icon: Mail }] : []),
        ...(can('manageAdmins') ? [{ to: '/admin/accounts', label: 'Admin Accounts', icon: UserCog }] : [])
      ]
    },
    {
      label: 'Account',
      links: [
        { to: '/notifications', label: 'Notifications', icon: Bell },
        { to: '/settings', label: 'Settings', icon: Settings }
      ]
    }
  ]
}


// The few pages people use constantly. Shown as the pill at the top
// of the desktop page and as the tabs of the phone dock; everything
// else stays reachable from the side rail / the "More" drawer.
function primaryLinksFor(isAdmin, currentUser) {
  if (isAdmin) {
    const can = (permission) => hasPermission(currentUser, permission)
    return [
      { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true },
      { to: '/admin/users', label: 'Clients', short: 'Clients', icon: Users },
      ...(can('trade') ? [{ to: '/admin/trading', label: 'Trading Console', short: 'Trade', icon: TrendingUp }] : []),
      { to: '/markets', label: 'Markets', short: 'Markets', icon: CandlestickChart },
      { to: '/analytics', label: 'Analytics', short: 'Stats', icon: BarChart3 }
    ]
  }
  return [
    { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true },
    { to: '/sessions', label: 'Investments', short: 'Invest', icon: ListChecks },
    { to: '/balance', label: 'Balance', short: 'Balance', icon: PiggyBank },
    { to: '/analytics', label: 'Analytics', short: 'Stats', icon: BarChart3 },
    { to: '/markets', label: 'Markets', short: 'Markets', icon: CandlestickChart }
  ]
}

// One place that decides what navigation the current user sees, so the
// rail, the top pill and the phone dock can never disagree (same
// permission checks as before — this only moved).
export function useNavModel() {
  const { currentUser } = useAuth()
  const { settings } = useSettings()
  const { myUnreadCount, unreadForAdminCount } = useSupport()
  const isAdmin = currentUser?.role === 'admin'
  const sections = isAdmin
    ? adminSections(settings, currentUser, unreadForAdminCount)
    : clientSections(settings, currentUser, myUnreadCount)
  return { isAdmin, sections, primary: primaryLinksFor(isAdmin, currentUser) }
}
