import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PiggyBank, ListChecks, Star, ArrowLeftRight, Gift, Settings, Users, Sliders, CandlestickChart, BarChart3, Bell, History, Sparkles, Megaphone, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

// Nav is grouped to match the actual order a client moves through the
// platform: get oriented -> place a trade -> manage funds -> grow via
// referrals -> account admin. Each section only shows the role it's
// relevant to; the underlying pages already branch by role, so this
// is purely about ordering, not duplicating routes.
// Built as functions of `settings` so a feature toggle (Business
// Settings) can hide a whole nav entry without touching routes.
function clientSections(settings) {
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
        { to: '/sessions', label: 'Sessions', icon: ListChecks },
        { to: '/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/watchlist', label: 'Watchlist', icon: Star }
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
        { to: '/settings', label: 'Settings', icon: Settings }
      ]
    }
  ]
}

function adminSections(settings) {
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
        ...(settings.demoModeEnabled ? [{ to: '/admin/generate-clients', label: 'Generate Demo Clients', icon: Sparkles }] : []),
        { to: '/admin/broadcast', label: 'Broadcast Message', icon: Megaphone },
        { to: '/admin/scenario', label: 'Scenario Control', icon: Sliders },
        ...(settings.showReferrals ? [{ to: '/admin/referral-campaigns', label: 'Referral Campaigns', icon: Gift }] : [])
      ]
    },
    {
      label: 'Funds',
      links: [
        { to: '/balance', label: 'Balance', icon: PiggyBank },
        { to: '/transactions', label: 'Deposits & Withdrawals', icon: ArrowLeftRight }
      ]
    },
    {
      label: 'Business',
      links: [{ to: '/admin/business-settings', label: 'Business Settings', icon: Building2 }]
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

export default function Sidebar() {
  const { currentUser } = useAuth()
  const { settings, brand } = useSettings()
  const isAdmin = currentUser?.role === 'admin'
  const sections = isAdmin ? adminSections(settings) : clientSections(settings)

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><brand.LogoIcon size={18} /></div>
        {brand.name}
      </div>
      <nav>
        {sections.map((section, i) => (
          <div key={section.label || i} className="nav-section">
            {section.label && <div className="nav-section-label">{section.label}</div>}
            {section.links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
