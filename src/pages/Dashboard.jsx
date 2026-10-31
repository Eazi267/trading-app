import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import AdminDashboardView from './AdminDashboardView.jsx'
import ClientDashboard from './ClientDashboard.jsx'

// Admins keep their own dashboard; clients get the redesigned one.
export default function Dashboard() {
  const { currentUser } = useAuth()
  const isAdmin = currentUser.role === 'admin'
  return (
    <Layout pageTitle={isAdmin ? 'Admin Dashboard' : 'Dashboard'}>
      {isAdmin ? <AdminDashboardView /> : <ClientDashboard />}
    </Layout>
  )
}
