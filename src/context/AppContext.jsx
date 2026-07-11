import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useNotifications } from './NotificationContext.jsx'
import { isLiveMode } from '../config/tradingMode.js'
import { getTier, clampLeverage } from '../config/tiers.js'

const AppContext = createContext(null)

const STARTING_PRICES = {
  'BTC/USD': 64200,
  'ETH/USD': 3150,
  'EUR/USD': 1.086,
  'GBP/USD': 1.271
}

const STARTING_WATCHLIST = ['BTC/USD', 'ETH/USD']

function formatUsd(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

// changePercent is pure random noise by default. `drift` is an
// optional small nudge added on top — this is how market bias works:
// it tilts the real random walk, it does not set a price or a profit
// directly. `volatilityMultiplier` scales the noise's amplitude —
// bigger swings, still random, not a bigger drift.
function randomWalk(price, drift = 0, volatilityMultiplier = 1) {
  const changePercent = (Math.random() - 0.5) * 0.006 * volatilityMultiplier + drift
  return price * (1 + changePercent)
}

// Converts a market-bias setting into a drift percentage per tick.
// Neutral = no thumb on the scale at all. Strength 1-3 controls how
// hard the tilt is; even at strength 3 it's still just weighting the
// same random walk, not overriding it.
function biasToDrift(bias) {
  if (!bias || bias.mode === 'neutral') return 0
  const magnitude = 0.0008 * (bias.strength || 1)
  return bias.mode === 'bullish' ? magnitude : -magnitude
}

// The real cash-out value of ONE open leveraged position, given a
// price snapshot. marginAmount is what the position actually risks;
// leverage multiplies both the gain AND the loss against that margin.
// Equity can go negative if the loss exceeds the margin — that's the
// literal implementation of "leverage allows negative balance, no
// auto-liquidation."
function positionEquity(position, currentPrices) {
  const price = currentPrices[position.symbol]
  if (!price) return position.marginAmount
  const pnl = position.marginAmount * position.leverage * ((price - position.entryPrice) / position.entryPrice)
  return position.marginAmount + pnl
}

// Pure function, no React state — figures out what a session would
// settle to RIGHT NOW if every open position closed at the given
// price snapshot. Used identically by manual close and auto-expiry
// close, so the math can never drift between the two paths.
function computeSessionSettlement(session, currentPrices) {
  const tier = getTier(session.tierId)
  const positionsEquity = session.positions.reduce((sum, p) => sum + positionEquity(p, currentPrices), 0)
  const endValue = session.cash + positionsEquity
  const rawPnl = endValue - session.amount
  const cappedGain = tier ? session.amount * tier.maxPayoutMultiplier : rawPnl
  // Gains are capped at the tier's multiplier. Losses are NEVER
  // capped — a real loss is paid out in full, however large.
  const payout = rawPnl > 0 ? Math.min(rawPnl, cappedGain) : rawPnl
  return { endValue, rawPnl, payout }
}

export function AppProvider({ children }) {
  const { currentUser, users } = useAuth()
  const { notify } = useNotifications()
  const [theme, setThemeState] = useState(() => localStorage.getItem('pulse_theme') || 'dark')
  const [accent, setAccentState] = useState(() => localStorage.getItem('pulse_accent') || 'ember')
  const [prices, setPrices] = useState(STARTING_PRICES)
  const [history, setHistory] = useState([])

  // Demo-only scenario control. Neutral means zero effect — the price
  // feed behaves exactly as before. This is admin-only in the UI, and
  // it never touches a balance or a session's payout directly; it only
  // tilts the random walk that ALL settlement math already reads from.
  const [marketBias, setMarketBiasState] = useState(() => {
    const saved = localStorage.getItem('pulse_market_bias')
    const parsed = saved ? JSON.parse(saved) : null
    return { mode: 'neutral', strength: 1, volatility: 1, speed: 1, ...parsed }
  })

  useEffect(() => {
    localStorage.setItem('pulse_market_bias', JSON.stringify(marketBias))
  }, [marketBias])

  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem('pulse_orders')
    return saved ? JSON.parse(saved) : []
  })

  const [watchlist, setWatchlist] = useState(STARTING_WATCHLIST)

  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('pulse_transactions')
    return saved ? JSON.parse(saved) : []
  })

  // Keyed by nothing — a flat list, each entry tagged with userId,
  // same pattern as orders/transactions. A session records a tier
  // choice + a starting amount, and closes into a capped payout.
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('pulse_sessions')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem('pulse_transactions', JSON.stringify(transactions))
  }, [transactions])

  useEffect(() => {
    localStorage.setItem('pulse_sessions', JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    localStorage.setItem('pulse_orders', JSON.stringify(orders))
  }, [orders])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pulse_theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent)
    localStorage.setItem('pulse_accent', accent)
  }, [accent])

  // Refs mirroring the latest sessions/users state. The price-tick
  // interval below is set up ONCE on mount (empty dependency array),
  // so any state it reads via closure would be frozen at mount time.
  // Refs sidestep that: they're mutable boxes the interval can read
  // fresh values from on every tick without needing to be re-created.
  const sessionsRef = useRef(sessions)
  const usersRef = useRef(users)
  const marketBiasRef = useRef(marketBias)
  const notifyRef = useRef(notify)
  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => { usersRef.current = users }, [users])
  useEffect(() => { marketBiasRef.current = marketBias }, [marketBias])
  useEffect(() => { notifyRef.current = notify }, [notify])

  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        const bias = marketBiasRef.current
        const drift = biasToDrift(bias)
        const volatility = bias.volatility || 1
        // "Speed" compounds multiple random-walk steps into this one
        // 2-second tick instead of re-creating the interval at a
        // different frequency — same timer, more motion per tick.
        // That's what makes a session visibly play out faster during
        // a demo, without touching the interval's own timing.
        const steps = Math.max(1, Math.min(10, Math.round(bias.speed || 1)))

        let next = prev
        const newPoints = []
        for (let i = 0; i < steps; i++) {
          const stepped = {}
          Object.keys(next).forEach((symbol) => {
            stepped[symbol] = randomWalk(next[symbol], drift, volatility)
          })
          next = stepped
          // Every symbol's price is captured on each history point
          // (not just BTC), so per-instrument charts and candlesticks
          // on the Markets page have real data to read from — `value`
          // is kept as an alias so the existing Dashboard chart
          // doesn't need to change.
          newPoints.push({ time: new Date().toLocaleTimeString(), value: next['BTC/USD'], ...next })
        }

        setHistory((prevHistory) => [...prevHistory, ...newPoints].slice(-150))

        // Auto-expiry: any active session whose expiresAt has passed
        // gets force-settled here, using the final price snapshot
        // from this tick (`next`) rather than state, since state
        // hasn't re-rendered yet at this point in the tick.
        const expired = sessionsRef.current.filter(
          (s) => s.status === 'active' && s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now()
        )
        if (expired.length > 0) {
          expired.forEach((session) => {
            const { endValue, rawPnl, payout } = computeSessionSettlement(session, next)
            setSessions((prevSessions) =>
              prevSessions.map((s) =>
                s.id === session.id
                  ? { ...s, status: 'closed', closedAt: new Date().toISOString(), cash: endValue, positions: [], endValue, rawPnl, payout, closedReason: 'expired' }
                  : s
              )
            )
            const owner = usersRef.current.find((u) => u.id === session.userId)
            setTransactions((prevTx) => [
              {
                id: `${Date.now()}-${session.id}`,
                userId: session.userId,
                userName: owner?.name,
                type: 'session_settlement',
                amount: payout,
                date: new Date().toISOString(),
                status: 'approved',
                sessionId: session.id,
                closedReason: 'expired'
              },
              ...prevTx
            ])
            notifyRef.current(
              session.userId,
              payout >= 0 ? 'session_settled_profit' : 'session_settled_loss',
              payout >= 0 ? 'Session ended in profit' : 'Session ended in a loss',
              `Your session timer ran out. Result: ${payout >= 0 ? '+' : ''}$${payout.toFixed(2)}.`,
              { sessionId: session.id, payout }
            )
          })
        }

        return next
      })
    }, 2000)
    return () => clearInterval(id)
  }, [])

  function toggleWatchlist(symbol) {
    setWatchlist((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    )
  }

  // Recent high/low for one symbol, read straight from the same
  // `history` buffer the charts use — not a separate calculation, so
  // it can never disagree with what's on screen.
  function getRecentRange(symbol) {
    if (history.length === 0) return { high: prices[symbol], low: prices[symbol] }
    const values = history.map((point) => point[symbol]).filter((v) => v != null)
    if (values.length === 0) return { high: prices[symbol], low: prices[symbol] }
    return { high: Math.max(...values), low: Math.min(...values) }
  }

  // Reads any user's real balance, calculated purely from their
  // approved transactions — deposits add, withdrawals subtract,
  // session settlements add/subtract the capped result. Never
  // hand-edited anywhere.
  function getAccountBalance(userId) {
    return transactions
      .filter((t) => t.userId === userId && t.status === 'approved')
      .reduce((sum, t) => {
        if (t.type === 'deposit') return sum + t.amount
        if (t.type === 'withdrawal') return sum - t.amount
        if (t.type === 'session_settlement') return sum + t.amount
        return sum
      }, 0)
  }

  // total = real balance. pending = capital currently locked in
  // active sessions. available = total - pending, the only amount
  // a client can withdraw or commit to a new session.
  function getBalanceBreakdown(userId) {
    const total = getAccountBalance(userId)
    const pending = sessions
      .filter((s) => s.userId === userId && s.status === 'active')
      .reduce((sum, s) => sum + s.amount, 0)
    return { total, available: total - pending, pending }
  }

  // Starts a new trading session for a client at a given tier.
  // Works whether an admin calls it on a client's behalf, or a
  // client starts their own — either way it's checked against real
  // available balance, so a session can never be funded by money
  // that isn't actually there. The session's own `cash` starts equal
  // to `amount`; leverage and duration come straight from the tier.
  function startSession(targetUserId, tierId, amount) {
    const tier = getTier(tierId)
    if (!tier || !amount || amount <= 0) return { error: 'Invalid tier or amount.' }

    const { available } = getBalanceBreakdown(targetUserId)
    if (amount > available) return { error: 'Amount exceeds available balance.' }

    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + tier.durationDays * 24 * 60 * 60 * 1000)

    const session = {
      id: Date.now(),
      userId: targetUserId,
      tierId,
      amount,
      leverage: tier.defaultLeverage,
      cash: amount,
      positions: [],
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'active',
      closedAt: null,
      closedReason: null,
      endValue: null,
      rawPnl: null,
      payout: null,
      initiatedByName: currentUser?.name,
      initiatedBySelf: currentUser?.id === targetUserId
    }
    setSessions((prev) => [session, ...prev])
    return { session }
  }

  // A session's live value = its uncommitted cash, plus the current
  // mark-to-market equity of every position still open in it.
  // Calculated purely from the real price feed, never typed in.
  function sessionCurrentValue(session) {
    return session.cash + session.positions.reduce((sum, p) => sum + positionEquity(p, prices), 0)
  }

  // ADMIN-ONLY: changes a session's leverage going forward, clamped to
  // its tier's allowed range (1-300x / 1-500x / 1-1000x). This only
  // affects positions opened AFTER the change — each open position
  // already stores the leverage it was opened with (see
  // openSessionPosition), so past positions are never silently
  // repriced by a later leverage edit.
  function setSessionLeverage(sessionId, leverage) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'active') return { error: 'Session is not active.' }
    if (!leverage || leverage <= 0) return { error: 'Enter a leverage above zero.' }

    const clamped = clampLeverage(session.tierId, leverage)
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, leverage: clamped } : s)))
    return { leverage: clamped }
  }

  // ADMIN-ONLY: opens a leveraged position scoped to ONE session's own
  // cash — never the client's wider account balance. marginAmount is
  // deducted from the session's cash the moment the position opens;
  // that's the literal enforcement of "can only trade with the exact
  // amount committed to this session."
  function openSessionPosition(sessionId, symbol, marginAmount) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'active') return { error: 'Session is not active.' }
    const price = prices[symbol]
    if (!price || !marginAmount || marginAmount <= 0) return { error: 'Invalid symbol or margin amount.' }
    if (marginAmount > session.cash) return { error: 'Exceeds this session\u2019s available cash.' }

    const position = {
      id: Date.now(),
      symbol,
      entryPrice: price,
      marginAmount,
      leverage: session.leverage,
      openedAt: new Date().toISOString()
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, cash: s.cash - marginAmount, positions: [...s.positions, position] }
          : s
      )
    )
    logSessionAction(session.userId, sessionId, 'open_position', symbol, marginAmount, session.leverage, price, null)
    notify(
      session.userId,
      'trade_opened',
      'Trade opened',
      `${symbol} position opened — ${formatUsd(marginAmount)} margin at ${session.leverage}x.`,
      { sessionId, symbol, marginAmount, leverage: session.leverage }
    )
    return { position }
  }

  // ADMIN-ONLY: closes one open position inside a session. Its full
  // equity (margin +/- leveraged P&L) returns to the session's cash —
  // equity can be negative, which pulls the session's cash down with
  // it. No auto-liquidation: this mirrors the explicit "allow negative
  // balance over auto-close at zero" decision.
  function closeSessionPosition(sessionId, positionId) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'active') return { error: 'Session is not active.' }
    const position = session.positions.find((p) => p.id === positionId)
    if (!position) return { error: 'Position not found.' }

    const price = prices[position.symbol]
    const equity = positionEquity(position, prices)
    const pnl = equity - position.marginAmount

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, cash: s.cash + equity, positions: s.positions.filter((p) => p.id !== positionId) }
          : s
      )
    )
    logSessionAction(session.userId, sessionId, 'close_position', position.symbol, position.marginAmount, position.leverage, price, pnl)
    notify(
      session.userId,
      pnl >= 0 ? 'trade_closed_profit' : 'trade_closed_loss',
      pnl >= 0 ? 'Trade closed in profit' : 'Trade closed at a loss',
      `${position.symbol} position closed: ${pnl >= 0 ? '+' : ''}${formatUsd(pnl)}.`,
      { sessionId, symbol: position.symbol, pnl }
    )
    checkTradeAchievements(session.userId, pnl)
    return { equity, pnl }
  }

  // Real milestones only — each check counts ACTUAL closed positions
  // already in `orders`, then fires once the count including this new
  // trade crosses a threshold for the first time. No fabricated
  // numbers, no participation-trophy noise on every trade.
  function checkTradeAchievements(userId, latestPnl) {
    const priorWins = orders.filter((o) => o.userId === userId && o.type === 'close_position' && o.pnl > 0).length
    const priorClosed = orders.filter((o) => o.userId === userId && o.type === 'close_position').length
    const newWins = priorWins + (latestPnl > 0 ? 1 : 0)
    const newClosed = priorClosed + 1

    if (priorClosed === 0) {
      notify(userId, 'achievement', 'First trade closed', 'You closed your first position. Every closed trade from here on builds your real trade history.')
    }
    ;[5, 10, 25, 50].forEach((milestone) => {
      if (priorWins < milestone && newWins >= milestone) {
        notify(userId, 'achievement', `${milestone} winning trades`, `You've now closed ${milestone} winning trades.`)
      }
    })
  }

  // Audit trail for session-scoped trades — same storage bucket and
  // shape family as the legacy logOrder(), just extended with
  // sessionId/leverage/pnl so both can share one "Trade history" view.
  function logSessionAction(targetUserId, sessionId, type, symbol, marginAmount, leverage, price, pnl) {
    setOrders((prev) => [
      {
        id: Date.now(),
        userId: targetUserId,
        sessionId,
        executedByAdminId: currentUser?.id,
        executedByAdminName: currentUser?.name,
        type,
        symbol,
        marginAmount,
        leverage,
        price,
        pnl,
        date: new Date().toISOString()
      },
      ...prev
    ])
  }

  // ADMIN-ONLY, demo tool. Sets how the real price feed's random walk
  // is tilted and how energetically it moves. 'neutral'/1/1/1 fully
  // restores plain, original behavior. This is the sanctioned
  // alternative to a hand-typed profit: it changes the INPUT (the
  // price feed's drift, amplitude, and pace), never the OUTPUT (a
  // session's payout, which is still always computed).
  //   mode: 'neutral' | 'bullish' | 'bearish' — which way the walk leans
  //   strength: 1-3 — how hard it leans that way
  //   volatility: 1-3 — how big each random swing is, regardless of lean
  //   speed: 1-10 — how many random-walk steps compound into each tick
  //          (higher = the market visibly moves faster during a demo)
  const BIAS_MODES = ['neutral', 'bullish', 'bearish']
  function setMarketScenario(mode, strength = 1, volatility = 1, speed = 1) {
    if (!BIAS_MODES.includes(mode)) return { error: 'Invalid scenario mode.' }
    setMarketBiasState({
      mode,
      strength: Math.min(3, Math.max(1, Math.round(strength))),
      volatility: Math.min(3, Math.max(1, Math.round(volatility))),
      speed: Math.min(10, Math.max(1, Math.round(speed)))
    })
    return { ok: true }
  }

  // ADMIN-ONLY, demo tool. Pulls a session's expiresAt closer by the
  // given number of hours, so a demo doesn't need to wait out real
  // tier durations (2-7 days). This ONLY changes timing — if it pushes
  // expiresAt into the past, the existing auto-expiry logic settles it
  // on the next price tick using the real computeSessionSettlement(),
  // off whatever the (possibly biased) price feed actually did. No
  // payout number is ever set directly.
  function fastForwardSession(sessionId, hours) {
    if (!hours || hours <= 0) return { error: 'Enter hours above zero.' }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId && s.status === 'active'
          ? { ...s, expiresAt: new Date(new Date(s.expiresAt).getTime() - hours * 60 * 60 * 1000).toISOString() }
          : s
      )
    )
    return { ok: true }
  }

  // Same as fastForwardSession, applied to every active session at
  // once — handy for showcasing several clients settling in one go
  // instead of clicking through each session individually.
  function fastForwardAllSessions(hours) {
    if (!hours || hours <= 0) return { error: 'Enter hours above zero.' }
    setSessions((prev) =>
      prev.map((s) =>
        s.status === 'active'
          ? { ...s, expiresAt: new Date(new Date(s.expiresAt).getTime() - hours * 60 * 60 * 1000).toISOString() }
          : s
      )
    )
    return { ok: true }
  }

  // Manually closes a session: force-settles every still-open position
  // into cash, applies the tier's payout cap to the overall result,
  // and posts a real settlement transaction so the client's balance
  // actually updates. Rule: if the real gain is positive, payout is
  // the SMALLER of the real gain or (amount * tier.maxPayoutMultiplier).
  // If the real result is a loss, payout is the full loss — losses are
  // never capped. Uses the same computeSessionSettlement() as auto-expiry
  // so the two paths can't disagree.
  //
  // Early-close rule: a client can only end their OWN session once its
  // timer has actually run out — the session's terms were agreed to
  // when it started, and a client backing out early to dodge a bad
  // move would undermine the whole "real, timed commitment" premise.
  // Admins retain the ability to close early (this is their account-
  // management tool, not a client self-service action) — same as
  // AdminUserDetail's "Close session" already assumes.
  function closeSession(sessionId) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'active') return { error: 'Session is not active.' }

    const isAdmin = currentUser?.role === 'admin'
    const isExpired = new Date(session.expiresAt).getTime() <= Date.now()
    if (!isAdmin && !isExpired) {
      return { error: 'This session can\u2019t be closed until its timer ends.' }
    }

    const { endValue, rawPnl, payout } = computeSessionSettlement(session, prices)

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, status: 'closed', closedAt: new Date().toISOString(), cash: endValue, positions: [], endValue, rawPnl, payout, closedReason: 'manual' }
          : s
      )
    )

    const owner = users.find((u) => u.id === session.userId)
    setTransactions((prev) => [
      {
        id: Date.now(),
        userId: session.userId,
        userName: owner?.name,
        type: 'session_settlement',
        amount: payout,
        date: new Date().toISOString(),
        status: 'approved',
        sessionId,
        closedReason: 'manual'
      },
      ...prev
    ])
    notify(
      session.userId,
      payout >= 0 ? 'session_settled_profit' : 'session_settled_loss',
      payout >= 0 ? 'Session closed in profit' : 'Session closed at a loss',
      `Result: ${payout >= 0 ? '+' : ''}${formatUsd(payout)}${payout < rawPnl ? ' (capped by tier)' : ''}.`,
      { sessionId, payout, rawPnl }
    )
    if (payout > 0) {
      const priorProfitableSessions = sessions.filter(
        (s) => s.userId === session.userId && s.status === 'closed' && s.payout > 0
      ).length
      if (priorProfitableSessions === 0) {
        notify(session.userId, 'achievement', 'First profitable session', 'Your first session closed in profit — a real, calculated result.')
      }
    }
    return { ok: true }
  }

  function getSessionsForUser(userId) {
    return sessions.filter((s) => s.userId === userId)
  }

  function addTransaction(type, amount) {
    if (isLiveMode) {
      console.log('LIVE mode: would call Deriv API here')
      return
    }

    setTransactions((prev) => [
      {
        id: Date.now(),
        userId: currentUser?.id,
        userName: currentUser?.name,
        type,
        amount,
        date: new Date().toISOString(),
        status: 'pending'
      },
      ...prev
    ])
  }

  function approveTransaction(id) {
    const tx = transactions.find((t) => t.id === id)
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'approved' } : t))
    )
    if (tx) {
      notify(
        tx.userId,
        tx.type === 'deposit' ? 'deposit_approved' : 'withdrawal_approved',
        tx.type === 'deposit' ? 'Deposit approved' : 'Withdrawal approved',
        `Your ${tx.type} of ${formatUsd(tx.amount)} was approved.`,
        { transactionId: id, amount: tx.amount }
      )
    }
  }

  function rejectTransaction(id) {
    const tx = transactions.find((t) => t.id === id)
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'rejected' } : t))
    )
    if (tx) {
      notify(
        tx.userId,
        'balance_update',
        `${tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'} request rejected`,
        `Your ${tx.type} request of ${formatUsd(tx.amount)} was rejected. Contact support if this is unexpected.`,
        { transactionId: id, amount: tx.amount }
      )
    }
  }

  // Convenience value for the logged-in user specifically — same
  // calculation as getAccountBalance(userId), just pre-applied.
  const accountBalance = getAccountBalance(currentUser?.id)

  const value = {
    theme,
    setTheme: setThemeState,
    accent,
    setAccent: setAccentState,
    prices,
    history,
    getRecentRange,
    orders,
    watchlist,
    toggleWatchlist,
    transactions,
    addTransaction,
    approveTransaction,
    rejectTransaction,
    accountBalance,
    getAccountBalance,
    getBalanceBreakdown,
    sessions,
    startSession,
    closeSession,
    openSessionPosition,
    closeSessionPosition,
    setSessionLeverage,
    sessionCurrentValue,
    getSessionsForUser,
    marketBias,
    setMarketScenario,
    fastForwardSession,
    fastForwardAllSessions
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}