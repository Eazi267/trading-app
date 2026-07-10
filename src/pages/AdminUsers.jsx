import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export default function AdminUsers() {
  const { transactions } = useApp()
  const { users } = useAuth()
  const navigate = useNavigate()

  function balanceFor(userId) {
    return transactions
      .filter((t) => t.userId === userId && t.status === 'approved')
      .reduce((sum, t) => sum + (t.type === 'deposit' ? t.amount : -t.amount), 0)
  }

  function pendingCountFor(userId) {
    return transactions.filter((t) => t.userId === userId && t.status === 'pending').length
  }

  return (
    <Layout pageTitle="Users">
      <h1 className="page-title">Users</h1>
      <p className="page-sub">Click a user to view and manage their account, including trades.</p>

      <div className="panel">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Balance</th><th>Pending</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} onClick={() => navigate(`/admin/users/${u.id}`)} style={{ cursor: 'pointer' }}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
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