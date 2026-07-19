import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useNotifications } from './NotificationContext.jsx'
import { getTier, clampLeverage, clampDuration } from '../config/tiers.js'
import { fetchRealCryptoPrices } from '../services/coingecko.js'

const AppContext = createContext(null)

// BTC/ETH now track a real feed (CoinGecko); EUR/GBP stay on the
// original simulated random walk until a forex data source is wired
// up (that one needs a backend — CORS/paid-key territory, unlike
// CoinGecko's keyless public endpoint).
export const REAL_SYMBOLS = ['BTC/USD', 'ETH/USD']
export const SIMULATED_SYMBOLS = ['EUR/USD', 'GBP/USD']
const REAL_PRICE_POLL_MS = 20 * 1000 // 20s — 3 req/min, well under CoinGecko's keyless limit

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
  // The portion of a real gain ABOVE the cap is never discarded —
  // it's held as a separate pending amount for admin review (see
  // closeSession/auto-expiry), rather than silently disappearing.
  const excessPending = rawPnl > cappedGain ? rawPnl - cappedGain : 0
  return { endValue, rawPnl, payout, excessPending }
}

export function AppProvider({ children }) {
  const { currentUser, users } = useAuth()
  const { notify } = useNotifications()
  const [theme, setThemeState] = useState(() => localStorage.getItem('pulse_theme') || 'dark')
  const [accent, setAccentState] = useState(() => localStorage.getItem('pulse_accent') || 'ember')
  const [prices, setPrices] = useState(STARTING_PRICES)
  const [history, setHistory] = useState([])
  // Tracks the REAL feed's health — when it last succeeded, and
  // whether the most recent poll failed. Markets.jsx/Dashboard use
  // this to show something honest ("live", "last updated 40s ago",
  // "feed unavailable, showing last known price") instead of implying
  // every price on screen is always fresh.
  const [priceFeedStatus, setPriceFeedStatus] = useState({ lastUpdated: null, error: null })

  // Demo-only scenario control — per SESSION, not global. Each active
  // session can carry its own bias/volatility/speed (or none at all).
  // A session with no entry here just tracks the real, always-neutral
  // global price feed. This is what makes "bias one client's session
  // while another client's market stays completely normal" true: the
  // global `prices` random walk below is now always plain/neutral —
  // nothing admin sets ever touches it. Only a session with an entry
  // here sees a different, independently-evolving synthetic price.
  const [sessionScenarios, setSessionScenarios] = useState(() => {
    const saved = localStorage.getItem('pulse_session_scenarios')
    return saved ? JSON.parse(saved) : {}
  })

  useEffect(() => {
    localStorage.setItem('pulse_session_scenarios', JSON.stringify(sessionScenarios))
  }, [sessionScenarios])

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
    if (!saved) return []
    // Defensive normalization: a session saved before the
    // trading-engine rework won't have positions/cash/leverage at
    // all. Without this, reading session.positions.length on one of
    // these throws and can silently blank out an entire panel —
    // exactly the "positions disappeared" symptom this guards against.
    return JSON.parse(saved).map((s) => ({
      cash: s.amount ?? 0,
      positions: [],
      leverage: 1,
      ...s
    }))
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
  const sessionScenariosRef = useRef(sessionScenarios)
  const notifyRef = useRef(notify)
  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => { usersRef.current = users }, [users])
  useEffect(() => { sessionScenariosRef.current = sessionScenarios }, [sessionScenarios])
  useEffect(() => { notifyRef.current = notify }, [notify])

  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        // Real symbols (BTC/ETH) are left untouched on this fast tick
        // — their actual value only changes when the periodic
        // CoinGecko fetch below succeeds. Simulated symbols (EUR/GBP)
        // keep the original random walk until a real forex feed is
        // wired up. Either way, nothing here is a global bias switch
        // anymore — bias only ever lives inside sessionScenarios.
        const next = { ...prev }
        SIMULATED_SYMBOLS.forEach((symbol) => {
          next[symbol] = randomWalk(prev[symbol])
        })
        setHistory((prevHistory) => {
          const point = { time: new Date().toLocaleTimeString(), value: next['BTC/USD'], ...next }
          return [...prevHistory, point].slice(-150)
        })

        // Tick every session's own scenario independently. A session
        // not in this map simply isn't touched — it keeps reading the
        // plain `next` prices above, i.e. "normal market," even while
        // a sibling session right next to it is biased.
        const updatedScenarios = {}
        Object.entries(sessionScenariosRef.current).forEach(([sessionId, scenario]) => {
          if (scenario.reset) {
            const elapsed = Date.now() - new Date(scenario.reset.startedAt).getTime()
            const progress = Math.min(1, Math.max(0, elapsed / scenario.reset.durationMs))
            if (progress >= 1) {
              // Fully settled back to normal — drop the scenario
              // entirely so this session goes back to reading the
              // real global feed directly, with nothing layered on top.
              return
            }
            const interpolated = {}
            Object.keys(scenario.reset.fromPrices).forEach((symbol) => {
              const from = scenario.reset.fromPrices[symbol]
              const to = next[symbol]
              interpolated[symbol] = from + (to - from) * progress
            })
            updatedScenarios[sessionId] = { ...scenario, prices: interpolated }
          } else {
            const drift = biasToDrift(scenario)
            const volatility = scenario.volatility || 1
            const steps = Math.max(1, Math.min(10, Math.round(scenario.speed || 1)))
            let stepped = scenario.prices
            for (let i = 0; i < steps; i++) {
              const tickResult = {}
              Object.keys(stepped).forEach((symbol) => {
                tickResult[symbol] = randomWalk(stepped[symbol], drift, volatility)
              })
              stepped = tickResult
            }
            updatedScenarios[sessionId] = { ...scenario, prices: stepped }
          }
        })
        setSessionScenarios(updatedScenarios)

        // Auto-expiry: any active session whose expiresAt has passed
        // gets force-settled here. Each session settles against ITS
        // OWN effective prices — the plain global feed, merged with
        // that session's synthetic prices if it has an active
        // scenario — computed fresh from this same tick, never stale.
        const expired = sessionsRef.current.filter(
          (s) => s.status === 'active' && s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now()
        )
        if (expired.length > 0) {
          expired.forEach((session) => {
            const effectivePrices = { ...next, ...(updatedScenarios[session.id]?.prices || {}) }
            delete updatedScenarios[session.id]
            const { endValue, rawPnl, payout, excessPending } = computeSessionSettlement(session, effectivePrices)
            setSessions((prevSessions) =>
              prevSessions.map((s) =>
                s.id === session.id
                  ? { ...s, status: 'closed', closedAt: new Date().toISOString(), cash: endValue, positions: [], endValue, rawPnl, payout, excessPending, closedReason: 'expired' }
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
              ...(excessPending > 0
                ? [{
                    id: `${Date.now()}-${session.id}-excess`,
                    userId: session.userId,
                    userName: owner?.name,
                    type: 'capped_profit_release',
                    amount: excessPending,
                    date: new Date().toISOString(),
                    status: 'pending',
                    sessionId: session.id
                  }]
                : []),
              ...prevTx
            ])
            notifyRef.current(
              session.userId,
              payout >= 0 ? 'session_settled_profit' : 'session_settled_loss',
              payout >= 0 ? 'Session ended in profit' : 'Session ended in a loss',
              `Your session timer ran out. Result: ${payout >= 0 ? '+' : ''}$${payout.toFixed(2)}.`,
              { sessionId: session.id, payout }
            )
            if (excessPending > 0) {
              notifyRef.current(
                session.userId,
                'capped_profit_pending',
                'Extra profit pending review',
                `This session outperformed its tier cap by $${excessPending.toFixed(2)}. That extra amount is held for admin review before it's added to your balance.`,
                { sessionId: session.id, excessPending }
              )
            }
          })
        }

        return next
      })
    }, 2000)
    return () => clearInterval(id)
  }, [])

  // Real price feed: polls CoinGecko for BTC/ETH on its own slower
  // interval, independent of the 2-second simulated tick above. An
  // immediate fetch on mount means the real price shows up right
  // away rather than waiting a full poll interval. On failure, the
  // last known price is kept as-is — never zeroed, never silently
  // replaced with a guess.
  useEffect(() => {
    let cancelled = false

    async function poll() {
      const result = await fetchRealCryptoPrices()
      if (cancelled) return
      if (result) {
        setPrices((prev) => ({ ...prev, ...result }))
        setPriceFeedStatus({ lastUpdated: new Date().toISOString(), error: null })
      } else {
        setPriceFeedStatus((prev) => ({ ...prev, error: 'Price feed temporarily unavailable — showing last known price.' }))
      }
    }

    poll()
    const id = setInterval(poll, REAL_PRICE_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
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

  // The real market price everywhere, merged with ONE session's own
  // synthetic prices if it currently has a scenario applied. Every
  // position calculation for that session — open, close, live value,
  // settlement — reads through this single function, so there's
  // exactly one place that decides "which price does this session see."
  function getEffectivePricesForSession(sessionId) {
    const scenario = sessionScenarios[sessionId]
    if (!scenario) return prices
    return { ...prices, ...scenario.prices }
  }

  const RESET_DURATIONS = { mild: 5 * 60 * 1000, normal: 90 * 1000, hard: 15 * 1000 }
  const SCENARIO_MODES = ['neutral', 'bullish', 'bearish']

  // ADMIN-ONLY, demo tool. Applies (or updates) a bias to exactly ONE
  // session — every other session, including other sessions for the
  // same client, keeps reading the real, unbiased global price feed.
  // This is the actual fix for "scenario control affected every
  // client at once": there is no more global switch, only this.
  //   mode/strength: which way this session's synthetic price leans, how hard
  //   volatility: how big each swing is
  //   speed: how many steps compound per tick (visibly faster motion)
  function applySessionScenario(sessionId, mode, strength = 1, volatility = 1, speed = 1) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'active') return { error: 'Session is not active.' }
    if (!SCENARIO_MODES.includes(mode)) return { error: 'Invalid scenario mode.' }

    const existing = sessionScenarios[sessionId]
    // Continuation, not a jump: if this session already has synthetic
    // prices, keep them as the starting point for the new settings.
    // Otherwise seed from wherever the real market is right now.
    const seedPrices = existing?.prices || { ...prices }

    setSessionScenarios((prev) => ({
      ...prev,
      [sessionId]: {
        mode,
        strength: Math.min(3, Math.max(1, Math.round(strength))),
        volatility: Math.min(3, Math.max(1, Math.round(volatility))),
        speed: Math.min(10, Math.max(1, Math.round(speed))),
        appliedAt: new Date().toISOString(),
        prices: seedPrices,
        reset: null
      }
    }))
    return { ok: true }
  }

  // ADMIN-ONLY, demo tool. Starts this session's synthetic price
  // interpolating back to the real market price over a chosen
  // duration — mild (5 min, gentle) / normal (90s) / hard (15s, a
  // near-immediate snap back). Once progress reaches 1 the scenario
  // is dropped entirely (handled in the tick above) and the session
  // goes back to reading the real feed directly, with nothing layered
  // on top of it anymore.
  function resetSessionScenario(sessionId, level) {
    if (!RESET_DURATIONS[level]) return { error: 'Invalid reset level.' }
    const scenario = sessionScenarios[sessionId]
    if (!scenario) return { error: 'This session has no scenario applied to reset.' }

    setSessionScenarios((prev) => ({
      ...prev,
      [sessionId]: {
        ...scenario,
        reset: {
          level,
          startedAt: new Date().toISOString(),
          durationMs: RESET_DURATIONS[level],
          fromPrices: scenario.prices
        }
      }
    }))
    return { ok: true }
  }

  // Immediately clears a session's scenario with no interpolation —
  // used when a scenario should just stop, not gradually unwind.
  function clearSessionScenario(sessionId) {
    setSessionScenarios((prev) => {
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
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
        if (t.type === 'capped_profit_release') return sum + t.amount
        if (t.type === 'fee') return sum - t.amount
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
    const pendingCappedProfit = transactions
      .filter((t) => t.userId === userId && t.type === 'capped_profit_release' && t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0)
    const outstandingFees = transactions
      .filter((t) => t.userId === userId && t.type === 'fee' && t.feeStatus === 'outstanding')
      .reduce((sum, t) => sum + t.amount, 0)
    return { total, available: total - pending, pending, pendingCappedProfit, outstandingFees }
  }

  // Starts a new trading session for a client at a given tier.
  // Works whether an admin calls it on a client's behalf, or a
  // client starts their own — either way it's checked against real
  // available balance, so a session can never be funded by money
  // that isn't actually there. The session's own `cash` starts equal
  // to `amount`; leverage and duration come straight from the tier.
  function startSession(targetUserId, tierId, amount, durationDays) {
    const tier = getTier(tierId)
    if (!tier || !amount || amount <= 0) return { error: 'Invalid tier or amount.' }

    if (amount < tier.minDeposit) {
      return { error: `${tier.name} requires at least ${formatUsd(tier.minDeposit)} per session.` }
    }
    if (Number.isFinite(tier.maxDeposit) && amount > tier.maxDeposit) {
      return { error: `${tier.name} allows at most ${formatUsd(tier.maxDeposit)} per session.` }
    }

    const { available } = getBalanceBreakdown(targetUserId)
    if (amount > available) return { error: 'Amount exceeds available balance.' }

    // Duration is selectable within the tier's range, same as
    // leverage — pick a preset within bounds, or fall back to the
    // tier's default if nothing was specified.
    const resolvedDuration = clampDuration(tierId, durationDays || tier.durationDays)
    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + resolvedDuration * 24 * 60 * 60 * 1000)

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
    const effectivePrices = getEffectivePricesForSession(session.id)
    return session.cash + session.positions.reduce((sum, p) => sum + positionEquity(p, effectivePrices), 0)
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

  // ADMIN-ONLY: changes a session's total duration, clamped to its
  // tier's allowed range — same pattern as setSessionLeverage.
  // Recomputes expiresAt from the session's original startedAt, so
  // "5 days" always means 5 days from when it actually began, not
  // from whenever the admin happens to make this change.
  function setSessionDuration(sessionId, days) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'active') return { error: 'Session is not active.' }
    if (!days || days <= 0) return { error: 'Enter a duration above zero.' }

    const clamped = clampDuration(session.tierId, days)
    const newExpiresAt = new Date(new Date(session.startedAt).getTime() + clamped * 24 * 60 * 60 * 1000)
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, expiresAt: newExpiresAt.toISOString() } : s)))
    return { days: clamped, expiresAt: newExpiresAt.toISOString() }
  }

  // ADMIN-ONLY: opens a leveraged position scoped to ONE session's own
  // cash — never the client's wider account balance. marginAmount is
  // deducted from the session's cash the moment the position opens;
  // that's the literal enforcement of "can only trade with the exact
  // amount committed to this session."
  function openSessionPosition(sessionId, symbol, marginAmount) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'active') return { error: 'Session is not active.' }
    const price = getEffectivePricesForSession(sessionId)[symbol]
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

    const price = getEffectivePricesForSession(sessionId)[position.symbol]
    const equity = positionEquity(position, getEffectivePricesForSession(sessionId))
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

    const { endValue, rawPnl, payout, excessPending } = computeSessionSettlement(session, getEffectivePricesForSession(sessionId))
    clearSessionScenario(sessionId)

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, status: 'closed', closedAt: new Date().toISOString(), cash: endValue, positions: [], endValue, rawPnl, payout, excessPending, closedReason: 'manual' }
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
      ...(excessPending > 0
        ? [{
            id: `${Date.now()}-excess`,
            userId: session.userId,
            userName: owner?.name,
            type: 'capped_profit_release',
            amount: excessPending,
            date: new Date().toISOString(),
            status: 'pending',
            sessionId
          }]
        : []),
      ...prev
    ])
    notify(
      session.userId,
      payout >= 0 ? 'session_settled_profit' : 'session_settled_loss',
      payout >= 0 ? 'Session closed in profit' : 'Session closed at a loss',
      `Result: ${payout >= 0 ? '+' : ''}${formatUsd(payout)}${payout < rawPnl ? ' (capped by tier)' : ''}.`,
      { sessionId, payout, rawPnl }
    )
    if (excessPending > 0) {
      notify(
        session.userId,
        'capped_profit_pending',
        'Extra profit pending review',
        `This session outperformed its tier cap by ${formatUsd(excessPending)}. That extra amount is held for admin review before it's added to your balance.`,
        { sessionId, excessPending }
      )
    }
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

  // ADMIN-ONLY: charges a client a fee, immediately — this is
  // admin-initiated (like a session settlement or a manual trade),
  // not a client request, so it's auto-approved rather than sitting
  // in the pending queue. Shows up inline with deposits/withdrawals
  // in the client's transaction history as a debit.
  function applyFee(targetUserId, amount, note) {
    if (!amount || amount <= 0) return { error: 'Enter a fee amount above zero.' }

    const owner = users.find((u) => u.id === targetUserId)
    setTransactions((prev) => [
      {
        id: Date.now(),
        userId: targetUserId,
        userName: owner?.name,
        type: 'fee',
        amount,
        note: note || null,
        date: new Date().toISOString(),
        status: 'approved',
        // A fee is immediately real (it debits the balance right
        // away), but stays "outstanding" until the client submits a
        // deposit earmarked specifically to it — see
        // payOutstandingFee(). Only that linked deposit being
        // approved flips this to 'paid'; any other deposit still adds
        // to the balance as normal, but doesn't clear the flag.
        feeStatus: 'outstanding',
        executedByAdminName: currentUser?.name
      },
      ...prev
    ])
    notify(
      targetUserId,
      'fee_charged',
      'Fee charged',
      `A fee of ${formatUsd(amount)} was applied to your account${note ? `: ${note}` : '.'} Deposit that exact amount to clear it.`,
      { amount, note }
    )
    return { ok: true }
  }

  // CLIENT-INITIATED: submits a deposit request for the EXACT amount
  // of one specific outstanding fee, tagged so approving it clears
  // that fee. Goes through the normal pending -> admin-approves flow,
  // same as any deposit — this doesn't bypass approval, it just links
  // the resulting deposit back to the fee it's meant to settle.
  function payOutstandingFee(feeId) {
    const fee = transactions.find((t) => t.id === feeId && t.type === 'fee')
    if (!fee) return { error: 'Fee not found.' }
    if (fee.feeStatus !== 'outstanding') return { error: 'This fee has already been paid.' }
    if (fee.userId !== currentUser?.id) return { error: 'You can only pay your own fees.' }

    setTransactions((prev) => [
      {
        id: Date.now(),
        userId: fee.userId,
        userName: currentUser?.name,
        type: 'deposit',
        amount: fee.amount,
        payingFeeId: fee.id,
        date: new Date().toISOString(),
        status: 'pending'
      },
      ...prev
    ])
    return { ok: true }
  }

  // Every fee still marked outstanding for this user, oldest first —
  // what the Balance page lists so a client can pay each one off
  // individually with its own exact-amount deposit.
  function getOutstandingFees(userId) {
    return transactions
      .filter((t) => t.userId === userId && t.type === 'fee' && t.feeStatus === 'outstanding')
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }

  function approveTransaction(id) {
    const tx = transactions.find((t) => t.id === id)
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === id) return { ...t, status: 'approved' }
        // This deposit was earmarked to pay off a specific fee —
        // approving the deposit is what actually clears it.
        if (tx?.payingFeeId && t.id === tx.payingFeeId) return { ...t, feeStatus: 'paid' }
        return t
      })
    )
    if (tx) {
      if (tx.payingFeeId) {
        notify(
          tx.userId,
          'fee_paid',
          'Fee cleared',
          `Your payment of ${formatUsd(tx.amount)} was approved and the outstanding fee is now cleared.`,
          { transactionId: id, amount: tx.amount, feeId: tx.payingFeeId }
        )
      } else if (tx.type === 'capped_profit_release') {
        notify(
          tx.userId,
          'capped_profit_released',
          'Pending profit released',
          `The extra ${formatUsd(tx.amount)} held above your tier cap was approved and added to your balance.`,
          { transactionId: id, amount: tx.amount }
        )
      } else {
        notify(
          tx.userId,
          tx.type === 'deposit' ? 'deposit_approved' : 'withdrawal_approved',
          tx.type === 'deposit' ? 'Deposit approved' : 'Withdrawal approved',
          `Your ${tx.type} of ${formatUsd(tx.amount)} was approved.`,
          { transactionId: id, amount: tx.amount }
        )
      }
    }
  }

  function rejectTransaction(id) {
    const tx = transactions.find((t) => t.id === id)
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'rejected' } : t))
    )
    if (tx) {
      if (tx.type === 'capped_profit_release') {
        notify(
          tx.userId,
          'balance_update',
          'Pending profit not released',
          `The extra ${formatUsd(tx.amount)} held above your tier cap was not approved for release.`,
          { transactionId: id, amount: tx.amount }
        )
      } else {
        notify(
          tx.userId,
          'balance_update',
          `${tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'} request rejected`,
          `Your ${tx.type} request of ${formatUsd(tx.amount)} was rejected. Contact support if this is unexpected.`,
          { transactionId: id, amount: tx.amount }
        )
      }
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
    priceFeedStatus,
    getRecentRange,
    orders,
    watchlist,
    toggleWatchlist,
    transactions,
    addTransaction,
    applyFee,
    payOutstandingFee,
    getOutstandingFees,
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
    setSessionDuration,
    sessionCurrentValue,
    getSessionsForUser,
    sessionScenarios,
    applySessionScenario,
    resetSessionScenario,
    clearSessionScenario,
    getEffectivePricesForSession,
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