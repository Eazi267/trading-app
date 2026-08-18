import { useState } from 'react'
import { CheckCircle2, Lock, TrendingUp, TrendingDown, Clock3, History, Sparkles, Sprout, Gem, Crown, X } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { TIERS, getTier } from '../config/tiers.js'

function formatMoney(n) {
  if (!Number.isFinite(n)) return 'no limit'
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatTimeLeft(expiresAtIso) {
  const msLeft = new Date(expiresAtIso).getTime() - Date.now()
  if (msLeft <= 0) return 'expired'
  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000))
  const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  if (days > 0) return `${days}d ${hours}h left`
  const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000))
  return `${hours}h ${minutes}m left`
}

// Percentage of a session's duration that has elapsed, for the
// animated progress bar — real elapsed/total time, not decorative.
function sessionProgress(session) {
  const start = new Date(session.startedAt).getTime()
  const end = new Date(session.expiresAt).getTime()
  const now = Date.now()
  if (end <= start) return 100
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
}

const TIER_ICONS = [Sprout, TrendingUp, Gem]
function tierIconFor(index) {
  return TIER_ICONS[index] || Crown
}

export default function Sessions() {
  const { currentUser } = useAuth()
  const { transactions, getBalanceBreakdown, getSessionsForUser, startSession, cancelAwaitingSession, closeSession, sessionCurrentValue } = useApp()
  const { settings } = useSettings()
  const [selectedTier, setSelectedTier] = useState(TIERS[0].id)
  const [duration, setDuration] = useState(TIERS[0].durationDays)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [closeError, setCloseError] = useState('')

  const { available } = getBalanceBreakdown(currentUser.id)
  const mySessions = getSessionsForUser(currentUser.id)
  const activeSessions = mySessions.filter((s) => s.status === 'active')
  const awaitingSessions = mySessions.filter((s) => s.status === 'awaiting_start')
  const closedSessions = mySessions.filter((s) => s.status === 'closed' || s.status === 'cancelled')
  const isManaged = settings.investmentMode === 'managed'

  // Standard three tiers, plus one VIP tier ONLY if an admin has
  // specifically unlocked it for this client (see AdminUserDetail's
  // "VIP status" control). Never shown otherwise — Mini/Major VIP
  // stay admin-only unless explicitly granted.
  const unlockedVipTier = currentUser.vipUnlocked ? getTier(currentUser.vipUnlocked) : null
  const visibleTiers = unlockedVipTier ? [...TIERS, unlockedVipTier] : TIERS

  function handleStart() {
    setError('')
    const value = parseFloat(amount)
    if (!value || value <= 0) {
      setError('Enter an amount above zero.')
      return
    }
    const result = startSession(currentUser.id, selectedTier, value, duration)
    if (result.error) {
      setError(result.error)
      return
    }
    setAmount('')
  }

  function handleClose(sessionId) {
    setCloseError('')
    const result = closeSession(sessionId)
    if (result?.error) setCloseError(result.error)
  }

  return (
    <Layout pageTitle="Investments">
      <h1 className="page-title">Investments</h1>
      <p className="page-sub">
        Pick a tier and commit part of your available balance to a session. Results are calculated from real price
        movement — the tier only sets a ceiling on what a gain pays out; a loss is never capped.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Available to commit</div>
          <div className="stat-value">{formatMoney(available)}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>{isManaged ? 'Commit to an investment' : 'Start a new investment'}</h3></div>
        <div style={{ padding: '16px 20px' }}>
          <div className="tier-preview-grid">
            {visibleTiers.map((tier, i) => {
              const isSelected = selectedTier === tier.id
              const TierIcon = tierIconFor(i)
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    setSelectedTier(tier.id)
                    setDuration(tier.durationDays)
                  }}
                  className={'tier-preview-card' + (isSelected ? ' tier-preview-active' : '')}
                  style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
                >
                  <div className="tier-preview-head">
                    <div className="icon-badge"><TierIcon size={16} /></div>
                    <strong>{tier.name}</strong>
                    {isSelected && <CheckCircle2 size={16} style={{ color: 'var(--accent-bright)' }} />}
                  </div>
                  <p>{tier.description}</p>

                  <div className="tier-preview-payout">{tier.maxPayoutMultiplier * 100}%</div>
                  <div className="tier-preview-payout-label">Max payout of session amount</div>

                  <div className="tier-preview-range">{formatMoney(tier.minDeposit)} – {formatMoney(tier.maxDeposit)}</div>
                  <div className="tier-preview-pills">
                    <span className="tier-preview-pill">{tier.leverageRange.min}x–{tier.leverageRange.max}x leverage</span>
                    <span className="tier-preview-pill">{tier.durationRange.min}–{tier.durationRange.max}d</span>
                  </div>
                </button>
              )
            })}
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 16px' }}>
            Need a session below {formatMoney(TIERS[0].minDeposit)} or above {formatMoney(TIERS[TIERS.length - 1].maxDeposit)}?
            {' '}Contact your account manager — they can set up a tailored session for accounts outside the standard range.
          </p>

          {isManaged && (
            <p style={{ fontSize: 12.5, color: 'var(--accent-bright)', margin: '4px 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={13} /> Managed mode: your commitment leaves your main balance right away, but the timer only starts once your account manager begins it.
            </p>
          )}

          {error && <div className="form-error">{error}</div>}

          <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Amount to commit (USD)</label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: 14
              }}
            />
            <button className="tx-btn deposit" onClick={handleStart}>{isManaged ? 'Commit funds' : 'Start session'}</button>
          </div>

          {(() => {
            const tier = getTier(selectedTier)
            const durationOptions = []
            for (let d = tier.durationRange.min; d <= tier.durationRange.max; d++) durationOptions.push(d)
            return (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Session length ({tier.durationRange.min}–{tier.durationRange.max} days)
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {durationOptions.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className="tx-btn"
                      style={{
                        padding: '6px 12px', fontSize: 12,
                        background: duration === d ? 'var(--accent)' : 'var(--bg)',
                        color: duration === d ? '#fff' : 'var(--text)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      {d} day{d === 1 ? '' : 's'}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
          {available <= 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10 }}>
              You don't have available balance yet — deposit first from the Deposit / Withdraw page.
            </p>
          )}
        </div>
      </div>

      {awaitingSessions.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h3><Clock3 size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Awaiting start</h3></div>
          <div style={{ padding: 16 }}>
            {awaitingSessions.map((s) => {
              const tier = getTier(s.tierId)
              return (
                <div key={s.id} className="entity-card entity-card-accent-pending">
                  <div className="icon-badge"><Lock size={17} /></div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">{tier?.name || s.tierId} · {formatMoney(s.amount)} committed</div>
                    <div className="entity-card-meta">
                      <span>Committed {formatDate(s.committedAt)}</span>
                      <span>{s.durationDays}-day session once started</span>
                    </div>
                  </div>
                  <button
                    className="tx-btn withdraw"
                    style={{ padding: '6px 12px', fontSize: 12, flex: 'none' }}
                    onClick={() => cancelAwaitingSession(s.id)}
                  >
                    Cancel
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeSessions.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h3><Sparkles size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Active investments</h3></div>
          {closeError && <div className="form-error" style={{ margin: '16px 20px 0' }}>{closeError}</div>}
          <div style={{ padding: 18 }}>
            <div className="investment-card-grid">
              {activeSessions.map((s) => {
                const tier = getTier(s.tierId)
                const liveValue = sessionCurrentValue(s)
                const livePnl = liveValue - s.amount
                const isExpired = new Date(s.expiresAt).getTime() <= Date.now()
                const isProfit = livePnl >= 0
                return (
                  <div key={s.id} className={'investment-card' + (isProfit ? '' : ' is-loss')}>
                    <div className="investment-card-head">
                      <div className="investment-card-tier">
                        <div className="icon-badge">{isProfit ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</div>
                        <div>
                          <strong>{tier?.name || s.tierId}</strong>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.leverage}x leverage</div>
                        </div>
                      </div>
                    </div>

                    <div className="investment-card-amount">{formatMoney(s.amount)} committed</div>
                    <div className={'investment-card-pnl ' + (isProfit ? 'pnl-up' : 'pnl-down')}>
                      {isProfit ? '+' : ''}{formatMoney(livePnl)}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                      <Clock3 size={13} /> {formatTimeLeft(s.expiresAt)}
                    </div>
                    <div className="progress-track" style={{ marginBottom: 4 }}>
                      <div className="progress-fill" style={{ width: `${sessionProgress(s)}%` }} />
                    </div>

                    <div className="investment-card-footer">
                      {isExpired ? (
                        <button className="tx-btn withdraw" style={{ padding: '6px 12px', fontSize: 12, flex: 'none' }} onClick={() => handleClose(s.id)}>
                          End session
                        </button>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Lock size={12} /> Locked until timer ends
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3><History size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Past investments</h3></div>
        {closedSessions.length === 0 ? (
          <div className="empty-state"><p>No completed investments yet.</p></div>
        ) : (
          <div style={{ padding: 16 }}>
            {closedSessions.map((s) => {
              const tier = getTier(s.tierId)
              const isCancelled = s.status === 'cancelled'
              const wasCapped = !isCancelled && s.payout < s.rawPnl
              const isProfit = !isCancelled && s.payout >= 0
              const settlementTx = !isCancelled
                ? transactions.find((t) => t.sessionId === s.id && t.type === 'session_settlement')
                : null
              const awaitingCertification = settlementTx?.status === 'pending'
              const accentClass = isCancelled
                ? 'entity-card-accent-pending'
                : awaitingCertification
                ? 'entity-card-accent-pending'
                : isProfit ? 'entity-card-accent-profit' : 'entity-card-accent-loss'
              return (
                <div key={s.id} className={'entity-card ' + accentClass}>
                  <div className="icon-badge">{isCancelled ? <X size={18} /> : isProfit ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">{tier?.name || s.tierId} · {formatMoney(s.amount)} committed</div>
                    <div className="entity-card-meta">
                      {isCancelled
                        ? <span>Cancelled {formatDate(s.closedAt)} — never started, funds released</span>
                        : <span>{formatDate(s.startedAt)} → {formatDate(s.closedAt)}</span>}
                      {awaitingCertification && <span style={{ color: 'var(--accent-bright)' }}>Awaiting certification</span>}
                      {wasCapped && <span>Tier cap reached — extra {formatMoney(s.excessPending || (s.rawPnl - s.payout))} pending review</span>}
                    </div>
                  </div>
                  {!isCancelled && (
                    <div className={(isProfit ? 'pnl-up' : 'pnl-down')} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, flex: 'none' }}>
                      {isProfit ? '+' : ''}{formatMoney(s.payout)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
