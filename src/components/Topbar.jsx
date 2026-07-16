import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Bell, Moon, Sun, Wifi, WifiOff, User, LogOut, ChevronRight, Home } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import { getNotificationMeta } from '../config/notificationTypes.js'

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function Topbar({ pageTitle }) {
  const { theme, setTheme, priceFeedStatus } = useApp()
  const { currentUser, logout } = useAuth()
  const { getNotificationsForUser, getUnreadCount, markAsRead, markAllAsRead } = useNotifications()
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

  const myNotifications = currentUser ? getNotificationsForUser(currentUser.id) : []
  const unreadCount = currentUser ? getUnreadCount(currentUser.id) : 0
  const recentNotifications = myNotifications.slice(0, 6)

  return (
    <div>
      <div className="topbar-row">
        <span className={'badge-demo' + (priceFeedStatus.error ? ' badge-feed-warning' : '')}>
          {priceFeedStatus.error ? <WifiOff size={13} /> : <Wifi size={13} />}
          {priceFeedStatus.error
            ? ' Price feed unavailable — showing last known price'
            : priceFeedStatus.lastUpdated
              ? ` Live prices · updated ${timeAgo(priceFeedStatus.lastUpdated)}`
              : ' Connecting to live prices…'}
        </span>
        <div className="topbar-right">
          <div className="notif-wrap" ref={notifRef}>
            <button
              className="icon-btn"
              style={{ position: 'relative' }}
              onClick={() => {
                setNotifOpen((o) => !o)
                if (!notifOpen && currentUser) markAllAsRead(currentUser.id)
              }}
            >
              <Bell size={16} />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="dropdown-panel">
                <div className="dropdown-head">Notifications</div>
                {recentNotifications.length === 0 ? (
                  <div className="dropdown-item" style={{ color: 'var(--text-muted)' }}>Nothing yet — real events will show up here.</div>
                ) : (
                  recentNotifications.map((n) => {
                    const { icon: Icon, colorVar } = getNotificationMeta(n.type)
                    return (
                      <div className="dropdown-item" key={n.id} onClick={() => markAsRead(n.id)} style={{ cursor: 'pointer' }}>
                        <span className="dropdown-item-icon" style={{ color: colorVar }}><Icon size={14} /></span>
                        <span>
                          <strong style={{ display: 'block', fontSize: 12.5 }}>{n.title}</strong>
                          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{timeAgo(n.date)}</span>
                        </span>
                      </div>
                    )
                  })
                )}
                <Link to="/notifications" className="dropdown-link" style={{ justifyContent: 'center', borderTop: '1px solid var(--border)' }}>
                  View all
                </Link>
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
