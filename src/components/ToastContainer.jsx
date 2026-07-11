import { X } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext.jsx'
import { getNotificationMeta } from '../config/notificationTypes.js'

export default function ToastContainer() {
  const { toasts, dismissToast } = useNotifications()

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack">
      {toasts.map((toast) => {
        const { icon: Icon, colorVar } = getNotificationMeta(toast.type)
        return (
          <div className="toast-card" key={toast.id} style={{ borderLeftColor: colorVar }}>
            <div className="toast-icon" style={{ color: colorVar }}><Icon size={16} /></div>
            <div className="toast-body">
              <div className="toast-title">{toast.title}</div>
              {toast.message && <div className="toast-message">{toast.message}</div>}
            </div>
            <button className="toast-close" onClick={() => dismissToast(toast.id)}><X size={13} /></button>
          </div>
        )
      })}
    </div>
  )
}
