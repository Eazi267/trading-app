import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuditProvider } from './context/AuditContext.jsx'
import { EmailProvider } from './context/EmailContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import { SupportProvider } from './context/SupportContext.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Home from './pages/Home.jsx'
import AboutUs from './pages/AboutUs.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import Help from './pages/Help.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Markets from './pages/Markets.jsx'
import Analytics from './pages/Analytics.jsx'
import Balance from './pages/Balance.jsx'
import Sessions from './pages/Sessions.jsx'
import Transactions from './pages/Transactions.jsx'
import Referral from './pages/Referral.jsx'
import Settings from './pages/Settings.jsx'
import KycVerification from './pages/KycVerification.jsx'
import Support from './pages/Support.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminAccounts from './pages/AdminAccounts.jsx'
import AdminUserDetail from './pages/AdminUserDetail.jsx'
import AdminScenario from './pages/AdminScenario.jsx'
import AdminTrading from './pages/AdminTrading.jsx'
import AdminReferralCampaigns from './pages/AdminReferralCampaigns.jsx'
import AdminGenerateClients from './pages/AdminGenerateClients.jsx'
import AdminBroadcast from './pages/AdminBroadcast.jsx'
import AdminBusinessSettings from './pages/AdminBusinessSettings.jsx'
import AdminAuditLog from './pages/AdminAuditLog.jsx'
import AdminEmailOutbox from './pages/AdminEmailOutbox.jsx'
import AdminSupportInbox from './pages/AdminSupportInbox.jsx'
import Notifications from './pages/Notifications.jsx'
import TransactionHistory from './pages/TransactionHistory.jsx'

export default function App() {
  return (
    <SettingsProvider>
      <AuditProvider>
      <EmailProvider>
      <AuthProvider>
        <NotificationProvider>
          <SupportProvider>
          <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/help" element={<Help />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/markets" element={<ProtectedRoute><Markets /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/balance" element={<ProtectedRoute><Balance /></ProtectedRoute>} />
            <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            <Route path="/referral" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/kyc" element={<ProtectedRoute><KycVerification /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/transaction-history" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireRole="admin"><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/users/:id" element={<ProtectedRoute requireRole="admin"><AdminUserDetail /></ProtectedRoute>} />
            <Route path="/admin/accounts" element={<ProtectedRoute requireRole="admin" requirePermission="manageAdmins"><AdminAccounts /></ProtectedRoute>} />
            <Route path="/admin/scenario" element={<ProtectedRoute requireRole="admin" requirePermission="manageSettings"><AdminScenario /></ProtectedRoute>} />
            <Route path="/admin/trading" element={<ProtectedRoute requireRole="admin" requirePermission="trade"><AdminTrading /></ProtectedRoute>} />
            <Route path="/admin/referral-campaigns" element={<ProtectedRoute requireRole="admin" requirePermission="manageSettings"><AdminReferralCampaigns /></ProtectedRoute>} />
            <Route path="/admin/generate-clients" element={<ProtectedRoute requireRole="admin" requirePermission="manageSettings"><AdminGenerateClients /></ProtectedRoute>} />
            <Route path="/admin/broadcast" element={<ProtectedRoute requireRole="admin" requirePermission="support"><AdminBroadcast /></ProtectedRoute>} />
            <Route path="/admin/business-settings" element={<ProtectedRoute requireRole="admin" requirePermission="manageSettings"><AdminBusinessSettings /></ProtectedRoute>} />
            <Route path="/admin/audit-log" element={<ProtectedRoute requireRole="admin"><AdminAuditLog /></ProtectedRoute>} />
            <Route path="/admin/email-outbox" element={<ProtectedRoute requireRole="admin" requirePermission="manageSettings"><AdminEmailOutbox /></ProtectedRoute>} />
            <Route path="/admin/support" element={<ProtectedRoute requireRole="admin" requirePermission="support"><AdminSupportInbox /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
        </AppProvider>
        </SupportProvider>
        </NotificationProvider>
      </AuthProvider>
      </EmailProvider>
      </AuditProvider>
    </SettingsProvider>
  )
}