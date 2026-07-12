import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import { TIERS, ALL_TIERS, getTier } from '../config/tiers.js'

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
    startSession, closeSession, sessionCurrentValue,
    openSessionPosition, closeSessionPosition, setSessionLeverage, setSessionDuration,
    getEffectivePricesForSession, sessionScenarios, applySessionScenario, resetSessionScenario
  } = useApp()
  const { users, setUserTier, setClientVip } = useAuth()
  const { notify } = useNotifications()

  const [newSessionTier, setNewSessionTier] = useState(TIERS[0].id)
  const [newSessionDuration, setNewSessionDuration] = useState(TIERS[0].durationDays)
  const [newSessionAmount, setNewSessionAmount] = useState('')
  const [sessionError, setSessionError] = useState('')

  // Which active session the admin is currently trading against.
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [tradeSymbol, setTradeSymbol] = useState(Object.keys(prices)[0])
  const [tradeMargin, setTradeMargin] = useState('')
  const [tradeError, setTradeError] = useState('')
  const [leverageInput, setLeverageInput] = useState('')
  const [leverageError, setLeverageError] = useState('')
  const [durationInput, setDurationInput] = useState('')
  const [durationError, setDurationError] = useState('')

  const targetUser = users.find((u) => u.id === userId)
  const userOrders = orders.filter((o) => o.userId === userId)
  const userTransactions = transactions.filter((t) => t.userId === userId)
  const userSessions = sessions.filter((s) => s.userId === userId)
  const activeSessions = userSessions.filter((s) => s.status === 'active')

  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId) || activeSessions[0] || null

  if (!targetUser) {
    return (
      <Layout pageTitle="User not found">
        <div className="empty-state"><p>No such user.</p></div>
      </Layout>
    )
  }

  function handleStartSession() {
    setSessionError('')
    const amount = parseFloat(newSessionAmount)
    if (!amount || amount <= 0) return
    const result = startSession(userId, newSessionTier, amount, newSessionDuration)
    if (result.error) {
      setSessionError(result.error)
      return
    }
    setNewSessionAmount('')
  }

  function handleOpenPosition() {
    setTradeError('')
    if (!selectedSession) return
    const margin = parseFloat(tradeMargin)
    if (!margin || margin <= 0) {
      setTradeError('Enter a margin amount above zero.')
      return
    }
    const result = openSessionPosition(selectedSession.id, tradeSymbol, margin)
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

  function handleSetLeverage() {
    setLeverageError('')
    if (!selectedSession) return
    const leverage = parseFloat(leverageInput)
    if (!leverage || leverage <= 0) {
      setLeverageError('Enter a leverage above zero.')
      return
    }
    const result = setSessionLeverage(selectedSession.id, leverage)
    if (result.error) {
      setLeverageError(result.error)
      return
    }
    setLeverageInput('')
  }

  function handleSetDuration() {
    setDurationError('')
    if (!selectedSession) return
    const days = parseFloat(durationInput)
    if (!days || days <= 0) {
      setDurationError('Enter a duration above zero.')
      return
    }
    const result = setSessionDuration(selectedSession.id, days)
    if (result.error) {
      setDurationError(result.error)
      return
    }
    setDurationInput('')
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
      <p className="page-sub">{targetUser.email} — trade inside their active sessions below.</p>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Client balance</h3></div>
        <div className="stats-grid" style={{ padding: '16px 20px' }}>
          {(() => {
            const { total, available, pending, pendingCappedProfit } = getBalanceBreakdown(userId)
            return (
              <>
                <div className="stat-card">
                  <div className="stat-label">Total balance</div>
                  <div className="stat-value">{formatMoney(total)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Available</div>
                  <div className="stat-value">{formatMoney(available)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Committed to active sessions</div>
                  <div className="stat-value">{formatMoney(pending)}</div>
                </div>
                {pendingCappedProfit > 0 && (
                  <div className="stat-card" style={{ borderColor: 'var(--accent)' }}>
                    <div className="stat-label">Pending profit review</div>
                    <div className="stat-value">{formatMoney(pendingCappedProfit)}</div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>

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
      </div>

      {/* ---------- Per-session leveraged trading ---------- */}
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
                    {' '}This session is seeing a simulated price, not the real market shown above.
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
                  <input
                    type="number"
                    value={tradeMargin}
                    onChange={(e) => setTradeMargin(e.target.value)}
                    placeholder="Margin amount (USD)"
                    style={{ width: 170, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                  />
                  <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleOpenPosition}>
                    Open position ({selectedSession.leverage}x)
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
                      <tr><th>Symbol</th><th>Margin</th><th>Entry price</th><th>Current price</th><th>Live P&L</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {selectedSession.positions.map((p) => {
                        const currentPrice = effectivePrices[p.symbol]
                        const livePnl = p.marginAmount * p.leverage * ((currentPrice - p.entryPrice) / p.entryPrice)
                        return (
                          <tr key={p.id}>
                            <td>{p.symbol}</td>
                            <td>{formatMoney(p.marginAmount)}</td>
                            <td>{formatMoney(p.entryPrice)}</td>
                            <td>{formatMoney(currentPrice)}</td>
                            <td className={livePnl >= 0 ? 'pnl-up' : 'pnl-down'}>
                              {livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)}
                            </td>
                            <td>
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

      {/* ---------- Trade history (legacy buy/sell + new open/close position, same audit log) ---------- */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>Trade history</h3></div>
        {userOrders.length === 0 ? (
          <div className="empty-state"><p>No trades yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Type</th><th>Symbol</th><th>Detail</th><th>Price</th><th>P&amp;L</th><th>Executed by</th><th>Date</th></tr></thead>
            <tbody>
              {userOrders.map((o) => (
                <tr key={o.id}>
                  <td style={{ textTransform: 'capitalize' }}>{o.type.replace('_', ' ')}</td>
                  <td>{o.symbol}</td>
                  <td>
                    {o.units != null
                      ? `${o.units.toFixed(4)} units`
                      : `${formatMoney(o.marginAmount)} @ ${o.leverage}x`}
                  </td>
                  <td>{formatMoney(o.price)}</td>
                  <td className={o.pnl != null ? (o.pnl >= 0 ? 'pnl-up' : 'pnl-down') : undefined}>
                    {o.pnl != null ? (o.pnl >= 0 ? '+' : '') + formatMoney(o.pnl) : '—'}
                  </td>
                  <td>{o.executedByAdminName || '—'}</td>
                  <td>{formatDate(o.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>Deposit / withdrawal history</h3></div>
        {userTransactions.length === 0 ? (
          <div className="empty-state"><p>No requests yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Type</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {userTransactions.map((t) => (
                <tr key={t.id}>
                  <td style={{ textTransform: 'capitalize' }}>{t.type.replace('_', ' ')}</td>
                  <td>{formatMoney(t.amount)}</td>
                  <td>{formatDate(t.date)}</td>
                  <td><span className={'status-pill status-' + t.status}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>Trading sessions</h3></div>

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
          <table>
            <thead>
              <tr><th>Tier</th><th>Amount</th><th>Leverage</th><th>Started</th><th>Status</th><th>Result</th><th>Action</th></tr>
            </thead>
            <tbody>
              {userSessions.map((s) => {
                const tier = getTier(s.tierId)
                const liveValue = s.status === 'active' ? sessionCurrentValue(s) : s.endValue
                const livePnl = s.status === 'active' ? liveValue - s.amount : s.rawPnl
                const wasCapped = s.status === 'closed' && s.payout < s.rawPnl
                return (
                  <tr key={s.id}>
                    <td>{tier?.name || s.tierId}</td>
                    <td>{formatMoney(s.amount)}</td>
                    <td>{s.leverage}x</td>
                    <td>{formatDate(s.startedAt)}</td>
                    <td>
                      <span className={'status-pill status-' + (s.status === 'active' ? 'pending' : 'approved')}>{s.status}</span>
                      {s.status === 'active' && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{formatTimeLeft(s.expiresAt)}</span>
                      )}
                    </td>
                    <td className={livePnl >= 0 ? 'pnl-up' : 'pnl-down'}>
                      {s.status === 'active'
                        ? <>{livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)} (live)</>
                        : <>
                            {s.payout >= 0 ? '+' : ''}{formatMoney(s.payout)}
                            {wasCapped && (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                {' '}(tier cap reached — extra {formatMoney(s.excessPending || (s.rawPnl - s.payout))} pending review)
                              </span>
                            )}
                            {s.closedReason === 'expired' && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> (auto-expired)</span>}
                          </>
                      }
                    </td>
                    <td>
                      {s.status === 'active' && (
                        <button className="tx-btn withdraw" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => closeSession(s.id)}>
                          Close session
                        </button>
                      )}
                    </td>
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
