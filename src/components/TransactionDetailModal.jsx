import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Receipt, ShieldAlert, Send } from 'lucide-react'
import Modal from './Modal.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { METHOD_LABELS } from '../config/paymentMethods.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}
function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
function formatType(type) {
  return type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Shared by the client's own transaction views (Transactions.jsx,
// TransactionHistory.jsx) and the admin's (Transactions.jsx's
// AdminTransactionsView, AdminUserDetail.jsx) — one modal, one place
// the "which fields does an admin see that a client doesn't" line
// gets drawn, rather than three separate implementations drifting
// apart from each other on exactly the question this feature is
// about (data transparency).
export default function TransactionDetailModal({ transaction, isAdmin, onClose }) {
  const { appealTransaction } = useApp()
  const { currentUser } = useAuth()
  const [appealNote, setAppealNote] = useState('')
  const [appealSent, setAppealSent] = useState(false)
  const [appealCaseId, setAppealCaseId] = useState(null)
  const [appealError, setAppealError] = useState('')

  if (!transaction) return null
  const t = transaction
  const wasCorrected = t.requestedAmount != null && t.requestedAmount !== t.amount
  const isOwner = !isAdmin && currentUser?.id === t.userId
  const canAppeal = isOwner && wasCorrected && !t.appealed

  function handleAppeal() {
    const result = appealTransaction(t.id, appealNote)
    if (result.error) return setAppealError(result.error)
    setAppealError('')
    setAppealSent(true)
    setAppealCaseId(result.caseId)
  }

  return (
    <Modal open={!!transaction} onClose={onClose} title={`${formatType(t.type)} · #${t.id}`}>
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="stats-grid responsive-grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="stat-card">
            <div className="stat-label">Amount</div>
            <div className="stat-value">{formatMoney(t.amount)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Status</div>
            <div style={{ marginTop: 4 }}><span className={'status-pill status-' + t.status}>{t.status}</span></div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Transaction ID</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>#{t.id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Date &amp; time</span>
              <span>{formatDateTime(t.date)}</span>
            </div>
            {t.type === 'withdrawal' && t.withdrawalMethod && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Method</span>
                <span style={{ textAlign: 'right' }}>
                  {METHOD_LABELS[t.withdrawalMethod] || t.withdrawalMethod}{t.withdrawalChain ? ` (${t.withdrawalChain})` : ''}
                  {t.destinationAddress && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{t.destinationAddress}</div>}
                </span>
              </div>
            )}
            {(t.type === 'deposit' || t.type === 'fee_payment') && t.depositMethod && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Method</span>
                <span style={{ textAlign: 'right' }}>
                  {METHOD_LABELS[t.depositMethod] || t.depositMethod}{t.depositChain ? ` (${t.depositChain})` : ''}
                  {t.depositReference && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Ref: {t.depositReference}</div>}
                </span>
              </div>
            )}
            {t.type === 'fee_payment' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Applied</span>
                <span style={{ textAlign: 'right' }}>
                  {t.spilloverAmount > 0
                    ? `${formatMoney(t.amount - t.spilloverAmount)} to Fee Balance, ${formatMoney(t.spilloverAmount)} to main balance`
                    : 'Fully to Fee Balance'}
                </span>
              </div>
            )}
          </div>
        </div>

        {wasCorrected && (
          <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-dark)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-bright)', marginBottom: 4 }}>Amount corrected</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              You requested <strong>{formatMoney(t.requestedAmount)}</strong> — your account manager confirmed <strong>{formatMoney(t.amount)}</strong> actually arrived.
            </div>
            {t.correctionNote && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6 }}>Note: {t.correctionNote}</div>}
            {t.correctionEvidence?.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {t.correctionEvidence.map((img, i) => (
                  <a key={i} href={img} target="_blank" rel="noreferrer" className="file-drop-preview" style={{ margin: 0 }}>
                    <img src={img} alt={`Evidence ${i + 1}`} style={{ maxWidth: 110, maxHeight: 90 }} />
                  </a>
                ))}
              </div>
            )}

            {canAppeal && !appealSent && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--accent-dark)' }}>
                <textarea
                  value={appealNote}
                  onChange={(e) => setAppealNote(e.target.value)}
                  placeholder="Add anything support should know (optional)"
                  style={{ width: '100%', minHeight: 60, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'none' }}
                />
                {appealError && <div className="form-error" style={{ marginTop: 8 }}>{appealError}</div>}
                <button className="tx-btn withdraw" style={{ marginTop: 8, padding: '8px 16px', fontSize: 13 }} onClick={handleAppeal}>
                  <ShieldAlert size={14} /> Appeal this to support
                </button>
              </div>
            )}
            {t.appealed && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={12} /> Appealed — support has been notified.
              </div>
            )}
            {appealSent && !t.appealed && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--success)' }}>
                Sent to support.{appealCaseId && <> <Link to={`/support?case=${appealCaseId}`} style={{ color: 'inherit', textDecoration: 'underline' }}>View case</Link></>}
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Admin only
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Client user ID</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.userId}</span>
              </div>
              {t.reviewedByAdminName && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reviewed by</span>
                  <span>{t.reviewedByAdminName}{t.reviewedAt ? ` · ${formatDateTime(t.reviewedAt)}` : ''}</span>
                </div>
              )}
              {t.appealed && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Appealed</span>
                  <span>{formatDateTime(t.appealedAt)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
