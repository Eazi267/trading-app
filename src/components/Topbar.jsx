import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Moon, Sun, FlaskConical, User, LogOut, ChevronRight, Home } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { isLiveMode } from '../config/tradingMode.js'

const MOCK_NOTIFICATIONS = [
  { icon: '↓', text: 'Simulated deposit of $500 recorded' },
  { icon: '↑', text: 'Simulated withdrawal of $120 recorded' }
]

export default function Topbar({ pageTitle }) {
  const { theme, setTheme, transactions } = useApp()
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const notifRef = useRef(null)
  const avatarRef = useRef(null)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function initials(name) {
    return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  }

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const notifItems = transactions.length > 0
    ? transactions.slice(0, 4).map((t) => ({
        icon: t.type === 'deposit' ? '↓' : '↑',
        text: `Simulated ${t.type} of $${t.amount.toLocaleString()} recorded`
      }))
    : MOCK_NOTIFICATIONS

  return (
    <div>
      <div className="topbar-row">
        <span className="badge-demo">
          <FlaskConical size={13} /> {isLiveMode ? 'Live — Deriv connected' : 'Demo — no real funds'}
        </span>
        <div className="topbar-right">
          <div className="notif-wrap" ref={notifRef}>
            <button className="icon-btn" onClick={() => setNotifOpen((o) => !o)}>
              <Bell size={16} />
            </button>
            {notifOpen && (
              <div className="dropdown-panel">
                <div className="dropdown-head">Notifications</div>
                {notifItems.map((n, i) => (
                  <div className="dropdown-item" key={i}>
                    <span className="dropdown-item-icon">{n.icon}</span>
                    <span>{n.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className="avatar-wrap" ref={avatarRef}>
            <div
              className="avatar"
              onClick={() => setAvatarOpen((o) => !o)}
              style={currentUser?.avatar ? { background: `url(${currentUser.avatar}) center/cover` } : undefined}
            >
              {!currentUser?.avatar && (currentUser ? initials(currentUser.name) : '--')}
            </div>
            {avatarOpen && (
              <div className="dropdown-panel dropdown-panel-right">
                <a className="dropdown-link" href="/settings"><User size={14} /> Profile</a>
                <div className="dropdown-divider" />
                <button className="dropdown-link" onClick={handleLogout}><LogOut size={14} /> Log out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="breadcrumb">
        <Home size={12} /> Pages <ChevronRight size={12} /> <span>{pageTitle}</span>
      </div>
    </div>
  )
}