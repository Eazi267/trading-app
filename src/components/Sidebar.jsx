import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PiggyBank, ListChecks, Star, ArrowLeftRight, Gift, Settings, ClipboardCheck, Users, Sliders, CandlestickChart, BarChart3, Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { BRAND } from '../config/brand.js'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/markets', label: 'Markets', icon: CandlestickChart },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/balance', label: 'Balance', icon: PiggyBank },
  { to: '/sessions', label: 'Sessions', icon: ListChecks },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/transactions', label: 'Deposit / Withdraw', icon: ArrowLeftRight },
  { to: '/referral', label: 'Referrals', icon: Gift },
  { to: '/settings', label: 'Settings', icon: Settings }
]

const adminLinks = [
  { to: '/admin/requests', label: 'Pending Requests', icon: ClipboardCheck },
  { to: '/admin/users', label: 'Clients', icon: Users },
  { to: '/admin/scenario', label: 'Scenario Control', icon: Sliders }
]

export default function Sidebar() {
  const { currentUser } = useAuth()

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><BRAND.LogoIcon size={18} /></div>
        {BRAND.name}
      </div>
      <nav>
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <Icon size={16} /> {label}
          </NavLink>
        ))}

        {currentUser?.role === 'admin' && (
          <>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '18px 12px 8px' }}>
              Admin
            </div>
            {adminLinks.map(({ to, label, icon: Icon }) => (
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