import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { DEMO_USERS } from '../context/AuthContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export default function AdminUsers() {
  const { transactions } = useApp()

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
      <p className="page-sub">All demo accounts, with balances calculated live from approved transactions.</p>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Balance</th>
              <th>Pending</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_USERS.map((u) => (
              <tr key={u.id}>
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