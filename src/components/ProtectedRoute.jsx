import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Wrap any page in this to require login. Pass requireRole="admin"
// to also require a specific role — anyone else gets bounced home.
export default function ProtectedRoute({ children, requireRole }) {
  const { currentUser } = useAuth()

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (requireRole && currentUser.role !== requireRole) {
    return <Navigate to="/" replace />
  }

  return children
}