import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Trash2, TrendingUp, TrendingDown, Repeat, ArrowDownToLine, ArrowUpFromLine, Receipt, Wallet } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import CollapsiblePanel, { useShowMore } from '../components/CollapsiblePanel.jsx'
import CopyButton from '../components/CopyButton.jsx'
import ToggleSwitch from '../components/ToggleSwitch.jsx'
import TransactionDetailModal from '../components/TransactionDetailModal.jsx'
import { useApp, getFeeOwedAmount, positionEquity } from '../context/AppContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import { TIERS, ALL_TIERS, getTier } from '../config/tiers.js'
import { resolveDisplayCurrency, formatCurrency } from '../config/currencies.js'
import { METHOD_LABELS } from '../config/paymentMethods.js'
import { hasPermission } from '../config/adminTiers.js'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}


function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Turns a future ISO date into "2d 4h left" / "expired" for the
// session countdown. Pure display helper, no state.
function formatTimeLeft(expiresAtIso) {
  const msLeft = new Date(expiresAtIso).getTime() - Date.now()
  if (msLeft <= 0) return 'expired'
  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000))
  const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  if (days > 0) return `${days}d ${hours}h left`
  const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000))
  return `${hours}h ${minutes}m left`
}

function sessionProgress(session) {
  const start = new Date(session.startedAt).getTime()
  const end = new Date(session.expiresAt).getTime()
  const now = Date.now()
  if (end <= start) return 100
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
}

export default function AdminUserDetail() {
  const { id } = useParams()
  const userId = Number(id)
  const navigate = useNavigate()
  const {
    prices, orders, transactions, sessions, getRecentRange, getBalanceBreakdown,
    startSession, beginAwaitingSession, cancelAwaitingSession, closeSession, sessionCurrentValue, isSessionUnlocked,
    openSessionPosition, closeSessionPosition, setSessionLeverage, setSessionDuration, applyFee,
    applyDiscountToFee, getOutstandingFees, deleteTransaction,
    getEffectivePricesForSession, sessionScenarios, applySessionScenario, resetSessionScenario
  } = useApp()
  const { users, setUserTier, setClientVip, currentUser, reviewKycSubmission, setKycRequired, reviewEnhancedKyc, unbindWallet } = useAuth()
  const canFinance = hasPermission(currentUser, 'finance')
  const canTrade = hasPermission(currentUser, 'trade')
  const canSupport = hasPermission(currentUser, 'support')
  const { notify, getNotificationsForUser } = useNotifications()
  const { settings } = useSettings()

  const [newSessionTier, setNewSessionTier] = useState(TIERS[0].id)
  const [newSessionDuration, setNewSessionDuration] = useState(TIERS[0].durationDays)
  const [newSessionAmount, setNewSessionAmount] = useState('')
  const [sessionError, setSessionError] = useState('')

  // Which active session the admin is currently trading against.
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [tradeSymbol, setTradeSymbol] = useState(Object.keys(prices)[0])
  const [tradeDirection, setTradeDirection] = useState('long')
  const [tradeMargin, setTradeMargin] = useState('')
  const [tradeError, setTradeError] = useState('')
  const [leverageInput, setLeverageInput] = useState('')
  const [leverageError, setLeverageError] = useState('')
  const [durationInput, setDurationInput] = useState('')
  const [durationError, setDurationError] = useState('')
  const [feeAmount, setFeeAmount] = useState('')
  const [feeNote, setFeeNote] = useState('')
  const [feeLinkedSessionId, setFeeLinkedSessionId] = useState('')
  const [feeError, setFeeError] = useState('')
  const [feeDiscountEnabled, setFeeDiscountEnabled] = useState(false)
  const [feeDiscountAmount, setFeeDiscountAmount] = useState('')
  const [feeDiscountHours, setFeeDiscountHours] = useState('')
  const [discountingFeeId, setDiscountingFeeId] = useState(null)
  const [existingDiscountAmount, setExistingDiscountAmount] = useState('')
  const [existingDiscountHours, setExistingDiscountHours] = useState('')
  const [existingDiscountError, setExistingDiscountError] = useState('')
  const [deletingTxId, setDeletingTxId] = useState(null)
  const [viewingTx, setViewingTx] = useState(null)
  const [kycRejectReason, setKycRejectReason] = useState('')
  const [enhancedRejectReason, setEnhancedRejectReason] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [messageTitle, setMessageTitle] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messageError, setMessageError] = useState('')
  const [messageSent, setMessageSent] = useState(false)

  const targetUser = users.find((u) => u.id === userId)
  const userOrders = orders.filter((o) => o.userId === userId)
  const userTransactions = transactions.filter((t) => t.userId === userId)
  const userSessions = sessions.filter((s) => s.userId === userId)
  const ordersShowMore = useShowMore(userOrders.length)
  const transactionsShowMore = useShowMore(userTransactions.length)
  const sessionsShowMore = useShowMore(userSessions.length)
  const activeSessions = userSessions.filter((s) => s.status === 'active')

  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId) || activeSessions[0] || null

  if (!targetUser) {
    return (
      <Layout pageTitle="User not found">
        <div className="empty-state"><p>No such user.</p></div>
      </Layout>
    )
  }

  async function handleStartSession() {
    setSessionError('')
    const amount = parseFloat(newSessionAmount)
    if (!amount || amount <= 0) return
    const result = await startSession(userId, newSessionTier, amount, newSessionDuration)
    if (result.error) {
      setSessionError(result.error)
      return
    }
    setNewSessionAmount('')
  }

  async function handleOpenPosition() {
    setTradeError('')
    if (!selectedSession) return
    const margin = parseFloat(tradeMargin)
    if (!margin || margin <= 0) {
      setTradeError('Enter a margin amount above zero.')
      return
    }
    const result = await openSessionPosition(selectedSession.id, tradeSymbol, margin, tradeDirection)
    if (result.error) {
      setTradeError(result.error)
      return
    }
    setTradeMargin('')
  }

  function handleClosePosition(positionId) {
    if (!selectedSession) return
    closeSessionPosition(selectedSession.id, positionId)
  }

  async function handleSetLeverage() {
    setLeverageError('')
    if (!selectedSession) return
    const leverage = parseFloat(leverageInput)
    if (!leverage || leverage <= 0) {
      setLeverageError('Enter a leverage above zero.')
      return
    }
    const result = await setSessionLeverage(selectedSession.id, leverage)
    if (result.error) {
      setLeverageError(result.error)
      return
    }
    setLeverageInput('')
  }

  async function handleSetDuration() {
    setDurationError('')
    if (!selectedSession) return
    const days = parseFloat(durationInput)
    if (!days || days <= 0) {
      setDurationError('Enter a duration above zero.')
      return
    }
    const result = await setSessionDuration(selectedSession.id, days)
    if (result.error) {
      setDurationError(result.error)
      return
    }
    setDurationInput('')
  }

  async function handleApplyFee() {
    setFeeError('')
    const amount = parseFloat(feeAmount)
    if (!amount || amount <= 0) {
      setFeeError('Enter a fee amount above zero.')
      return
    }
    const discount = feeDiscountEnabled
      ? { discountAmount: parseFloat(feeDiscountAmount), durationHours: parseFloat(feeDiscountHours) }
      : null
    const result = await applyFee(userId, amount, feeNote.trim(), discount, feeLinkedSessionId ? Number(feeLinkedSessionId) : null)
    if (result.error) {
      setFeeError(result.error)
      return
    }
    setFeeAmount('')
    setFeeNote('')
    setFeeLinkedSessionId('')
    setFeeDiscountEnabled(false)
    setFeeDiscountAmount('')
    setFeeDiscountHours('')
  }

  async function handleApplyDiscountToExisting(feeId) {
    setExistingDiscountError('')
    const result = await applyDiscountToFee(feeId, parseFloat(existingDiscountAmount), parseFloat(existingDiscountHours))
    if (result.error) {
      setExistingDiscountError(result.error)
      return
    }
    setDiscountingFeeId(null)
    setExistingDiscountAmount('')
    setExistingDiscountHours('')
  }

  async function handleDeleteTransaction(txId) {
    setDeleteError('')
    const result = await deleteTransaction(txId, deleteReason)
    if (result.error) {
      setDeleteError(result.error)
      return
    }
    setDeletingTxId(null)
    setDeleteReason('')
  }

  function handleSendMessage() {
    setMessageError('')
    setMessageSent(false)
    if (!messageTitle.trim()) {
      setMessageError('Give the message a short title.')
      return
    }
    if (!messageBody.trim()) {
      setMessageError('Enter a message to send.')
      return
    }
    notify(userId, 'admin_message', messageTitle.trim(), messageBody.trim(), { sentByAdminName: currentUser?.name })
    setMessageTitle('')
    setMessageBody('')
    setMessageSent(true)
  }

  return (
    <Layout pageTitle={targetUser.name}>
      <button
        onClick={() => navigate('/admin/users')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, marginBottom: 10 }}
      >
        <ArrowLeft size={14} /> Back to Users
      </button>

      <h1 className="page-title">{targetUser.name}</h1>
      <p className="page-sub">
        {targetUser.email} · UID <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{targetUser.uid}</span>
        <CopyButton value={targetUser.uid} label="Copy UID" size={12} style={{ marginLeft: 2, marginRight: 2 }} /> — trade inside their active sessions below.
      </p>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Client balance</h3></div>
        <div className="stats-grid" style={{ padding: '16px 20px' }}>
          {(() => {
            const { total, available, pending, sessionBalance, outstandingFees } = getBalanceBreakdown(userId)
            const clientCurrency = resolveDisplayCurrency(targetUser, settings.currencyCode)
            return (
              <>
                <div className="stat-card">
                  <div className="stat-label">Total balance</div>
                  <div className="stat-value">{formatMoney(total)}</div>
                  {clientCurrency.code !== 'USD' && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>≈ {formatCurrency(total, clientCurrency.code)}</div>
                  )}
                </div>
                <div className="stat-card">
                  <div className="stat-label">Available</div>
                  <div className="stat-value">{formatMoney(available)}</div>
                  {clientCurrency.code !== 'USD' && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>≈ {formatCurrency(available, clientCurrency.code)}</div>
                  )}
                </div>
                <div className="stat-card">
                  <div className="stat-label">Committed to active sessions</div>
                  <div className="stat-value">{formatMoney(pending)}</div>
                  {clientCurrency.code !== 'USD' && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>≈ {formatCurrency(pending, clientCurrency.code)}</div>
                  )}
                </div>
                {sessionBalance !== 0 && (
                  <div className="stat-card" style={{ borderColor: 'var(--accent)' }}>
                    <div className="stat-label">Session balance (awaiting certification)</div>
                    <div className={'stat-value ' + (sessionBalance >= 0 ? 'pnl-up' : 'pnl-down')}>
                      {sessionBalance >= 0 ? '+' : ''}{formatMoney(sessionBalance)}
                    </div>
                    {clientCurrency.code !== 'USD' && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {sessionBalance >= 0 ? '≈ +' : '≈ '}{formatCurrency(sessionBalance, clientCurrency.code)}
                      </div>
                    )}
                  </div>
                )}
                {outstandingFees > 0 && (
                  <div className="stat-card" style={{ borderColor: 'var(--danger)' }}>
                    <div className="stat-label">Outstanding fees</div>
                    <div className="stat-value pnl-down">-{formatMoney(outstandingFees)}</div>
                    {clientCurrency.code !== 'USD' && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>≈ -{formatCurrency(outstandingFees, clientCurrency.code)}</div>
                    )}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {canSupport && (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Withdrawal wallet</h3></div>
        <div style={{ padding: '16px 20px' }}>
          {targetUser.boundWallet ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', marginBottom: 12 }}>
                <div className="icon-badge"><Wallet size={16} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {METHOD_LABELS[targetUser.boundWallet.method] || targetUser.boundWallet.method}
                    {targetUser.boundWallet.chain ? ` · ${targetUser.boundWallet.chain}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{targetUser.boundWallet.address}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Bound {formatDate(targetUser.boundWallet.boundAt)}</div>
                </div>
              </div>
              <button className="tx-btn withdraw" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => unbindWallet(userId)}>
                Unbind wallet
              </button>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No wallet bound yet — the client will be asked to bind one before their first crypto withdrawal.</p>
          )}
        </div>
      </div>
      )}

      {canFinance && (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Apply a fee</h3></div>
        {feeError && <div className="form-error" style={{ margin: '16px 20px 0' }}>{feeError}</div>}
        <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="number"
            value={feeAmount}
            onChange={(e) => setFeeAmount(e.target.value)}
            placeholder="Fee amount (USD)"
            style={{ width: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <input
            type="text"
            value={feeNote}
            onChange={(e) => setFeeNote(e.target.value)}
            placeholder="Reason (optional)"
            style={{ flex: 1, minWidth: 180, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <button className="tx-btn withdraw" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleApplyFee}>
            Charge fee
          </button>
        </div>
        {(() => {
          const lockedCappedSessions = userSessions.filter((s) =>
            s.status === 'closed' &&
            transactions.some((t) => t.type === 'capped_profit_release' && t.sessionId === s.id && t.status === 'pending') &&
            !isSessionUnlocked(s.id)
          )
          if (lockedCappedSessions.length === 0) return null
          return (
            <div style={{ padding: '0 20px 14px' }}>
              <label style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Link to a capped session (optional — required to unlock its extra profit above the tier cap)
                <select
                  value={feeLinkedSessionId}
                  onChange={(e) => setFeeLinkedSessionId(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                >
                  <option value="">No link — general fee</option>
                  {lockedCappedSessions.map((s) => {
                    const excess = transactions.find((t) => t.type === 'capped_profit_release' && t.sessionId === s.id && t.status === 'pending')
                    return (
                      <option key={s.id} value={s.id}>
                        Session from {formatDate(s.closedAt)} — {formatMoney(excess?.amount || 0)} locked above cap
                      </option>
                    )
                  })}
                </select>
              </label>
            </div>
          )
        })()}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 12px', fontSize: 13, justifyContent: 'space-between' }}>
          <span>Add a temporary discount</span>
          <ToggleSwitch checked={feeDiscountEnabled} onChange={setFeeDiscountEnabled} />
        </div>
        {feeDiscountEnabled && (
          <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="number"
              value={feeDiscountAmount}
              onChange={(e) => setFeeDiscountAmount(e.target.value)}
              placeholder="Discount amount (USD)"
              style={{ width: 170, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
            <input
              type="number"
              value={feeDiscountHours}
              onChange={(e) => setFeeDiscountHours(e.target.value)}
              placeholder="Lasts (hours)"
              style={{ width: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 16px' }}>
          Recorded immediately as an outstanding invoice in this client's Transaction History, but it does not deduct from their balance yet. It only debits once the client deposits that exact amount and you approve it — that's what actually settles the fee. A discount only lowers what's owed for the set number of hours; after that it reverts to the full amount automatically, no separate step needed.
        </p>
      </div>
      )}

      {canFinance && (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Identity verification</h3></div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
              <span>
                <strong style={{ fontSize: 13.5 }}>Require verification for this client</strong>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {settings.kycEnabled
                    ? 'Verification is already required sitewide — this only matters if that gets turned off later.'
                    : 'Verification is off sitewide, but this client specifically will still be required to verify before withdrawing.'}
                </div>
              </span>
              <ToggleSwitch checked={!!targetUser?.kycRequired} onChange={(val) => setKycRequired(userId, val)} />
            </div>

            {!targetUser?.kyc ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>No document submitted yet.</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span className={'status-pill status-' + (targetUser.kyc.status === 'verified' ? 'approved' : targetUser.kyc.status === 'rejected' ? 'rejected' : 'pending')}>
                    {targetUser.kyc.status}
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {targetUser.kyc.documentType === 'passport' ? 'Passport' : 'National ID'} · submitted {formatDate(targetUser.kyc.submittedAt)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Front</div>
                    <img src={targetUser.kyc.frontImageDataUrl} alt="Document front" style={{ width: 200, borderRadius: 8, border: '1px solid var(--border)' }} />
                  </div>
                  {targetUser.kyc.backImageDataUrl && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Back</div>
                      <img src={targetUser.kyc.backImageDataUrl} alt="Document back" style={{ width: 200, borderRadius: 8, border: '1px solid var(--border)' }} />
                    </div>
                  )}
                </div>

                {targetUser.kyc.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => reviewKycSubmission(userId, true)}>
                      Approve
                    </button>
                    <input
                      type="text"
                      value={kycRejectReason}
                      onChange={(e) => setKycRejectReason(e.target.value)}
                      placeholder="Reason for rejection"
                      style={{ flex: '1 1 180px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                    />
                    <button
                      className="tx-btn withdraw"
                      style={{ padding: '8px 14px', fontSize: 13 }}
                      onClick={async () => { const r = await reviewKycSubmission(userId, false, kycRejectReason); if (!r.error) setKycRejectReason('') }}
                    >
                      Reject
                    </button>
                  </div>
                ) : targetUser.kyc.status === 'rejected' ? (
                  <p style={{ fontSize: 12.5, color: 'var(--danger)', margin: 0 }}>Rejected — reason given: {targetUser.kyc.reviewNote}</p>
                ) : (
                  <p style={{ fontSize: 12.5, color: 'var(--success)', margin: 0 }}>Verified by {targetUser.kyc.reviewedByName} on {formatDate(targetUser.kyc.reviewedAt)}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {canFinance && targetUser?.kycEnhanced && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head"><h3>Enhanced verification (proof of address)</h3></div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span className={'status-pill status-' + (targetUser.kycEnhanced.status === 'verified' ? 'approved' : targetUser.kycEnhanced.status === 'rejected' ? 'rejected' : 'pending')}>
                {targetUser.kycEnhanced.status}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                submitted {formatDate(targetUser.kycEnhanced.submittedAt)}
              </span>
            </div>

            <img src={targetUser.kycEnhanced.frontImageDataUrl} alt="Proof of address" style={{ width: 200, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14, display: 'block' }} />

            {targetUser.kycEnhanced.status === 'pending' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => reviewEnhancedKyc(userId, true)}>
                  Approve
                </button>
                <input
                  type="text"
                  value={enhancedRejectReason}
                  onChange={(e) => setEnhancedRejectReason(e.target.value)}
                  placeholder="Reason for rejection"
                  style={{ flex: '1 1 180px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                />
                <button
                  className="tx-btn withdraw"
                  style={{ padding: '8px 14px', fontSize: 13 }}
                  onClick={async () => { const r = await reviewEnhancedKyc(userId, false, enhancedRejectReason); if (!r.error) setEnhancedRejectReason('') }}
                >
                  Reject
                </button>
              </div>
            ) : targetUser.kycEnhanced.status === 'rejected' ? (
              <p style={{ fontSize: 12.5, color: 'var(--danger)', margin: 0 }}>Rejected — reason given: {targetUser.kycEnhanced.reviewNote}</p>
            ) : (
              <p style={{ fontSize: 12.5, color: 'var(--success)', margin: 0 }}>Verified by {targetUser.kycEnhanced.reviewedByName}</p>
            )}
          </div>
        </div>
      )}

      {canFinance && getOutstandingFees(userId).length > 0 && (
        <div className="panel" style={{ marginBottom: 16, borderColor: 'var(--danger)' }}>
          <div className="panel-head">
            <h3>Outstanding fees ({getOutstandingFees(userId).length})</h3>
            <span className="status-pill status-rejected">Withdrawals locked</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px', marginTop: -6, marginBottom: 12 }}>
            This client can't withdraw until every fee below is fully paid through their Fee Balance.
          </p>
          {existingDiscountError && <div className="form-error" style={{ margin: '0 20px 16px' }}>{existingDiscountError}</div>}
          <div style={{ padding: 16 }} className="stagger-in">
            {getOutstandingFees(userId).map((fee) => {
              const owed = getFeeOwedAmount(fee)
              const discounted = owed < fee.amount
              return (
                <div key={fee.id} className="entity-card entity-card-accent-loss" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div className="icon-badge"><Receipt size={17} /></div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">{fee.note || 'Fee'}</div>
                    <div className="entity-card-meta"><span>{formatDate(fee.date)}</span></div>
                    <div style={{ marginTop: 10 }}>
                      {discountingFeeId === fee.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="number"
                            value={existingDiscountAmount}
                            onChange={(e) => setExistingDiscountAmount(e.target.value)}
                            placeholder="Amount off"
                            style={{ width: 100, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
                          />
                          <input
                            type="number"
                            value={existingDiscountHours}
                            onChange={(e) => setExistingDiscountHours(e.target.value)}
                            placeholder="Hours"
                            style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
                          />
                          <button className="tx-btn deposit" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleApplyDiscountToExisting(fee.id)}>
                            Apply
                          </button>
                        </div>
                      ) : (
                        <button
                          className="tx-btn withdraw"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          onClick={() => { setDiscountingFeeId(fee.id); setExistingDiscountError('') }}
                        >
                          {discounted ? 'Update discount' : 'Add discount'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="pnl-down" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600 }}>
                      {discounted && <span style={{ textDecoration: 'line-through', opacity: 0.5, marginRight: 6, fontWeight: 400 }}>{formatMoney(fee.amount)}</span>}
                      {formatMoney(owed)}
                    </div>
                    {discounted && fee.discountExpiresAt && (
                      <div style={{ fontSize: 11, color: 'var(--accent-bright)', marginTop: 2 }}>{formatTimeLeft(fee.discountExpiresAt)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {canSupport && (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Message this client</h3></div>
        {messageError && <div className="form-error" style={{ margin: '16px 20px 0' }}>{messageError}</div>}
        {messageSent && <div style={{ margin: '16px 20px 0', fontSize: 13, color: 'var(--success)' }}>Sent — it'll appear in their notifications right away.</div>}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            value={messageTitle}
            onChange={(e) => setMessageTitle(e.target.value)}
            placeholder='Title (e.g. "Discount applied")'
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Write a custom message for this client..."
            rows={3}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div>
            <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={handleSendMessage}>
              <Send size={14} /> Send
            </button>
          </div>
        </div>

        {(() => {
          const priorMessages = getNotificationsForUser(userId)
            .filter((n) => n.type === 'admin_message')
            .slice(0, 5)
          if (priorMessages.length === 0) return null
          return (
            <>
              <div style={{ padding: '4px 20px 0', fontSize: 12, color: 'var(--text-muted)' }}>Recently sent</div>
              <div style={{ padding: '8px 16px 16px' }} className="stagger-in">
                {priorMessages.map((n) => (
                  <div key={n.id} className="entity-card" style={{ alignItems: 'flex-start' }}>
                    <div className="icon-badge"><Send size={15} /></div>
                    <div className="entity-card-body">
                      <div className="entity-card-title">{n.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', flex: 'none' }}>{formatDate(n.date)}</div>
                  </div>
                ))}
              </div>
            </>
          )
        })()}
      </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Market prices</h3></div>
        <div className="stats-grid" style={{ padding: '16px 20px' }}>
          {Object.entries(prices).map(([symbol, price]) => {
            const { high, low } = getRecentRange(symbol)
            return (
              <div className="stat-card" key={symbol}>
                <div className="stat-label">{symbol}</div>
                <div className="stat-value">{formatMoney(price)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Range: {formatMoney(low)} – {formatMoney(high)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Tier</h3></div>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={targetUser.tier || ''}
            onChange={(e) => {
              const newTierId = e.target.value || null
              setUserTier(userId, newTierId)
              const newTier = newTierId ? getTier(newTierId) : null
              notify(
                userId,
                'tier_changed',
                'Tier updated',
                newTier ? `Your account was moved to ${newTier.name}.` : 'Your tier assignment was removed.',
                { tierId: newTierId }
              )
            }}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          >
            <option value="">No tier assigned</option>
            {TIERS.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {targetUser.flaggedForReview && (
            <span className="status-pill status-pending">Flagged — large account, needs manual review</span>
          )}
        </div>
        {settings.showVipTiers && (
          <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>VIP status:</label>
            <select
              value={targetUser.vipUnlocked || ''}
              onChange={(e) => {
                const vipTierId = e.target.value || null
                setClientVip(userId, vipTierId)
                const vipTier = vipTierId ? getTier(vipTierId) : null
                notify(
                  userId,
                  'tier_changed',
                  vipTier ? `${vipTier.name} unlocked` : 'VIP access removed',
                  vipTier
                    ? `${vipTier.name} is now available on your Sessions page.`
                    : 'VIP tier access was removed from your account.',
                  { vipTierId }
                )
              }}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            >
              <option value="">None</option>
              <option value="mini_vip">Mini VIP ($10–$99)</option>
              <option value="major_vip">Major VIP ($25,001+)</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Unlocking a VIP tier here adds it as a selectable option on this client's own Sessions page. You can also start a VIP session for them directly below without unlocking it.
            </span>
          </div>
        )}
      </div>

      {/* ---------- Per-session leveraged trading ---------- */}
      {canTrade && (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Trade inside a session</h3></div>

        {activeSessions.length === 0 ? (
          <div className="empty-state"><p>No active sessions for this client yet — start one below first.</p></div>
        ) : (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Active session</label>
              <select
                value={selectedSession?.id || ''}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, minWidth: 260 }}
              >
                {activeSessions.map((s) => {
                  const tier = getTier(s.tierId)
                  return (
                    <option key={s.id} value={s.id}>
                      {tier?.name || s.tierId} — {formatMoney(s.amount)} — {formatTimeLeft(s.expiresAt)}
                    </option>
                  )
                })}
              </select>
            </div>

            {selectedSession && (() => {
              const effectivePrices = getEffectivePricesForSession(selectedSession.id)
              const scenario = sessionScenarios[selectedSession.id]
              return (
              <>
                {scenario && (
                  <div style={{ margin: '16px 20px 0', padding: '10px 14px', borderRadius: 10, background: 'var(--accent-bg)', border: '1px solid var(--accent)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>Scenario active:</strong>
                    {scenario.reset
                      ? ` Resetting (${scenario.reset.level}) — returning to real market price.`
                      : ` ${scenario.mode} · strength ${scenario.strength} · volatility ${scenario.volatility} · ${scenario.speed}x speed.`}
                    {' '}This session's price is currently adjusted by Scenario Control, not tracking the real market feed shown above.
                  </div>
                )}

                <div className="stats-grid" style={{ padding: '16px 20px 0' }}>
                  <div className="stat-card">
                    <div className="stat-label">Session cash (uncommitted)</div>
                    <div className="stat-value">{formatMoney(selectedSession.cash)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Live session value</div>
                    <div className="stat-value">{formatMoney(sessionCurrentValue(selectedSession))}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Time left</div>
                    <div className="stat-value">{formatTimeLeft(selectedSession.expiresAt)}</div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${sessionProgress(selectedSession)}%` }} />
                    </div>
                  </div>
                </div>

                <div style={{ padding: '16px 20px 0' }}>
                  <div className="stat-label" style={{ marginBottom: 6 }}>
                    Leverage — currently {selectedSession.leverage}x
                    {(() => {
                      const tier = getTier(selectedSession.tierId)
                      return tier ? ` (range ${tier.leverageRange.min}x–${tier.leverageRange.max}x for ${tier.name})` : ''
                    })()}
                  </div>
                  {leverageError && <div className="form-error" style={{ marginBottom: 8 }}>{leverageError}</div>}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="number"
                      value={leverageInput}
                      onChange={(e) => setLeverageInput(e.target.value)}
                      placeholder={`New leverage (x)`}
                      style={{ width: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                    />
                    <button className="tx-btn" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleSetLeverage}>
                      Apply
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Only affects positions opened from now on — open positions keep the leverage they started with.
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px 20px 0' }}>
                  <div className="stat-label" style={{ marginBottom: 6 }}>
                    Duration — {formatTimeLeft(selectedSession.expiresAt)} remaining
                    {(() => {
                      const tier = getTier(selectedSession.tierId)
                      return tier ? ` (range ${tier.durationRange.min}–${tier.durationRange.max} days for ${tier.name})` : ''
                    })()}
                  </div>
                  {durationError && <div className="form-error" style={{ marginBottom: 8 }}>{durationError}</div>}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="number"
                      value={durationInput}
                      onChange={(e) => setDurationInput(e.target.value)}
                      placeholder="New duration (days, from start)"
                      style={{ width: 200, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                    />
                    <button className="tx-btn" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleSetDuration}>
                      Apply
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Recalculates the deadline from when the session started — extend or shorten it.
                    </span>
                  </div>
                </div>

                {tradeError && <div className="form-error" style={{ margin: '16px 20px 0' }}>{tradeError}</div>}

                <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                  <select
                    value={tradeSymbol}
                    onChange={(e) => setTradeSymbol(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                  >
                    {Object.keys(prices).map((symbol) => (
                      <option key={symbol} value={symbol}>{symbol}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    @ {formatMoney(effectivePrices[tradeSymbol])}
                  </span>
                  <div className="segment-tabs" style={{ margin: 0, padding: 3 }}>
                    <button
                      type="button"
                      className={'segment-tab' + (tradeDirection === 'long' ? ' active tab-accent-success' : '')}
                      style={{ padding: '7px 14px' }}
                      onClick={() => setTradeDirection('long')}
                    >
                      <TrendingUp size={14} /> Long
                    </button>
                    <button
                      type="button"
                      className={'segment-tab' + (tradeDirection === 'short' ? ' active tab-accent-danger' : '')}
                      style={{ padding: '7px 14px' }}
                      onClick={() => setTradeDirection('short')}
                    >
                      <TrendingDown size={14} /> Short
                    </button>
                  </div>
                  <input
                    type="number"
                    value={tradeMargin}
                    onChange={(e) => setTradeMargin(e.target.value)}
                    placeholder="Margin amount (USD)"
                    style={{ width: 170, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                  />
                  <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleOpenPosition}>
                    Open {tradeDirection} position ({selectedSession.leverage}x)
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Committed from this session's own cash — never the client's wider balance.
                  </span>
                </div>

                {selectedSession.positions.length === 0 ? (
                  <div className="empty-state"><p>No open positions in this session.</p></div>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Symbol</th><th style={{ textAlign: 'right' }}>Margin</th><th style={{ textAlign: 'right' }}>Entry price</th><th style={{ textAlign: 'right' }}>Current price</th><th style={{ textAlign: 'right' }}>Live P&L</th><th></th></tr>
                    </thead>
                    <tbody>
                      {selectedSession.positions.map((p) => {
                        const currentPrice = effectivePrices[p.symbol]
                        const livePnl = positionEquity(p, effectivePrices) - p.marginAmount
                        const isShort = p.direction === 'short'
                        return (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}>
                              {p.symbol}
                              <span className={'status-pill ' + (isShort ? 'status-rejected' : 'status-approved')} style={{ marginLeft: 8, fontSize: 10.5 }}>
                                {isShort ? 'short' : 'long'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(p.marginAmount)}</td>
                            <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(p.entryPrice)}</td>
                            <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(currentPrice)}</td>
                            <td className={livePnl >= 0 ? 'pnl-up' : 'pnl-down'} style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                              {livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleClosePosition(p.id)}>
                                Close
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </>
              )
            })()}
          </>
        )}
      </div>
      )}

      {/* ---------- Trade history (legacy buy/sell + new open/close position, same audit log) ---------- */}
      <CollapsiblePanel title="Trade history" count={userOrders.length} style={{ marginTop: 16 }}>
        {userOrders.length === 0 ? (
          <div className="empty-state"><p>No trades yet.</p></div>
        ) : (
          <>
            <div style={{ padding: 16 }}>
              {userOrders.slice(0, ordersShowMore.limit).map((o) => (
                <div key={o.id} className={'entity-card' + (o.pnl != null ? (o.pnl >= 0 ? ' entity-card-accent-profit' : ' entity-card-accent-loss') : '')}>
                  <div className="icon-badge">{o.pnl != null ? (o.pnl >= 0 ? <TrendingUp size={17} /> : <TrendingDown size={17} />) : <Repeat size={17} />}</div>
                  <div className="entity-card-body">
                    <div className="entity-card-title" style={{ textTransform: 'capitalize' }}>{o.type.replace('_', ' ')} · {o.symbol}</div>
                    <div className="entity-card-meta">
                      <span>{o.units != null ? `${o.units.toFixed(4)} units` : `${formatMoney(o.marginAmount)} @ ${o.leverage}x`}</span>
                      <span>@ {formatMoney(o.price)}</span>
                      <span>{o.executedByAdminName ? `By ${o.executedByAdminName}` : 'By client'}</span>
                      <span>{formatDate(o.date)}</span>
                    </div>
                  </div>
                  {o.pnl != null && (
                    <div className={o.pnl >= 0 ? 'pnl-up' : 'pnl-down'} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, flex: 'none' }}>
                      {o.pnl >= 0 ? '+' : ''}{formatMoney(o.pnl)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {ordersShowMore.hasMore && (
              <div style={{ padding: '0 20px 16px' }}>
                <button className="tx-btn" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={ordersShowMore.showMore}>
                  Show more ({userOrders.length - ordersShowMore.limit} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel title="Deposit / withdrawal history" count={userTransactions.length} style={{ marginTop: 16 }}>
        {deleteError && <div className="form-error" style={{ margin: '0 20px 16px' }}>{deleteError}</div>}
        {userTransactions.length === 0 ? (
          <div className="empty-state"><p>No requests yet.</p></div>
        ) : (
          <div style={{ padding: 16 }}>
            {userTransactions.slice(0, transactionsShowMore.limit).map((t) => {
              const wasCorrected = t.requestedAmount != null && t.requestedAmount !== t.amount
              return (
                <div key={t.id} className="entity-card">
                  <div className="icon-badge">{t.type === 'withdrawal' ? <ArrowUpFromLine size={17} /> : <ArrowDownToLine size={17} />}</div>
                  <div className="entity-card-body">
                    <div className="entity-card-title" style={{ textTransform: 'capitalize' }}>{t.type.replace('_', ' ')} · {formatMoney(t.amount)}</div>
                    <div className="entity-card-meta">
                      <span>{formatDate(t.date)}</span>
                      {t.type === 'withdrawal' && t.withdrawalMethod && (
                        <span>{METHOD_LABELS[t.withdrawalMethod] || t.withdrawalMethod}{t.withdrawalChain ? ` (${t.withdrawalChain})` : ''}{t.destinationAddress ? ` → ${t.destinationAddress}` : ''}</span>
                      )}
                      {(t.type === 'deposit' || t.type === 'fee_payment') && t.depositMethod && (
                        <span>via {METHOD_LABELS[t.depositMethod] || t.depositMethod}{t.depositChain ? ` (${t.depositChain})` : ''}{t.depositReference ? ` · ${t.depositReference}` : ''}</span>
                      )}
                      {wasCorrected && (
                        <span style={{ color: 'var(--accent-bright)' }}>requested {formatMoney(t.requestedAmount)}</span>
                      )}
                      <span className={'status-pill status-' + t.status}>{t.status}</span>
                    </div>
                  </div>
                {deletingTxId === t.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 'none' }}>
                    <input
                      type="text"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="Reason (required)"
                      style={{ width: 150, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
                    />
                    <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => handleDeleteTransaction(t.id)}>
                      Confirm
                    </button>
                    <button
                      className="tx-btn"
                      style={{ padding: '6px 10px', fontSize: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      onClick={() => { setDeletingTxId(null); setDeleteReason(''); setDeleteError('') }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                    <button
                      className="tx-btn"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => setViewingTx(t)}
                    >
                      View
                    </button>
                    <button
                      className="tx-btn"
                      style={{ padding: '6px 10px', fontSize: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--danger)' }}
                      onClick={() => { setDeletingTxId(t.id); setDeleteReason(''); setDeleteError('') }}
                      aria-label="Delete transaction"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
        {transactionsShowMore.hasMore && (
          <div style={{ padding: '0 20px 16px' }}>
            <button className="tx-btn" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={transactionsShowMore.showMore}>
              Show more ({userTransactions.length - transactionsShowMore.limit} remaining)
            </button>
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 20px 16px' }}>
          Deleting is for fixing genuine data errors — like a leftover duplicate from a bug — not for changing
          real results. Every deletion requires a reason and is kept in a permanent audit log even after the
          record itself is gone.
        </p>
      </CollapsiblePanel>

      <CollapsiblePanel title="Trading sessions" count={userSessions.length} defaultOpen style={{ marginTop: 16 }}>

        {sessionError && <div className="form-error" style={{ margin: '16px 20px 0' }}>{sessionError}</div>}

        <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <select
            value={newSessionTier}
            onChange={(e) => {
              setNewSessionTier(e.target.value)
              const t = getTier(e.target.value)
              if (t) setNewSessionDuration(t.durationDays)
            }}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          >
            {ALL_TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.hidden ? `⭐ ${t.name}` : t.name} (cap {t.maxPayoutMultiplier * 100}%, {t.leverageRange.min}x–{t.leverageRange.max}x, {t.durationRange.min}–{t.durationRange.max}d, {formatMoney(t.minDeposit)}{Number.isFinite(t.maxDeposit) ? `–${formatMoney(t.maxDeposit)}` : '+'})
              </option>
            ))}
          </select>
          <input
            type="number"
            value={newSessionDuration}
            onChange={(e) => setNewSessionDuration(e.target.value)}
            placeholder="Duration (days)"
            title={(() => {
              const t = getTier(newSessionTier)
              return t ? `Range: ${t.durationRange.min}–${t.durationRange.max} days` : ''
            })()}
            style={{ width: 130, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <input
            type="number"
            value={newSessionAmount}
            onChange={(e) => setNewSessionAmount(e.target.value)}
            placeholder="Session amount (USD)"
            style={{ width: 170, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleStartSession}>
            Start session
          </button>
        </div>

        {userSessions.length === 0 ? (
          <div className="empty-state"><p>No sessions yet.</p></div>
        ) : (
          <>
            <table>
              <thead>
                <tr><th>Tier</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Leverage</th><th>Started</th><th>Status</th><th style={{ textAlign: 'right' }}>Result</th><th></th></tr>
              </thead>
              <tbody>
                {userSessions.slice(0, sessionsShowMore.limit).map((s) => {
                  const tier = getTier(s.tierId)
                  const isAwaiting = s.status === 'awaiting_start'
                  const liveValue = s.status === 'active' ? sessionCurrentValue(s) : s.endValue
                  const livePnl = s.status === 'active' ? liveValue - s.amount : s.rawPnl
                  const wasCapped = s.status === 'closed' && s.payout < s.rawPnl
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{tier?.name || s.tierId}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(s.amount)}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{isAwaiting ? '—' : `${s.leverage}x`}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{isAwaiting ? `Committed ${formatDate(s.committedAt)}` : formatDate(s.startedAt)}</td>
                      <td>
                        <span className={'status-pill status-' + (s.status === 'active' || s.status === 'awaiting_start' ? 'pending' : s.status === 'cancelled' ? 'rejected' : 'approved')}>
                          {isAwaiting ? 'awaiting start' : s.status}
                        </span>
                        {s.status === 'active' && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{formatTimeLeft(s.expiresAt)}</span>
                        )}
                      </td>
                      <td className={isAwaiting ? undefined : (livePnl >= 0 ? 'pnl-up' : 'pnl-down')} style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: isAwaiting ? 400 : 600 }}>
                        {isAwaiting
                          ? <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit', fontWeight: 400 }}>{s.durationDays}-day session once started</span>
                          : s.status === 'active'
                          ? <>{livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)} (live)</>
                          : <>
                              {s.payout >= 0 ? '+' : ''}{formatMoney(s.payout)}
                              {wasCapped && (
                                <span style={{ color: isSessionUnlocked(s.id) ? 'var(--success)' : 'var(--text-muted)', fontSize: 11, fontWeight: 400 }}>
                                  {' '}(tier cap reached — extra {formatMoney(s.excessPending || (s.rawPnl - s.payout))} {isSessionUnlocked(s.id) ? 'unlocked, ready to certify' : 'locked until fee paid'})
                                </span>
                              )}
                              {s.closedReason === 'expired' && <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 400 }}> (auto-expired)</span>}
                            </>
                        }
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {s.status === 'active' && (
                          <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => closeSession(s.id)}>
                            Close session
                          </button>
                        )}
                        {isAwaiting && (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="tx-btn deposit" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => beginAwaitingSession(s.id)}>
                              Begin session
                            </button>
                            <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => cancelAwaitingSession(s.id)}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {sessionsShowMore.hasMore && (
              <div style={{ padding: '14px 20px' }}>
                <button className="tx-btn" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={sessionsShowMore.showMore}>
                  Show more ({userSessions.length - sessionsShowMore.limit} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </CollapsiblePanel>

      <TransactionDetailModal transaction={viewingTx} isAdmin={true} onClose={() => setViewingTx(null)} />
    </Layout>
  )
}
