import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import { getNotificationMeta } from '../config/notificationTypes.js'

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Notifications() {
  const { currentUser } = useAuth()
  const { getNotificationsForUser, markAsRead, markAllAsRead } = useNotifications()

  const myNotifications = getNotificationsForUser(currentUser.id)
  const unreadCount = myNotifications.filter((n) => !n.read).length

  return (
    <Layout pageTitle="Notifications">
      <h1 className="page-title">Notifications</h1>
      <p className="page-sub">Every event on your account — trades, sessions, deposits, and milestones.</p>

      <div className="panel">
        <div className="panel-head">
          <h3>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</h3>
          {unreadCount > 0 && (
            <button className="tx-btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => markAllAsRead(currentUser.id)}>
              Mark all as read
            </button>
          )}
        </div>

        {myNotifications.length === 0 ? (
          <div className="empty-state"><p>Nothing yet — this fills up as you open trades, close sessions, and deposit or withdraw.</p></div>
        ) : (
          <div>
            {myNotifications.map((n) => {
              const { icon: Icon, colorVar } = getNotificationMeta(n.type)
              return (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  style={{
                    display: 'flex', gap: 12, padding: '14px 20px',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: n.read ? 'transparent' : 'var(--accent-bg)'
                  }}
                >
                  <div style={{ color: colorVar, flexShrink: 0, marginTop: 2 }}><Icon size={18} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <strong style={{ fontSize: 14 }}>{n.title}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(n.date)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                  </div>
                  {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-bright)', flexShrink: 0, marginTop: 6 }} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
