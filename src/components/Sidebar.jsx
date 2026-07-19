import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PiggyBank, ListChecks, Star, ArrowLeftRight, Gift, Settings, Users, Sliders, CandlestickChart, BarChart3, Bell, History } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { BRAND } from '../config/brand.js'

// Shown to every logged-in user, but the page behind each link
// adapts by role (Dashboard/Analytics/Balance/Deposits & Withdrawals
// show platform-wide admin views instead of personal ones) — so
// there's exactly one "Dashboard" link, not a separate admin copy.
const sharedLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/markets', label: 'Markets', icon: CandlestickChart },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/balance', label: 'Balance', icon: PiggyBank },
  { to: '/transactions', label: 'Deposits & Withdrawals', icon: ArrowLeftRight },
  { to: '/settings', label: 'Settings', icon: Settings }
]

// Only make sense for a client's own personal trading — an admin
// doesn't have sessions/a watchlist/referrals of their own, so these
// are hidden entirely for the admin role instead of showing empty.
const clientOnlyLinks = [
  { to: '/sessions', label: 'Sessions', icon: ListChecks },
  { to: '/transaction-history', label: 'Transaction History', icon: History },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/referral', label: 'Referrals', icon: Gift }
]

const adminOnlyLinks = [
  { to: '/admin/users', label: 'Clients', icon: Users },
  { to: '/admin/scenario', label: 'Scenario Control', icon: Sliders }
]

export default function Sidebar() {
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><BRAND.LogoIcon size={18} /></div>
        {BRAND.name}
      </div>
      <nav>
        {sharedLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <Icon size={16} /> {label}
          </NavLink>
        ))}

        {!isAdmin && clientOnlyLinks.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <Icon size={16} /> {label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '18px 12px 8px' }}>
              Admin
            </div>
            {adminOnlyLinks.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>
    </aside>
  )
}
