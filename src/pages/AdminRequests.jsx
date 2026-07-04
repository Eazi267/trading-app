import { Inbox, Check, X } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminRequests() {
  const { transactions, approveTransaction, rejectTransaction } = useApp()
  const pending = transactions.filter((t) => t.status === 'pending')
  const resolved = transactions.filter((t) => t.status !== 'pending').slice(0, 10)

  return (
    <Layout pageTitle="Pending Requests">
      <h1 className="page-title">Pending Requests</h1>
      <p className="page-sub">Approve or reject deposit/withdrawal requests from all users.</p>

      <div className="panel">
        <div className="panel-head">
          <h3>Awaiting action ({pending.length})</h3>
        </div>
        {pending.length === 0 ? (
          <div className="empty-state">
            <Inbox size={20} />
            <p>Nothing pending right now.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((t) => (
                <tr key={t.id}>
                  <td>{t.userName}</td>
                  <td style={{ textTransform: 'capitalize' }}>{t.type}</td>
                  <td>{formatMoney(t.amount)}</td>
                  <td>{formatDate(t.date)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="icon-btn" onClick={() => approveTransaction(t.id)} aria-label="Approve">
                        <Check size={15} />
                      </button>
                      <button className="icon-btn" onClick={() => rejectTransaction(t.id)} aria-label="Reject">
                        <X size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3>Recently resolved</h3>
        </div>
        {resolved.length === 0 ? (
          <div className="empty-state"><p>Nothing resolved yet.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((t) => (
                <tr key={t.id}>
                  <td>{t.userName}</td>
                  <td style={{ textTransform: 'capitalize' }}>{t.type}</td>
                  <td>{formatMoney(t.amount)}</td>
                  <td><span className={'status-pill status-' + t.status}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}