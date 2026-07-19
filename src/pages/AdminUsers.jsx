import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getClients, getClientCount, getFlaggedClientCount } from '../config/clients.js'
import { getClientBalances } from '../utils/adminAnalytics.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export default function AdminUsers() {
  const { transactions, sessions } = useApp()
  const { users } = useAuth()
  const navigate = useNavigate()

  const clients = getClients(users)
  // Same real balance calculation used everywhere else (Balance
  // page, Dashboard, AdminUserDetail) — this used to be a separate,
  // simpler version here that incorrectly subtracted session wins
  // and profit releases instead of adding them.
  const balances = getClientBalances(users, transactions, sessions)

  function balanceFor(userId) {
    return balances.find((b) => b.user.id === userId)?.total ?? 0
  }

  function pendingCountFor(userId) {
    return transactions.filter((t) => t.userId === userId && t.status === 'pending').length
  }

  return (
    <Layout pageTitle="Clients">
      <h1 className="page-title">Clients</h1>
      <p className="page-sub">Click a client to view and manage their account, including trades.</p>

      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Total clients</div>
          <div className="stat-value">{getClientCount(users)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Flagged for review</div>
          <div className="stat-value">{getFlaggedClientCount(users)}</div>
        </div>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Tier</th><th>Balance</th><th>Pending</th></tr>
          </thead>
          <tbody>
            {clients.map((u) => (
              <tr key={u.id} onClick={() => navigate(`/admin/users/${u.id}`)} style={{ cursor: 'pointer' }}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td style={{ textTransform: 'capitalize' }}>{u.tier || 'None'}</td>
                <td>{formatMoney(balanceFor(u.id))}</td>
                <td>{pendingCountFor(u.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
