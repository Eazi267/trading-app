import Layout from '../components/Layout.jsx'
import { Inbox } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getFullTransactionHistory } from '../utils/analytics.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatType(type) {
  if (type === 'capped_profit_release') return 'Capped profit release'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export default function TransactionHistory() {
  const { transactions } = useApp()
  const { currentUser } = useAuth()
  const fullHistory = getFullTransactionHistory(transactions, currentUser.id)

  return (
    <Layout pageTitle="Transaction History">
      <h1 className="page-title">Transaction History</h1>
      <p className="page-sub">
        Every deposit, withdrawal, fee, session settlement, and pending-profit review on your account —
        with a running balance, like a bank statement. Pending/rejected rows show the balance as it stood
        before them, since they haven't affected your account.
      </p>

      <div className="panel">
        {fullHistory.length === 0 ? (
          <div className="empty-state">
            <Inbox size={20} />
            <p>Nothing yet — deposits, withdrawals, and session results will show up here.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Balance after</th>
              </tr>
            </thead>
            <tbody>
              {fullHistory.map((t) => {
                const isCredit = t.type === 'deposit' || t.type === 'session_settlement' || t.type === 'capped_profit_release'
                const signedAmount = isCredit ? t.amount : -t.amount
                return (
                  <tr key={t.id}>
                    <td>{formatDate(t.date)}</td>
                    <td>
                      {formatType(t.type)}
                      {t.type === 'fee' && (
                        <span style={{ fontSize: 11, marginLeft: 6, color: t.feeStatus === 'paid' ? 'var(--success)' : 'var(--danger)' }}>
                          ({t.feeStatus === 'paid' ? 'paid' : 'outstanding'})
                        </span>
                      )}
                      {t.payingFeeId && (
                        <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--text-muted)' }}>
                          (fee payment)
                        </span>
                      )}
                    </td>
                    <td className={t.status === 'approved' ? (signedAmount >= 0 ? 'pnl-up' : 'pnl-down') : undefined}>
                      {t.status === 'approved' ? (signedAmount >= 0 ? '+' : '') + formatMoney(signedAmount) : formatMoney(t.amount)}
                    </td>
                    <td><span className={'status-pill status-' + t.status}>{t.status}</span></td>
                    <td>{formatMoney(t.runningBalance)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
