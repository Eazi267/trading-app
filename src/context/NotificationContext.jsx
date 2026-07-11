import { createContext, useContext, useState } from 'react'

const NotificationContext = createContext(null)

function loadNotifications() {
  const saved = localStorage.getItem('pulse_notifications')
  return saved ? JSON.parse(saved) : []
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(loadNotifications)
  const [toasts, setToasts] = useState([])

  function persist(next) {
    setNotifications(next)
    localStorage.setItem('pulse_notifications', JSON.stringify(next))
  }

  // The one entry point for a real event happening — adds it to the
  // permanent history AND surfaces a transient toast at the same
  // time, so nothing shows up as a toast that isn't also recorded in
  // history, and nothing shows up in history without the person
  // having been alerted when it happened.
  //   type: 'trade_opened' | 'trade_closed_profit' | 'trade_closed_loss' |
  //         'session_settled_profit' | 'session_settled_loss' |
  //         'deposit_approved' | 'withdrawal_approved' |
  //         'achievement' | 'tier_changed'
  function notify(userId, type, title, message, meta = {}) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      type,
      title,
      message,
      meta,
      read: false,
      date: new Date().toISOString()
    }
    persist([entry, ...notifications])
    pushToast(type, title, message)
    return entry
  }

  function pushToast(type, title, message) {
    const toast = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, title, message }
    setToasts((prev) => [...prev, toast])
    // Auto-dismiss after 5s — the toast itself is just a transient
    // surface; the real record already lives in `notifications`.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id))
    }, 5000)
  }

  function dismissToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  function getNotificationsForUser(userId) {
    return notifications.filter((n) => n.userId === userId)
  }

  function getUnreadCount(userId) {
    return notifications.filter((n) => n.userId === userId && !n.read).length
  }

  function markAsRead(id) {
    persist(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  function markAllAsRead(userId) {
    persist(notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)))
  }

  const value = {
    toasts,
    dismissToast,
    notify,
    pushToast,
    getNotificationsForUser,
    getUnreadCount,
    markAsRead,
    markAllAsRead
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return ctx
}
