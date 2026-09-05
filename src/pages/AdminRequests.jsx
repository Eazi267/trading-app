import { useState } from 'react'
import { Inbox, Check, X, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, Gift, Play, Lock, ShieldCheck, Camera, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import ScreenshotUploader from '../components/ScreenshotUploader.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getTier } from '../config/tiers.js'
import { METHOD_LABELS } from '../config/paymentMethods.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatType(type) {
  if (type === 'capped_profit_release') return 'Capped profit release'
  return type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}


// A distinct icon per request type — the whole point of a card
// layout over a table is that the type is recognizable at a glance,
// not just readable as text.
function TypeIcon({ type }) {
  if (type === 'deposit') return <ArrowDownToLine size={18} />
  if (type === 'withdrawal') return <ArrowUpFromLine size={18} />
  if (type === 'session_settlement' || type === 'capped_profit_release') return <TrendingUp size={18} />
  return <Gift size={18} />
}

export default function AdminRequests() {
  const { transactions, sessions, approveTransaction, rejectTransaction, correctTransactionAmount, beginAwaitingSession, cancelAwaitingSession, isSessionUnlocked } = useApp()
  const { users } = useAuth()
  const [correctingId, setCorrectingId] = useState(null)
  const [correctionDraft, setCorrectionDraft] = useState({ amount: '', screenshots: [], note: '' })
  const pending = transactions.filter((t) => t.status === 'pending')
  const awaitingSessions = sessions.filter((s) => s.status === 'awaiting_start')
  const pendingKyc = users.filter((u) => u.kyc?.status === 'pending')
  const pendingEnhancedKyc = users.filter((u) => u.kycEnhanced?.status === 'pending')
  const resolved = transactions.filter((t) => t.status !== 'pending').slice(0, 10)

  function startCorrecting(t) {
    setCorrectingId(t.id)
    setCorrectionDraft({ amount: t.amount, screenshots: t.correctionEvidence || [], note: t.correctionNote || '' })
  }

  function saveCorrection(id) {
    const value = parseFloat(correctionDraft.amount)
    if (!value || value <= 0) return
    correctTransactionAmount(id, value, correctionDraft.screenshots, correctionDraft.note)
    setCorrectingId(null)
  }

  return (
    <Layout pageTitle="Pending Requests">
      <h1 className="page-title">Pending Requests</h1>
      <p className="page-sub">Approve or reject deposit/withdrawal requests and certify session results from all users.</p>

      <div className="panel">
        <div className="panel-head">
          <h3>Awaiting action ({pending.length + awaitingSessions.length + pendingKyc.length + pendingEnhancedKyc.length})</h3>
        </div>
        {pending.length === 0 && awaitingSessions.length === 0 && pendingKyc.length === 0 && pendingEnhancedKyc.length === 0 ? (
          <div className="empty-state">
            <Inbox size={20} />
            <p>Nothing pending right now.</p>
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            {pendingEnhancedKyc.map((u) => (
              <div key={'kyc-enhanced-' + u.id} className="entity-card entity-card-accent-pending">
                <div className="icon-badge"><ShieldCheck size={18} /></div>
                <div className="entity-card-body">
                  <div className="entity-card-title"><Link to={`/admin/users/${u.id}`} style={{ color: 'inherit', fontWeight: 600 }}>{u.name}</Link> · Enhanced verification</div>
                  <div className="entity-card-meta">
                    <span>Proof of address</span>
                    <span>Submitted {formatDate(u.kycEnhanced.submittedAt)}</span>
                  </div>
                </div>
                <Link to={`/admin/users/${u.id}`} className="tx-btn deposit" style={{ padding: '7px 12px', fontSize: 12.5, flex: 'none', textDecoration: 'none' }}>
                  Review
                </Link>
              </div>
            ))}
            {pendingKyc.map((u) => (
              <div key={'kyc-' + u.id} className="entity-card entity-card-accent-pending">
                <div className="icon-badge"><ShieldCheck size={18} /></div>
                <div className="entity-card-body">
                  <div className="entity-card-title"><Link to={`/admin/users/${u.id}`} style={{ color: 'inherit', fontWeight: 600 }}>{u.name}</Link> · Identity verification</div>
                  <div className="entity-card-meta">
                    <span>{u.kyc.documentType === 'passport' ? 'Passport' : 'National ID'}</span>
                    <span>Submitted {formatDate(u.kyc.submittedAt)}</span>
                  </div>
                </div>
                <Link to={`/admin/users/${u.id}`} className="tx-btn deposit" style={{ padding: '7px 12px', fontSize: 12.5, flex: 'none', textDecoration: 'none' }}>
                  Review
                </Link>
              </div>
            ))}
            {awaitingSessions.map((s) => {
              const tier = getTier(s.tierId)
              const owner = users.find((u) => u.id === s.userId)
              return (
                <div key={'session-' + s.id} className="entity-card entity-card-accent-pending">
                  <div className="icon-badge"><Lock size={18} /></div>
                  <div className="entity-card-body">
                    <div className="entity-card-title"><Link to={`/admin/users/${s.userId}`} style={{ color: 'inherit', fontWeight: 600 }}>{owner?.name || 'Client'}</Link> · {tier?.name || s.tierId} · {formatMoney(s.amount)} committed</div>
                    <div className="entity-card-meta">
                      <span>Committed {formatDate(s.committedAt)}</span>
                      <span>{s.durationDays}-day session once started</span>
                    </div>
                  </div>
                  <button className="tx-btn deposit" style={{ padding: '7px 12px', fontSize: 12.5, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => beginAwaitingSession(s.id)}>
                    <Play size={13} /> Begin
                  </button>
                  <button className="tx-btn withdraw" style={{ padding: '7px 12px', fontSize: 12.5, flex: 'none' }} onClick={() => cancelAwaitingSession(s.id)}>
                    Cancel
                  </button>
                </div>
              )
            })}
            {pending.map((t) => {
              const isSignedType = t.type === 'session_settlement' || t.type === 'capped_profit_release'
              const isLoss = isSignedType && t.amount < 0
              const isLockedExcess = t.type === 'capped_profit_release' && !isSessionUnlocked(t.sessionId)
              const canCorrect = (t.type === 'deposit' || t.type === 'fee_payment') && !isLockedExcess
              const isCorrecting = correctingId === t.id
              const wasCorrected = t.requestedAmount != null && t.requestedAmount !== t.amount
              return (
                <div key={t.id} className={'entity-card ' + (isLockedExcess ? 'entity-card-accent-pending' : isSignedType ? (isLoss ? 'entity-card-accent-loss' : 'entity-card-accent-profit') : 'entity-card-accent-pending')} style={{ flexWrap: 'wrap' }}>
                  <div className="icon-badge">{isLockedExcess ? <Lock size={17} /> : <TypeIcon type={t.type} />}</div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">
                      <Link to={`/admin/users/${t.userId}`} style={{ color: 'inherit', fontWeight: 600 }}>{t.userName}</Link> · {formatType(t.type)}
                    </div>
                    <div className="entity-card-meta">
                      <span>{formatDate(t.date)}</span>
                      {t.type === 'withdrawal' && t.withdrawalMethod && (
                        <span>{METHOD_LABELS[t.withdrawalMethod] || t.withdrawalMethod}{t.withdrawalChain ? ` (${t.withdrawalChain})` : ''}{t.destinationAddress ? ` → ${t.destinationAddress}` : ''}</span>
                      )}
                      {(t.type === 'deposit' || t.type === 'fee_payment') && t.depositMethod && (
                        <span>via {METHOD_LABELS[t.depositMethod] || t.depositMethod}{t.depositChain ? ` (${t.depositChain})` : ''}{t.depositReference ? ` · ${t.depositReference}` : ''}</span>
                      )}
                      {t.type === 'deposit' && t.verificationStatus === 'unavailable' && (
                        <span style={{ color: 'var(--text-muted)' }}>Blockchain verification: not connected — review manually</span>
                      )}
                      {isLockedExcess && <span style={{ color: 'var(--accent-bright)' }}>Needs a paid unlock fee before release</span>}
                      {wasCorrected && (
                        <span style={{ color: 'var(--accent-bright)' }}>
                          Requested {formatMoney(t.requestedAmount)} → confirmed {formatMoney(t.amount)}
                          {t.correctionEvidence?.length > 0 ? ` · ${t.correctionEvidence.length} screenshot${t.correctionEvidence.length === 1 ? '' : 's'}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 16, flex: 'none',
                      color: isSignedType ? (isLoss ? 'var(--danger)' : 'var(--success)') : 'var(--text)'
                    }}
                  >
                    {isSignedType && t.amount >= 0 ? '+' : ''}{formatMoney(t.amount)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                    {canCorrect && (
                      <button
                        className="tx-btn"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => (isCorrecting ? setCorrectingId(null) : startCorrecting(t))}
                      >
                        <Camera size={13} /> {wasCorrected ? 'Edit correction' : 'Correct amount'}
                        <ChevronDown size={12} style={{ transform: isCorrecting ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s var(--ease)' }} />
                      </button>
                    )}
                    {isLockedExcess ? (
                      <Link to={`/admin/users/${t.userId}`} className="tx-btn" style={{ padding: '6px 10px', fontSize: 12, textDecoration: 'none' }}>
                        Add fee
                      </Link>
                    ) : (
                      <button className="icon-btn" onClick={() => approveTransaction(t.id)} aria-label="Approve">
                        <Check size={15} />
                      </button>
                    )}
                    <button className="icon-btn" onClick={() => rejectTransaction(t.id)} aria-label="Reject">
                      <X size={15} />
                    </button>
                  </div>

                  {isCorrecting && (
                    <div style={{ width: '100%', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                        Fix this before approving if the client sent more or less than they requested — the amount
                        below is what actually lands on their balance{t.type === 'fee_payment' ? ' and fee allocation' : ''}, not what they typed.
                      </p>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 10 }}>
                        <label style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          Actual amount received (USD)
                          <input
                            type="number"
                            value={correctionDraft.amount}
                            onChange={(e) => setCorrectionDraft((prev) => ({ ...prev, amount: e.target.value }))}
                            style={{ display: 'block', width: 160, marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                          />
                        </label>
                        <input
                          type="text"
                          value={correctionDraft.note}
                          onChange={(e) => setCorrectionDraft((prev) => ({ ...prev, note: e.target.value }))}
                          placeholder="Note (optional) — e.g. network fee deducted"
                          style={{ flex: 1, minWidth: 200, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                        />
                      </div>
                      <ScreenshotUploader
                        label="Evidence (transaction hash, wallet balance, bank receipt, etc.)"
                        images={correctionDraft.screenshots}
                        onChange={(screenshots) => setCorrectionDraft((prev) => ({ ...prev, screenshots }))}
                      />
                      <button className="tx-btn deposit" style={{ marginTop: 10, padding: '8px 16px', fontSize: 13 }} onClick={() => saveCorrection(t.id)}>
                        Save correction
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3>Recently resolved</h3>
        </div>
        {resolved.length === 0 ? (
          <div className="empty-state"><p>Nothing resolved yet.</p></div>
        ) : (
          <div style={{ padding: 16 }}>
            {resolved.map((t) => (
              <div key={t.id} className={'entity-card ' + (t.status === 'approved' ? 'entity-card-accent-profit' : 'entity-card-accent-loss')}>
                <div className="icon-badge"><TypeIcon type={t.type} /></div>
                <div className="entity-card-body">
                  <div className="entity-card-title"><Link to={`/admin/users/${t.userId}`} style={{ color: 'inherit', fontWeight: 600 }}>{t.userName}</Link> · {formatType(t.type)}</div>
                  <div className="entity-card-meta">
                    <span>{formatMoney(t.amount)}</span>
                  </div>
                </div>
                <span className={'status-pill status-' + t.status}>{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
