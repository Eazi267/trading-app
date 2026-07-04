import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wallet, Star, ArrowLeftRight, Settings, LineChart, ClipboardCheck, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/portfolio', label: 'Portfolio', icon: Wallet },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/transactions', label: 'Deposit / Withdraw', icon: ArrowLeftRight },
  { to: '/settings', label: 'Settings', icon: Settings }
]

const adminLinks = [
  { to: '/admin/requests', label: 'Pending Requests', icon: ClipboardCheck },
  { to: '/admin/users', label: 'Users', icon: Users }
]

export default function Sidebar() {
  const { currentUser } = useAuth()

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><LineChart size={18} /></div>
        Pulse
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