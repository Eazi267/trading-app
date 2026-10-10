import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { apiRequest } from '../api/client.js'
import { useAuth } from './AuthContext.jsx'

const NotificationContext = createContext(null)

// Notifications now live in the DATABASE. The server creates the real
// ones itself when something happens (deposit approved, session settled,
// trade opened/closed, fee paid...), so this context only:
//   1. fetches the logged-in person's list (and re-checks every 15s),
//   2. shows a toast for any NEW one that arrives while they're here,
//   3. marks them read, and
//   4. lets admins send messages/broadcasts (which the server delivers).
// Nothing is kept in localStorage any more — it could be edited by hand.
export function NotificationProvider({ children }) {
  const { currentUser } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])
  const [sentMessages, setSentMessages] = useState({}) // adminSide: { [clientId]: [...] }
  const seenIds = useRef(null) // null = first load not done yet (so old ones don't all toast)

  const userId = currentUser?.id

  function pushToast(type, title, message) {
    const toast = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, title, message }
    setToasts((prev) => [...prev, toast])
    // Auto-dismiss after 5s — the toast is only a transient surface;
    // the real record lives in the database.
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 5000)
  }

  const refreshNotifications = useCallback(async () => {
    if (!userId) return
    const result = await apiRequest('/api/notifications/mine')
    if (!result.notifications) return
    if (seenIds.current === null) {
      seenIds.current = new Set(result.notifications.map((n) => n.id))
    } else {
      const fresh = result.notifications.filter((n) => !seenIds.current.has(n.id))
      fresh.forEach((n) => {
        seenIds.current.add(n.id)
        if (!n.read) pushToast(n.type, n.title, n.message)
      })
    }
    setNotifications(result.notifications)
  }, [userId])

  useEffect(() => {
    seenIds.current = null
    setNotifications([])
    if (!userId) return
    refreshNotifications()
    const id = setInterval(refreshNotifications, 15000)
    return () => clearInterval(id)
  }, [userId, refreshNotifications])

  // notify() used to CREATE records in the browser. Now the server creates
  // them, so this only handles the few cases that still start on the frontend:
  //   achievement   -> local celebration toast for the current person only
  //   admin_message -> admin sends a one-to-one note (server delivers it)
  // Any other type is ignored: the backend already recorded it, and the
  // 15s poll will show its toast — creating it here too would duplicate it.
  async function notify(targetUserId, type, title, message) {
    if (type === 'achievement') {
      if (targetUserId === userId) pushToast(type, title, message)
      return { ok: true }
    }
    if (type === 'admin_message') {
      const result = await apiRequest('/api/notifications/broadcast', {
        method: 'POST',
        body: { userIds: [targetUserId], title, message, type: 'admin_message' }
      })
      if (result.error) return { error: result.error }
      await refreshSentMessages(targetUserId)
      return { ok: true }
    }
    return { ok: true }
  }

  // Admin broadcast to many clients at once.
  async function notifyBulk(userIds, type, title, message) {
    const result = await apiRequest('/api/notifications/broadcast', {
      method: 'POST',
      body: { userIds, title, message, type }
    })
    if (result.error) return { error: result.error }
    pushToast(type, title, `${message} (sent to ${result.sentTo} client${result.sentTo === 1 ? '' : 's'})`)
    return { ok: true, sentTo: result.sentTo }
  }

  async function refreshSentMessages(clientId) {
    const result = await apiRequest(`/api/notifications/user/${clientId}`)
    if (result.notifications) setSentMessages((prev) => ({ ...prev, [clientId]: result.notifications }))
  }

  function dismissToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Your own notifications. For another person's id (an admin looking at a
  // client's page) this returns the messages THIS admin sent them instead —
  // admins can't read a client's private notifications, only what they sent.
  function getNotificationsForUser(targetUserId) {
    if (targetUserId === userId) return notifications
    return sentMessages[targetUserId] || []
  }

  function getUnreadCount(targetUserId) {
    if (targetUserId !== userId) return 0
    return notifications.filter((n) => !n.read).length
  }

  async function markAsRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await apiRequest(`/api/notifications/${id}/read`, { method: 'POST' })
  }

  async function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await apiRequest('/api/notifications/read-all', { method: 'POST' })
  }

  const value = {
    toasts,
    dismissToast,
    notify,
    notifyBulk,
    pushToast,
    refreshNotifications,
    refreshSentMessages,
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
