import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { hasPermission } from '../config/adminTiers.js'

// Wrap any page in this to require login. Pass requireRole="admin"
// to also require a specific role. Pass requirePermission="finance"
// (etc, see config/adminTiers.js) to further gate by admin tier —
// this is what actually keeps a support_admin from reaching the
// Trading Console by typing the URL directly, since the sidebar
// hiding the link is only ever a convenience, not a real boundary.
export default function ProtectedRoute({ children, requireRole, requirePermission }) {
  const { currentUser } = useAuth()

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (requireRole && currentUser.role !== requireRole) {
    return <Navigate to="/dashboard" replace />
  }

  if (requirePermission && !hasPermission(currentUser, requirePermission)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}