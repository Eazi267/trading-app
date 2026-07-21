import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import { AppProvider } from './context/AppContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Home from './pages/Home.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Markets from './pages/Markets.jsx'
import Analytics from './pages/Analytics.jsx'
import Balance from './pages/Balance.jsx'
import Sessions from './pages/Sessions.jsx'
import Watchlist from './pages/Watchlist.jsx'
import Transactions from './pages/Transactions.jsx'
import Referral from './pages/Referral.jsx'
import Settings from './pages/Settings.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminUserDetail from './pages/AdminUserDetail.jsx'
import AdminScenario from './pages/AdminScenario.jsx'
import AdminReferralCampaigns from './pages/AdminReferralCampaigns.jsx'
import Notifications from './pages/Notifications.jsx'
import TransactionHistory from './pages/TransactionHistory.jsx'

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/markets" element={<ProtectedRoute><Markets /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/balance" element={<ProtectedRoute><Balance /></ProtectedRoute>} />
            <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
            <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            <Route path="/referral" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/transaction-history" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireRole="admin"><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/users/:id" element={<ProtectedRoute requireRole="admin"><AdminUserDetail /></ProtectedRoute>} />
            <Route path="/admin/scenario" element={<ProtectedRoute requireRole="admin"><AdminScenario /></ProtectedRoute>} />
            <Route path="/admin/referral-campaigns" element={<ProtectedRoute requireRole="admin"><AdminReferralCampaigns /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
        </AppProvider>
      </NotificationProvider>
    </AuthProvider>
  )
}