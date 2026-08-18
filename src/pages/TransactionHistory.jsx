import Layout from '../components/Layout.jsx'
import { Inbox, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, Receipt, Gift, Percent } from 'lucide-react'
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
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function TypeIcon({ type }) {
  if (type === 'deposit') return <ArrowDownToLine size={17} />
  if (type === 'withdrawal') return <ArrowUpFromLine size={17} />
  if (type === 'session_settlement' || type === 'capped_profit_release') return <TrendingUp size={17} />
  if (type === 'fee' || type === 'fee_payment') return <Receipt size={17} />
  if (type === 'fee_discount') return <Percent size={17} />
  if (type === 'referral_bonus' || type === 'signup_bonus') return <Gift size={17} />
  return <Receipt size={17} />
}

export default function TransactionHistory() {
  const { transactions } = useApp()
  const { currentUser } = useAuth()
  const fullHistory = getFullTransactionHistory(transactions, currentUser.id)

  return (
    <Layout pageTitle="Transaction History">
      <h1 className="page-title">Transaction History</h1>
      <p className="page-sub">
        Every deposit, withdrawal, fee, fee payment, session settlement, and pending-profit review on your
        account — with a running balance, like a bank statement. A fee never affects your balance by itself;
        only a genuine deposit, withdrawal, or the excess from an overpaid fee ever moves it. Pending/rejected
        rows show the balance as it stood before them, since they haven't affected your account.
      </p>

      <div className="panel">
        {fullHistory.length === 0 ? (
          <div className="empty-state">
            <Inbox size={20} />
            <p>Nothing yet — deposits, withdrawals, and session results will show up here.</p>
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            {fullHistory.map((t) => {
              const isCredit = t.type === 'deposit' || t.type === 'session_settlement' || t.type === 'capped_profit_release' || t.type === 'referral_bonus' || t.type === 'signup_bonus'
              const isFeePayment = t.type === 'fee_payment'
              const signedAmount = isCredit ? t.amount : -t.amount
              const accentClass = t.status !== 'approved'
                ? 'entity-card-accent-pending'
                : isFeePayment ? '' : (signedAmount >= 0 ? 'entity-card-accent-profit' : 'entity-card-accent-loss')
              return (
                <div key={t.id} className={'entity-card ' + accentClass}>
                  <div className="icon-badge"><TypeIcon type={t.type} /></div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">
                      {formatType(t.type)}
                      {t.type === 'fee' && (
                        <span style={{ fontSize: 11, marginLeft: 6, color: t.feeStatus === 'paid' ? 'var(--success)' : 'var(--danger)' }}>
                          ({t.feeStatus === 'paid' ? 'paid' : 'outstanding'})
                        </span>
                      )}
                    </div>
                    <div className="entity-card-meta">
                      <span>{formatDate(t.date)}</span>
                      <span>Balance after: {formatMoney(t.runningBalance)}</span>
                      {isFeePayment && t.spilloverAmount > 0 && (
                        <span>{formatMoney(t.amount - t.spilloverAmount)} to Fee Balance, {formatMoney(t.spilloverAmount)} spilled to your balance</span>
                      )}
                      {isFeePayment && t.spilloverAmount === 0 && <span>Applied to Fee Balance</span>}
                      {t.note === 'Excess from fee payment' && <span>Excess from fee payment</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: 'none' }}>
                    <div
                      className={t.status === 'approved' && !isFeePayment ? (signedAmount >= 0 ? 'pnl-up' : 'pnl-down') : undefined}
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16 }}
                    >
                      {isFeePayment ? formatMoney(t.amount) : t.status === 'approved' ? (signedAmount >= 0 ? '+' : '') + formatMoney(signedAmount) : formatMoney(t.amount)}
                    </div>
                    <span className={'status-pill status-' + t.status}>{t.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
