import { useState } from 'react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import { getNotificationMeta } from '../config/notificationTypes.js'

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function dayLabel(iso) {
  const d = new Date(iso); const now = new Date()
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(now) - start(d)) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return 'Earlier'
}

function timeOnly(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function Notifications() {
  const { currentUser } = useAuth()
  const { getNotificationsForUser, markAsRead, markAllAsRead } = useNotifications()
  const [filter, setFilter] = useState('all')

  const myNotifications = getNotificationsForUser(currentUser.id)
  const unreadCount = myNotifications.filter((n) => !n.read).length
  const shown = filter === 'unread' ? myNotifications.filter((n) => !n.read) : myNotifications

  // Group by day, keeping the existing newest-first order.
  const groups = []
  shown.forEach((n) => {
    const label = dayLabel(n.date)
    let g = groups.find((x) => x.label === label)
    if (!g) { g = { label, items: [] }; groups.push(g) }
    g.items.push(n)
  })

  return (
    <Layout pageTitle="Notifications">
      <header className="dz-head">
        <h1 className="dz-title">Notifications</h1>
        <div className="dz-muted">Every real event on your account: trades, sessions, deposits and milestones.</div>
      </header>

      <div className="nt-bar">
        <div className="pg-filters" role="tablist" aria-label="Filter notifications" style={{ margin: 0 }}>
          <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
          <button type="button" role="tab" aria-selected={filter === 'unread'} className={filter === 'unread' ? 'on' : ''} onClick={() => setFilter('unread')}>Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}</button>
        </div>
        {unreadCount > 0 && (
          <button type="button" className="dz-btn-o nt-markall" onClick={() => markAllAsRead(currentUser.id)}>Mark all as read</button>
        )}
      </div>

      <div className="dz-card nt-card">
        {myNotifications.length === 0 ? (
          <div className="dz-empty">Nothing yet. This fills up as you start sessions, deposit or withdraw.</div>
        ) : shown.length === 0 ? (
          <div className="dz-empty">You're all caught up.</div>
        ) : (
          groups.map((g) => (
            <section key={g.label}>
              <div className="nt-day">{g.label}</div>
              {g.items.map((n) => {
                const { icon: Icon, colorVar } = getNotificationMeta(n.type)
                return (
                  <button key={n.id} type="button" className={'nt-item' + (n.read ? '' : ' unread')} onClick={() => markAsRead(n.id)}>
                    <span className="nt-icon" style={{ color: colorVar }}><Icon size={18} /></span>
                    <span className="nt-body">
                      <span className="nt-top"><strong>{n.title}</strong><span className="nt-time">{g.label === 'Earlier' ? formatDate(n.date) : timeOnly(n.date)}</span></span>
                      <span className="nt-msg">{n.message}</span>
                    </span>
                    {!n.read && <span className="nt-dot" aria-label="Unread" />}
                  </button>
                )
              })}
            </section>
          ))
        )}
      </div>
    </Layout>
  )
}
