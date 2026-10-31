import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { ArrowDownCircle, ArrowUpCircle, Inbox, Check, X, Clock, Hourglass, Wallet, Bitcoin, Landmark, Coins, Camera, ChevronDown, Receipt, ArrowRight } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageSkeleton from '../components/PageSkeleton.jsx'
import ScreenshotUploader from '../components/ScreenshotUploader.jsx'
import TransactionDetailModal from '../components/TransactionDetailModal.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { LARGE_ACCOUNT_THRESHOLD } from '../config/tiers.js'
import { getPendingRequestsSummary, getDepositWithdrawTrend } from '../utils/adminAnalytics.js'
import { resolveDisplayCurrency, formatCurrency, CURRENCIES } from '../config/currencies.js'
import { CRYPTO_CHAINS, METHOD_LABELS } from '../config/paymentMethods.js'

const METHOD_ICONS = { usdt: Coins, btc: Bitcoin, bank: Landmark }

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

function StatCard({ icon: Icon, label, value, formatter, equivalent }) {
  const animated = useCountUp(value)
  return (
    <div className="glass-card hero-stat-card fade-in-up">
      <div className="hero-stat-icon"><Icon size={17} /></div>
      <div className="hero-stat-label">{label}</div>
      <div className="hero-stat-value">{formatter(animated)}</div>
      {equivalent && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{equivalent}</div>}
    </div>
  )
}

function AdminKpi({ icon: Icon, label, value, formatter, alert }) {
  const animated = useCountUp(value)
  return (
    <div className={'ad-kpi' + (alert ? ' alert' : '')}>
      <span className="ad-kpi-ico"><Icon size={18} /></span>
      <span className="ad-kpi-label">{label}</span>
      <b className="ad-kpi-value">{formatter(animated)}</b>
    </div>
  )
}

function AdminTransactionsView() {
  const { transactions, approveTransaction, rejectTransaction, correctTransactionAmount, isSessionUnlocked } = useApp()
  const pending = transactions.filter((t) => t.status === 'pending')
  const resolved = transactions.filter((t) => t.status !== 'pending').slice(0, 15)
  const summary = getPendingRequestsSummary(transactions)
  const [trendDays, setTrendDays] = useState(14)
  const trend = getDepositWithdrawTrend(transactions, trendDays)
  const [correctingId, setCorrectingId] = useState(null)
  const [correctionDraft, setCorrectionDraft] = useState({ amount: '', screenshots: [], note: '' })
  const [correctionError, setCorrectionError] = useState('')
  const [viewingTx, setViewingTx] = useState(null)

  function startCorrecting(t) {
    setCorrectingId(t.id)
    setCorrectionDraft({ amount: t.amount, screenshots: t.correctionEvidence || [], note: t.correctionNote || '' })
  }

  async function saveCorrection(id) {
    const value = parseFloat(correctionDraft.amount)
    if (!value || value <= 0) return
    const result = await correctTransactionAmount(id, value, correctionDraft.screenshots, correctionDraft.note)
    if (result.error) {
      setCorrectionError(result.error)
      return
    }
    setCorrectionError('')
    setCorrectingId(null)
  }

  return (
    <>
      <header className="dz-head">
        <h1 className="dz-title">Deposits &amp; Withdrawals</h1>
        <div className="dz-muted">Approve, reject, and analyze every client deposit, withdrawal, and pending profit release.</div>
      </header>

      <div className="ad-kpis">
        <AdminKpi icon={ArrowDownCircle} label="Pending deposits" value={summary.deposits.amount} formatter={formatMoney} />
        <AdminKpi icon={ArrowUpCircle} label="Pending withdrawals" value={summary.withdrawals.amount} formatter={formatMoney} />
        <AdminKpi icon={Hourglass} label="Pending profit reviews" value={summary.cappedProfitReleases.amount} formatter={formatMoney} />
        <AdminKpi icon={Clock} label="Total awaiting action" value={pending.length} formatter={(v) => Math.round(v).toString()} alert={pending.length > 0} />
      </div>

      <div className="dz-card">
        <div className="dz-card-head">
          <h3>Awaiting action ({pending.length})</h3>
        </div>
        {pending.length === 0 ? (
          <div className="dz-empty"><Inbox size={20} /><br />Nothing pending right now.</div>
        ) : (
          <div className="rf-list">
            {pending.map((t) => {
              const isLockedExcess = t.type === 'capped_profit_release' && !isSessionUnlocked(t.sessionId)
              // fee_payment correction isn't offered here anymore — the
              // backend deliberately doesn't support it yet (it needs
              // fee-pool allocation recomputed too; see
              // server/sql/004_transaction_corrections.sql), so
              // offering the button would just lead to an error every
              // time. Deposit only, for now — withdrawal correction
              // exists server-side too, matching that scope exactly.
              const canCorrect = (t.type === 'deposit' || t.type === 'withdrawal') && !isLockedExcess
              const isCorrecting = correctingId === t.id
              const wasCorrected = t.requestedAmount != null && t.requestedAmount !== t.amount
              return (
                <div key={t.id} className="rf-item rq-row rq-pending">
                  <span className="rf-av">{t.type === 'deposit' ? <ArrowDownCircle size={16} /> : t.type === 'fee_payment' ? <Receipt size={16} /> : <ArrowUpCircle size={16} />}</span>
                  <span className="rf-who">
                    <strong>
                      <Link to={`/admin/users/${t.userId}`} className="ad-link">{t.userName}</Link> · {formatType(t.type)}
                      {t.clientConfirmed && <span className="rq-badge">Awaiting review</span>}
                    </strong>
                    <span className="dz-muted">
                      {formatDate(t.date)}
                      {t.type === 'withdrawal' && t.withdrawalMethod && <> · {METHOD_LABELS[t.withdrawalMethod] || t.withdrawalMethod}{t.withdrawalChain ? ` (${t.withdrawalChain})` : ''}{t.destinationAddress ? ` → ${t.destinationAddress}` : ''}</>}
                      {(t.type === 'deposit' || t.type === 'fee_payment') && t.depositMethod && <> · via {METHOD_LABELS[t.depositMethod] || t.depositMethod}{t.depositChain ? ` (${t.depositChain})` : ''}{t.depositReference ? ` · ${t.depositReference}` : ''}</>}
                    </span>
                    {t.type === 'fee_payment' && (
                      <span className="dz-muted">{t.spilloverAmount > 0
                        ? `${formatMoney(t.amount - t.spilloverAmount)} to Fee Balance, ${formatMoney(t.spilloverAmount)} spills over`
                        : 'Applied to Fee Balance'}</span>
                    )}
                    {isLockedExcess && <span className="rq-note">Needs a paid unlock fee before release</span>}
                    {wasCorrected && (
                      <span className="rq-note">
                        Requested {formatMoney(t.requestedAmount)} → confirmed {formatMoney(t.amount)}
                        {t.correctionEvidence?.length > 0 ? ` · ${t.correctionEvidence.length} screenshot${t.correctionEvidence.length === 1 ? '' : 's'}` : ''}
                      </span>
                    )}
                    {t.clientConfirmed && t.clientProofEvidence?.length > 0 && (
                      <span className="rq-proofs">
                        {t.clientProofEvidence.map((img, i) => (
                          <a key={i} href={img} target="_blank" rel="noreferrer" className="file-drop-preview" style={{ margin: 0 }}>
                            <img src={img} alt={`Client proof ${i + 1}`} style={{ maxWidth: 70, maxHeight: 56 }} />
                          </a>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="mono rq-amt">{formatMoney(t.amount)}</span>
                  <span className="rq-actions">
                    {canCorrect && (
                      <button type="button" className="dz-btn-o" onClick={() => (isCorrecting ? setCorrectingId(null) : startCorrecting(t))}>
                        <Camera size={13} /> {wasCorrected ? 'Edit correction' : 'Correct amount'}
                        <ChevronDown size={12} style={{ transform: isCorrecting ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s var(--ease)' }} />
                      </button>
                    )}
                    {isLockedExcess ? (
                      <Link to={`/admin/users/${t.userId}`} className="dz-btn-o">Add fee</Link>
                    ) : (
                      <button type="button" className="icon-btn rq-ok" onClick={() => approveTransaction(t.id)} aria-label="Approve"><Check size={15} /></button>
                    )}
                    <button type="button" className="icon-btn rq-no" onClick={() => rejectTransaction(t.id)} aria-label="Reject"><X size={15} /></button>
                  </span>

                  {isCorrecting && (
                    <div className="rq-correct">
                      <p className="dz-muted st-hint" style={{ marginTop: 0 }}>
                        Fix this before approving if the client sent more or less than they requested. The amount below is what actually lands on their balance, not what they typed.
                      </p>
                      {correctionError && <div className="form-error" style={{ marginBottom: 10 }}>{correctionError}</div>}
                      <div className="st-form">
                        <label className="st-f">
                          <span className="pg-label">Actual amount received (USD)</span>
                          <input className="pg-field" type="number" value={correctionDraft.amount} onChange={(e) => setCorrectionDraft((prev) => ({ ...prev, amount: e.target.value }))} />
                        </label>
                        <label className="st-f">
                          <span className="pg-label">Note (optional)</span>
                          <input className="pg-field" type="text" value={correctionDraft.note} onChange={(e) => setCorrectionDraft((prev) => ({ ...prev, note: e.target.value }))} placeholder="e.g. network fee deducted" />
                        </label>
                      </div>
                      <ScreenshotUploader
                        label="Evidence (transaction hash, wallet balance, bank receipt, etc.)"
                        images={correctionDraft.screenshots}
                        onChange={(screenshots) => setCorrectionDraft((prev) => ({ ...prev, screenshots }))}
                      />
                      <button type="button" className="btn-primary pg-start-btn" onClick={() => saveCorrection(t.id)}>Save correction</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="dz-grid rq-grid">
        <div className="dz-main">
          <div className="dz-card">
            <div className="dz-card-head">
              <h3>Recently resolved</h3>
            </div>
            {resolved.length === 0 ? (
              <div className="dz-empty">Nothing resolved yet.</div>
            ) : (
              <div className="rf-list">
                {resolved.map((t) => {
                  const wasCorrected = t.requestedAmount != null && t.requestedAmount !== t.amount
                  return (
                    <button key={t.id} type="button" className={'rf-item rq-resolved ' + (t.status === 'approved' ? 'rq-profit' : 'rq-loss')} onClick={() => setViewingTx(t)}>
                      <span className="rf-av"><RequestTypeIcon type={t.type} /></span>
                      <span className="rf-who">
                        <strong>{t.userName} · {formatType(t.type)}</strong>
                        <span className="dz-muted">{formatMoney(t.amount)}{wasCorrected ? ` (was ${formatMoney(t.requestedAmount)})` : ''}</span>
                      </span>
                      <span className={'status-pill status-' + t.status}>{t.status}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="dz-side">
          <div className="dz-card">
            <div className="dz-card-head"><h3>Deposits vs withdrawals</h3></div>
            <div className="dz-ranges" role="tablist" aria-label="Range" style={{ marginBottom: 8 }}>
              {[7, 14, 30, 60].map((d) => (
                <button key={d} type="button" role="tab" aria-selected={trendDays === d} className={'dz-range' + (trendDays === d ? ' on' : '')} onClick={() => setTrendDays(d)}>{d}d</button>
              ))}
            </div>
            <div className="ad-legend"><span><i style={{ background: 'var(--success)' }} />Deposits</span><span><i style={{ background: 'var(--danger)' }} />Withdrawals</span></div>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={trend} margin={{ top: 6, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 5" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" minTickGap={26} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} formatter={(v) => formatMoney(v)} />
                <Bar dataKey="deposits" fill="var(--success)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="withdrawals" fill="var(--danger)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </aside>
      </div>
      <TransactionDetailModal transaction={viewingTx} isAdmin={true} onClose={() => setViewingTx(null)} />
    </>
  )
}

function RequestTypeIcon({ type }) {
  if (type === 'deposit') return <ArrowDownCircle size={17} />
  if (type === 'fee_payment') return <Receipt size={17} />
  return <ArrowUpCircle size={17} />
}

export default function Transactions() {
  const { transactions, addTransaction, payFeeBalance, accountBalance, getOutstandingFees } = useApp()
  const { currentUser, flagForReview } = useAuth()
  const { settings } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  // Arriving here via "Pay this fee" on the Balance page (?fee=1&amount=X)
  // means: skip the tab choice (a fee payment IS a deposit), prefill the
  // amount so nothing needs retyping, and route the submit through
  // payFeeBalance instead of a plain deposit — see handleSubmit below.
  const feeMode = searchParams.get('fee') === '1'
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(tabParam === 'withdraw' ? 'withdraw' : 'deposit')
  // The phone's quick-actions sheet links here with ?tab=..., even when this page is already open.
  useEffect(() => { if (tabParam === 'withdraw' || tabParam === 'deposit') setActiveTab(tabParam) }, [tabParam])
  const [viewingTx, setViewingTx] = useState(null)
  const [amount, setAmount] = useState(feeMode ? (searchParams.get('amount') || '') : '')
  const [formError, setFormError] = useState('')
  const defaultCurrency = resolveDisplayCurrency(currentUser, settings.currencyCode)
  const [equivCurrency, setEquivCurrency] = useState(defaultCurrency.code)
  const enabledWithdrawalMethods = Object.entries(settings.withdrawalMethods).filter(([, on]) => on).map(([key]) => key)
  const boundWallet = currentUser.boundWallet
  const [withdrawalMethod, setWithdrawalMethod] = useState(boundWallet?.method || enabledWithdrawalMethods[0] || '')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [withdrawalChain, setWithdrawalChain] = useState(boundWallet?.chain || CRYPTO_CHAINS[enabledWithdrawalMethods[0]]?.[0] || '')
  const enabledDepositMethods = Object.entries(settings.depositMethods).filter(([, on]) => on).map(([key]) => key)
  const [depositMethod, setDepositMethod] = useState(enabledDepositMethods[0] || '')
  const [depositReference, setDepositReference] = useState('')
  const [depositChain, setDepositChain] = useState(CRYPTO_CHAINS[enabledDepositMethods[0]]?.[0] || '')

  if (currentUser.role === 'admin') {
    return (
      <Layout pageTitle="Deposits & Withdrawals">
        <AdminTransactionsView />
      </Layout>
    )
  }

  const myRequests = transactions.filter((t) => t.userId === currentUser.id && (t.type === 'deposit' || t.type === 'withdrawal' || t.type === 'fee_payment'))
  const myPendingCount = myRequests.filter((t) => t.status === 'pending').length
  const needsKyc = (settings.kycEnabled || currentUser.kycRequired) && currentUser.kyc?.status !== 'verified'
  const hasOutstandingFee = getOutstandingFees(currentUser.id).length > 0

  function switchTab(tab) {
    setActiveTab(tab)
    setFormError('')
  }

  function exitFeeMode() {
    setSearchParams({}, { replace: true })
  }

  async function handleSubmit(type) {
    const value = parseFloat(amount)
    if (!value || value <= 0) return setFormError('Enter an amount greater than zero.')

    if (feeMode) {
      const result = await payFeeBalance(value, { depositMethod, depositReference, depositChain: CRYPTO_CHAINS[depositMethod] ? depositChain : null })
      if (result?.error) return setFormError(result.error)
      navigate('/balance')
      return
    }

    const min = type === 'deposit' ? settings.depositMin : settings.withdrawalMin
    const max = type === 'deposit' ? settings.depositMax : settings.withdrawalMax
    if (min && value < min) return setFormError(`Minimum ${type} is ${formatMoney(min)}.`)
    if (max && value > max) return setFormError(`Maximum ${type} is ${formatMoney(max)}.`)
    if (type === 'withdrawal' && withdrawalMethod !== 'bank' && !boundWallet) {
      return setFormError('Bind a withdrawal wallet in Settings before your first crypto withdrawal.')
    }
    setFormError('')
    const result = await addTransaction(
      type,
      value,
      type === 'withdrawal'
        ? {
            withdrawalMethod,
            // Once bound, the destination is never taken from free-typed
            // input again — it's always exactly the bound address, so a
            // compromised session (or a typo) can't redirect funds
            // anywhere else. Only bank, which has no "wallet" concept,
            // still uses the typed field.
            destinationAddress: withdrawalMethod !== 'bank' && boundWallet ? boundWallet.address : destinationAddress,
            withdrawalChain: withdrawalMethod !== 'bank' && boundWallet ? boundWallet.chain : (CRYPTO_CHAINS[withdrawalMethod] ? withdrawalChain : null)
          }
        : { depositMethod, depositReference, depositChain: CRYPTO_CHAINS[depositMethod] ? depositChain : null }
    )
    if (result?.error) return setFormError(result.error)
    if (type === 'deposit' && value >= LARGE_ACCOUNT_THRESHOLD) {
      await flagForReview(currentUser.id)
    }
    setAmount('')
    setDestinationAddress('')
    setDepositReference('')
  }

  function MethodPicker({ methods, selected, onSelect, chain, onChainSelect }) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }} className="stagger-in">
        {methods.map((m) => {
          const Icon = METHOD_ICONS[m] || Coins
          const isActive = selected === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => { onSelect(m); onChainSelect(CRYPTO_CHAINS[m]?.[0] || '') }}
              className={'pg-method' + (isActive ? ' on' : '')}
              aria-pressed={isActive}
            >
              <Icon size={15} /> {METHOD_LABELS[m]}
            </button>
          )
        })}
      </div>
    )
  }

  const { dataReady: _dataReady } = useApp()
  if (!_dataReady) return <Layout pageTitle="Deposit / Withdraw"><PageSkeleton /></Layout>

  return (
    <Layout pageTitle="Deposit / Withdraw">
      <header className="dz-head">
        <h1 className="dz-title">Deposit / Withdraw</h1>
        <div className="dz-muted" style={{ maxWidth: 720 }}>
          {feeMode
            ? "Send funds toward your outstanding fee — pick how you're sending it below, same as any other deposit."
            : 'Fund your account or request a payout — every request is reviewed by your account manager before it touches your balance.'}
        </div>
      </header>

      <div className="dz-grid pg-tx">
        <div className="dz-card">
          <div className="dz-card-head" style={{ marginBottom: 14 }}>
            {feeMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, width: '100%' }}>
                <ArrowDownCircle size={15} style={{ color: 'var(--success)' }} /> Paying toward your Fee Balance
                <button type="button" onClick={exitFeeMode} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontWeight: 400, cursor: 'pointer', textDecoration: 'underline' }}>
                  Switch to a regular deposit
                </button>
              </div>
            ) : (
              <div className="pg-seg" role="tablist">
                <button type="button" role="tab" aria-selected={activeTab === 'deposit'} className={activeTab === 'deposit' ? 'on' : ''} onClick={() => switchTab('deposit')}>
                  <ArrowDownCircle size={15} /> Deposit
                </button>
                <button type="button" role="tab" aria-selected={activeTab === 'withdraw'} className={activeTab === 'withdraw' ? 'on' : ''} onClick={() => switchTab('withdraw')}>
                  <ArrowUpCircle size={15} /> Withdraw
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="pg-label" htmlFor="tx-amount">Amount (USD)</label>
            <input
              id="tx-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setFormError('') }}
              placeholder="0.00"
              className="pg-input pg-input-xl"
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {amount && parseFloat(amount) > 0 && equivCurrency !== 'USD'
                  ? `≈ ${formatCurrency(parseFloat(amount), equivCurrency)}`
                  : 'Show equivalent in'}
              </span>
              <select
                value={equivCurrency}
                onChange={(e) => setEquivCurrency(e.target.value)}
                style={{ padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 11.5 }}
              >
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
            {activeTab === 'deposit' && (settings.depositMin || settings.depositMax) && (
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 14px' }}>
                {settings.depositMin ? `Min ${formatMoney(settings.depositMin)}` : ''}{settings.depositMin && settings.depositMax ? ' · ' : ''}{settings.depositMax ? `Max ${formatMoney(settings.depositMax)}` : ''}
              </p>
            )}
            {activeTab === 'withdraw' && (settings.withdrawalMin || settings.withdrawalMax) && (
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 14px' }}>
                {settings.withdrawalMin ? `Min ${formatMoney(settings.withdrawalMin)}` : ''}{settings.withdrawalMin && settings.withdrawalMax ? ' · ' : ''}{settings.withdrawalMax ? `Max ${formatMoney(settings.withdrawalMax)}` : ''}
              </p>
            )}

            {formError && <div className="form-error" style={{ margin: '-8px 0 14px' }}>{formError}</div>}

            {activeTab === 'deposit' ? (
              <>
                {settings.depositInstructions && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-4px 0 14px' }}>{settings.depositInstructions}</p>
                )}
                {parseFloat(amount) >= LARGE_ACCOUNT_THRESHOLD && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-4px 0 14px' }}>
                    Deposits this size are set up personally — your account manager will reach out directly.
                  </p>
                )}
                {enabledDepositMethods.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                      How you're sending funds
                    </label>
                    <MethodPicker methods={enabledDepositMethods} selected={depositMethod} onSelect={setDepositMethod} chain={depositChain} onChainSelect={setDepositChain} />
                    {CRYPTO_CHAINS[depositMethod] && (
                      <select
                        value={depositChain}
                        onChange={(e) => setDepositChain(e.target.value)}
                        className="pg-field" style={{ marginBottom: 10 }}
                      >
                        {CRYPTO_CHAINS[depositMethod].map((chain) => (
                          <option key={chain} value={chain}>{chain}</option>
                        ))}
                      </select>
                    )}
                    {settings.cryptoDepositInfo?.[depositMethod]?.[depositChain] && (
                      <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                        {settings.cryptoDepositInfo[depositMethod][depositChain]}
                      </div>
                    )}
                    <input
                      type="text"
                      value={depositReference}
                      onChange={(e) => setDepositReference(e.target.value)}
                      placeholder="Reference or note (optional)"
                      className="pg-field"
                    />
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                      Coordinate the transfer with your account manager — this just records how you sent it.
                    </p>
                  </div>
                )}
                <button className="btn-primary pg-start-btn" onClick={() => handleSubmit('deposit')}>
                  <ArrowDownCircle size={16} /> {feeMode ? 'Submit fee payment' : 'Request deposit'}
                </button>
              </>
            ) : (
              <>
                {settings.withdrawalInstructions && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-4px 0 14px' }}>{settings.withdrawalInstructions}</p>
                )}
                {needsKyc && (
                  <p style={{ fontSize: 12, color: 'var(--accent-bright)', margin: '-4px 0 14px' }}>
                    Withdrawals require identity verification. <Link to="/kyc" style={{ color: 'inherit', textDecoration: 'underline' }}>Verify your identity</Link> first.
                  </p>
                )}
                {hasOutstandingFee && (
                  <p style={{ fontSize: 12, color: 'var(--accent-bright)', margin: '-4px 0 14px' }}>
                    You have an outstanding fee. <Link to="/balance" style={{ color: 'inherit', textDecoration: 'underline' }}>Clear it from your Fee Balance</Link> before withdrawing.
                  </p>
                )}
                {enabledWithdrawalMethods.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                      Payout method
                    </label>
                    <MethodPicker
                      methods={boundWallet ? enabledWithdrawalMethods.filter((m) => m === boundWallet.method || m === 'bank') : enabledWithdrawalMethods}
                      selected={withdrawalMethod} onSelect={setWithdrawalMethod} chain={withdrawalChain} onChainSelect={setWithdrawalChain}
                    />
                    {withdrawalMethod === 'bank' && currentUser.kycEnhanced?.status !== 'verified' ? (
                      <p style={{ fontSize: 12, color: 'var(--accent-bright)', margin: 0 }}>
                        Bank withdrawal needs enhanced verification.{' '}
                        <Link to="/kyc" style={{ color: 'inherit', textDecoration: 'underline' }}>Submit it</Link> first.
                      </p>
                    ) : withdrawalMethod !== 'bank' && !boundWallet ? (
                      <p style={{ fontSize: 12, color: 'var(--accent-bright)', margin: 0 }}>
                        Bind a withdrawal wallet before your first crypto withdrawal — it's a one-time setup.{' '}
                        <Link to="/settings" style={{ color: 'inherit', textDecoration: 'underline' }}>Bind one now</Link>.
                      </p>
                    ) : withdrawalMethod !== 'bank' && boundWallet ? (
                      <div style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12.5 }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>
                          Sending to your bound {boundWallet.chain} wallet — every withdrawal goes only here.
                        </div>
                        <div style={{ wordBreak: 'break-all' }}>{boundWallet.address}</div>
                      </div>
                    ) : (
                      <>
                        {CRYPTO_CHAINS[withdrawalMethod] && (
                          <select
                            value={withdrawalChain}
                            onChange={(e) => setWithdrawalChain(e.target.value)}
                            className="pg-field" style={{ marginBottom: 10 }}
                          >
                            {CRYPTO_CHAINS[withdrawalMethod].map((chain) => (
                              <option key={chain} value={chain}>{chain}</option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          value={destinationAddress}
                          onChange={(e) => setDestinationAddress(e.target.value)}
                          placeholder={withdrawalMethod === 'bank' ? 'Account number, bank name' : 'Wallet address'}
                          className="pg-field"
                        />
                        {CRYPTO_CHAINS[withdrawalMethod] && (
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                            Double-check the address matches the {withdrawalChain} network — funds sent to the wrong network can't be recovered.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
                <button className="btn-primary pg-start-btn" onClick={() => handleSubmit('withdrawal')}>
                  <ArrowUpCircle size={16} /> Request withdrawal
                </button>
              </>
            )}
          </div>
        </div>

        <aside className="dz-side">
          <div className="dz-card">
            <div className="dz-label"><Wallet size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Your balance (approved only)</div>
            <div className="dz-num mono">{formatMoney(accountBalance)}</div>
            {defaultCurrency.code !== 'USD' && <div className="dz-muted">≈ {formatCurrency(accountBalance, defaultCurrency.code)}</div>}
            <div className="dz-label" style={{ marginTop: 14 }}><Hourglass size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Pending requests</div>
            <div className="dz-num mono">{myPendingCount}</div>
          </div>
          <div className="dz-card">
            <div className="dz-card-head"><h3>How it works</h3></div>
            <ol className="pg-steps">
              <li><b>1</b><span>Submit your request here.</span></li>
              <li><b>2</b><span>{activeTab === 'withdraw' && !feeMode ? 'We check your details and wallet.' : 'Send funds as arranged with your account manager.'}</span></li>
              <li><b>3</b><span>Your account manager reviews it.</span></li>
              <li><b>4</b><span>Once approved, your balance updates.</span></li>
            </ol>
          </div>
        </aside>
      </div>

      <div className="dz-card">
        <div className="dz-card-head"><h3>Your recent requests</h3><Link to="/transaction-history">Full history <ArrowRight size={12} /></Link></div>
          {myRequests.length === 0 ? (
            <div className="dz-empty">No requests yet.</div>
          ) : (
            <div className="stagger-in">
              {myRequests.slice(0, 12).map((t) => {
                const wasCorrected = t.requestedAmount != null && t.requestedAmount !== t.amount
                return (
                  <div
                    key={t.id}
                    className={'entity-card ' + (t.status !== 'approved' ? 'entity-card-accent-pending' : t.type === 'deposit' ? 'entity-card-accent-profit' : '')}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setViewingTx(t)}
                  >
                    <div className="icon-badge"><RequestTypeIcon type={t.type} /></div>
                    <div className="entity-card-body">
                      <div className="entity-card-title">{formatType(t.type)}</div>
                      <div className="entity-card-meta">
                        <span>{formatDate(t.date)}</span>
                        {t.status === 'pending' && t.clientConfirmed && (
                          <span style={{ color: 'var(--accent-bright)' }}>Proof submitted — awaiting review</span>
                        )}
                        {wasCorrected && (
                          <span style={{ color: 'var(--accent-bright)' }}>
                            You requested {formatMoney(t.requestedAmount)} — your account manager confirmed {formatMoney(t.amount)} was received
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: 'none' }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>{formatMoney(t.amount)}</div>
                      <span className={'status-pill status-' + t.status}>{t.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        <p className="dz-muted" style={{ marginTop: 10 }}>
          Looking for your complete account activity, including session results and fees? See{' '}
          <Link to="/transaction-history" style={{ color: 'var(--accent-bright)' }}>Transaction History</Link>.
        </p>
      </div>
      <TransactionDetailModal transaction={viewingTx} isAdmin={false} onClose={() => setViewingTx(null)} />
    </Layout>
  )
}
