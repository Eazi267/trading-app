import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { ArrowDownCircle, ArrowUpCircle, Inbox, Check, X, Clock, Hourglass, Wallet, Bitcoin, Landmark, Coins, Camera, ChevronDown, Receipt } from 'lucide-react'
import Layout from '../components/Layout.jsx'
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

function AdminTransactionsView() {
  const { transactions, approveTransaction, rejectTransaction, correctTransactionAmount, isSessionUnlocked } = useApp()
  const pending = transactions.filter((t) => t.status === 'pending')
  const resolved = transactions.filter((t) => t.status !== 'pending').slice(0, 15)
  const summary = getPendingRequestsSummary(transactions)
  const [trendDays, setTrendDays] = useState(14)
  const trend = getDepositWithdrawTrend(transactions, trendDays)
  const [correctingId, setCorrectingId] = useState(null)
  const [correctionDraft, setCorrectionDraft] = useState({ amount: '', screenshots: [], note: '' })
  const [viewingTx, setViewingTx] = useState(null)

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
    <>
      <h1 className="page-title">Deposits &amp; Withdrawals</h1>
      <p className="page-sub">Approve, reject, and analyze every client deposit, withdrawal, and pending profit release.</p>

      <div className="hero-stats-grid">
        <StatCard icon={ArrowDownCircle} label="Pending deposits" value={summary.deposits.amount} formatter={formatMoney} />
        <StatCard icon={ArrowUpCircle} label="Pending withdrawals" value={summary.withdrawals.amount} formatter={formatMoney} />
        <StatCard icon={Hourglass} label="Pending profit reviews" value={summary.cappedProfitReleases.amount} formatter={formatMoney} />
        <StatCard icon={Clock} label="Total awaiting action" value={pending.length} formatter={(v) => Math.round(v).toString()} />
      </div>

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3>Deposits vs withdrawals — last {trendDays} days</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setTrendDays(d)}
                className="tx-btn"
                style={{
                  padding: '5px 10px', fontSize: 11,
                  background: trendDays === d ? 'var(--accent)' : 'var(--bg)',
                  color: trendDays === d ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)'
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={Math.max(0, Math.floor(trendDays / 10) - 1)} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} formatter={(v) => formatMoney(v)} />
            <Bar dataKey="deposits" fill="var(--success)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="withdrawals" fill="var(--danger)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Awaiting action ({pending.length})</h3></div>
        {pending.length === 0 ? (
          <div className="empty-state"><Inbox size={20} /><p>Nothing pending right now.</p></div>
        ) : (
          <div style={{ padding: 16 }} className="stagger-in">
            {pending.map((t) => {
              const isLockedExcess = t.type === 'capped_profit_release' && !isSessionUnlocked(t.sessionId)
              const canCorrect = (t.type === 'deposit' || t.type === 'fee_payment') && !isLockedExcess
              const isCorrecting = correctingId === t.id
              const wasCorrected = t.requestedAmount != null && t.requestedAmount !== t.amount
              return (
                <div key={t.id} className="entity-card entity-card-accent-pending" style={{ flexWrap: 'wrap' }}>
                  <div className="icon-badge">{t.type === 'deposit' ? <ArrowDownCircle size={17} /> : t.type === 'fee_payment' ? <Receipt size={17} /> : <ArrowUpCircle size={17} />}</div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">{t.userName} · {formatType(t.type)}</div>
                    <div className="entity-card-meta">
                      <span>{formatDate(t.date)}</span>
                      {t.type === 'fee_payment' && (
                        <span>{t.spilloverAmount > 0
                          ? `${formatMoney(t.amount - t.spilloverAmount)} to Fee Balance, ${formatMoney(t.spilloverAmount)} spills over`
                          : 'Applied to Fee Balance'}</span>
                      )}
                      {isLockedExcess && <span style={{ color: 'var(--accent-bright)' }}>Needs a paid unlock fee before release</span>}
                      {t.type === 'withdrawal' && t.withdrawalMethod && (
                        <span>{METHOD_LABELS[t.withdrawalMethod] || t.withdrawalMethod}{t.withdrawalChain ? ` (${t.withdrawalChain})` : ''}{t.destinationAddress ? ` → ${t.destinationAddress}` : ''}</span>
                      )}
                      {(t.type === 'deposit' || t.type === 'fee_payment') && t.depositMethod && (
                        <span>via {METHOD_LABELS[t.depositMethod] || t.depositMethod}{t.depositChain ? ` (${t.depositChain})` : ''}{t.depositReference ? ` · ${t.depositReference}` : ''}</span>
                      )}
                      {wasCorrected && (
                        <span style={{ color: 'var(--accent-bright)' }}>
                          Requested {formatMoney(t.requestedAmount)} → confirmed {formatMoney(t.amount)}
                          {t.correctionEvidence?.length > 0 ? ` · ${t.correctionEvidence.length} screenshot${t.correctionEvidence.length === 1 ? '' : 's'}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, flex: 'none' }}>{formatMoney(t.amount)}</div>
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
                      <button className="icon-btn" onClick={() => approveTransaction(t.id)} aria-label="Approve"><Check size={15} /></button>
                    )}
                    <button className="icon-btn" onClick={() => rejectTransaction(t.id)} aria-label="Reject"><X size={15} /></button>
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

      <div className="panel">
        <div className="panel-head"><h3>Recently resolved</h3></div>
        {resolved.length === 0 ? (
          <div className="empty-state"><p>Nothing resolved yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Client</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {resolved.map((t) => {
                const wasCorrected = t.requestedAmount != null && t.requestedAmount !== t.amount
                return (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setViewingTx(t)}>
                    <td>{t.userName}</td>
                    <td>
                      {formatType(t.type)}
                      {wasCorrected && (
                        <div style={{ fontSize: 11, color: 'var(--accent-bright)' }}>
                          was {formatMoney(t.requestedAmount)}
                        </div>
                      )}
                    </td>
                    <td>{formatMoney(t.amount)}</td>
                    <td><span className={'status-pill status-' + t.status}>{t.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
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
  const [activeTab, setActiveTab] = useState('deposit')
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

  function handleSubmit(type) {
    const value = parseFloat(amount)
    if (!value || value <= 0) return setFormError('Enter an amount greater than zero.')

    if (feeMode) {
      const result = payFeeBalance(value, { depositMethod, depositReference, depositChain: CRYPTO_CHAINS[depositMethod] ? depositChain : null })
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
    const result = addTransaction(
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
      flagForReview(currentUser.id)
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
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                borderRadius: 10, border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--border)'),
                background: isActive ? 'var(--accent-bg)' : 'var(--bg)',
                color: isActive ? 'var(--accent-bright)' : 'var(--text)',
                cursor: 'pointer', transition: 'all 0.15s var(--ease)'
              }}
            >
              <Icon size={15} /> {METHOD_LABELS[m]}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <Layout pageTitle="Deposit / Withdraw">
      <h1 className="page-title">Deposit / Withdraw</h1>
      <p className="page-sub">
        {feeMode
          ? "Send funds toward your outstanding fee — pick how you're sending it below, same as any other deposit."
          : 'Fund your account or request a payout — every request is reviewed by your account manager before it touches your balance.'}
      </p>

      <div className="hero-stats-grid">
        <StatCard
          icon={Wallet}
          label="Your balance (approved only)"
          value={accountBalance}
          formatter={formatMoney}
          equivalent={defaultCurrency.code !== 'USD' ? `≈ ${formatCurrency(accountBalance, defaultCurrency.code)}` : undefined}
        />
        <StatCard icon={Hourglass} label="Your pending requests" value={myPendingCount} formatter={(v) => Math.round(v).toString()} />
      </div>

      <div className="tx-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 420px) 1fr', gap: 20, alignItems: 'start' }}>
        <div className="glass-card fade-in-up-1">
          <div className="panel-head">
            {feeMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <ArrowDownCircle size={15} style={{ color: 'var(--success)' }} /> Paying toward your Fee Balance
                <button type="button" onClick={exitFeeMode} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontWeight: 400, cursor: 'pointer', textDecoration: 'underline' }}>
                  Switch to a regular deposit
                </button>
              </div>
            ) : (
              <div className="segment-tabs">
                <button
                  type="button"
                  className={'segment-tab' + (activeTab === 'deposit' ? ' active tab-accent-success' : '')}
                  onClick={() => switchTab('deposit')}
                >
                  <ArrowDownCircle size={15} /> Deposit
                </button>
                <button
                  type="button"
                  className={'segment-tab' + (activeTab === 'withdraw' ? ' active tab-accent-danger' : '')}
                  onClick={() => switchTab('withdraw')}
                >
                  <ArrowUpCircle size={15} /> Withdraw
                </button>
              </div>
            )}
          </div>

          <div style={{ padding: '0 20px 20px' }}>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Amount (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setFormError('') }}
              placeholder="0.00"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', marginBottom: 8, fontSize: 14
              }}
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
                        style={{ width: '100%', marginBottom: 10, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                      >
                        {CRYPTO_CHAINS[depositMethod].map((chain) => (
                          <option key={chain} value={chain}>{chain}</option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      value={depositReference}
                      onChange={(e) => setDepositReference(e.target.value)}
                      placeholder="Reference or note (optional)"
                      style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                    />
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                      Coordinate the transfer with your account manager — this just records how you sent it.
                    </p>
                  </div>
                )}
                <button className="tx-btn deposit" style={{ width: '100%', marginTop: 14 }} onClick={() => handleSubmit('deposit')}>
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
                            style={{ width: '100%', marginBottom: 10, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
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
                          style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
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
                <button className="tx-btn withdraw" style={{ width: '100%', marginTop: 14 }} onClick={() => handleSubmit('withdrawal')}>
                  <ArrowUpCircle size={16} /> Request withdrawal
                </button>
              </>
            )}
          </div>
        </div>

        <div className="glass-card fade-in-up-2">
          <div className="panel-head">
            <h3>Your recent requests</h3>
          </div>
          {myRequests.length === 0 ? (
            <div className="empty-state">
              <Inbox size={20} />
              <p>No requests yet.</p>
            </div>
          ) : (
            <div style={{ padding: 16 }} className="stagger-in">
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
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 16px' }}>
            Looking for your complete account activity, including session results and fees? See{' '}
            <Link to="/transaction-history" style={{ color: 'var(--accent-bright)' }}>Transaction History</Link>.
          </p>
        </div>
      </div>
      <TransactionDetailModal transaction={viewingTx} isAdmin={false} onClose={() => setViewingTx(null)} />
    </Layout>
  )
}
