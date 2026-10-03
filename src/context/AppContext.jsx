import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useAudit } from './AuditContext.jsx'
import { useEmail } from './EmailContext.jsx'
import { useSettings } from './SettingsContext.jsx'
import { requestDepositVerification } from '../services/blockchainVerification.js'
import { useNotifications } from './NotificationContext.jsx'
import { getTier, clampLeverage, clampDuration, TIERS } from '../config/tiers.js'
import { fetchRealCryptoPrices } from '../services/coingecko.js'
import { apiRequest, getToken } from '../api/client.js'

const AppContext = createContext(null)

// BTC/ETH now track a real feed (CoinGecko); EUR/GBP stay on the
// original simulated random walk until a forex data source is wired
// up (that one needs a backend — CORS/paid-key territory, unlike
// CoinGecko's keyless public endpoint).
export const REAL_SYMBOLS = ['BTC/USD', 'ETH/USD']
export const SIMULATED_SYMBOLS = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'XAG/USD']
const REAL_PRICE_POLL_MS = 20 * 1000 // 20s — 3 req/min, well under CoinGecko's keyless limit

const STARTING_PRICES = {
  'BTC/USD': 64200,
  'ETH/USD': 3150,
  'EUR/USD': 1.086,
  'GBP/USD': 1.271,
  'XAU/USD': 2380, // Gold, USD per troy ounce
  'XAG/USD': 28.4 // Silver, USD per troy ounce
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
// direction flips which way that gain/loss runs: 'long' profits when
// price rises (the original, still-default behavior), 'short'
// profits when price falls. Equity can go negative if the loss
// exceeds the margin — that's the literal implementation of
// "leverage allows negative balance, no auto-liquidation."
// Exported (not a private helper) specifically so every place that
// needs a position's live P&L — the session settlement math below,
// AND the "Live P&L" table column in AdminTrading/AdminUserDetail —
// calls this one function instead of each re-deriving the formula.
// Two independent copies of a P&L formula is exactly how a short
// position would end up showing an inverted (wrong) live number in
// one place and a correct one in the other.
export function positionEquity(position, currentPrices) {
  const price = currentPrices[position.symbol]
  if (!price) return position.marginAmount
  const directionSign = position.direction === 'short' ? -1 : 1
  const pnl = position.marginAmount * position.leverage * directionSign * ((price - position.entryPrice) / position.entryPrice)
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

// Amount actually owed on a fee RIGHT NOW — the discounted price if a
// discount is currently active (otherwise the full amount), minus
// whatever has already been paid toward it via the pooled Fee Balance
// (see payFeeBalance). Computed fresh from real fields every time —
// amount, discountAmount, discountExpiresAt, amountPaid — nothing
// stores a separate "current owed" number that could drift out of
// sync, so no timer/interval process is needed for the discount, and
// no separate ledger is needed for partial payments.
export function getFeeOwedAmount(fee) {
  // Once a fee has actually been settled (recorded at approval time —
  // see approveTransaction's fee_payment branch), that stays true
  // permanently. Without this check, a fee paid in full while a
  // discount was active would silently become "owed again" the
  // moment that discount's expiresAt passed, because the discount
  // math below would then price it against the full (undiscounted)
  // amount instead of what was actually agreed and paid.
  if (fee.feeStatus === 'paid') return 0
  const base = fee.discountAmount > 0 && fee.discountExpiresAt && new Date(fee.discountExpiresAt) > new Date()
    ? Math.max(0, fee.amount - fee.discountAmount)
    : fee.amount
  return Math.max(0, base - (fee.amountPaid || 0))
}

export function AppProvider({ children }) {
  const { currentUser, users } = useAuth()
  const { logAudit } = useAudit()
  const { sendEmail } = useEmail()
  const { settings } = useSettings()
  const { notify } = useNotifications()
  // useSupport() no longer needed here — appealTransaction now calls
  // the backend directly (see server/README.md Batch 4/5) instead of
  // creating a support case locally via createCase().
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

  const [transactions, setTransactions] = useState([])

  // Admin-defined referral bonus campaigns (e.g. "Christmas Bonus").
  // Real backend now — see server/README.md Batch 8. Bonus PAYOUT
  // itself is no longer computed here at all: the backend pays it
  // automatically the instant a referred user's first deposit is
  // approved (see routes/transactions.js's approve handler), so the
  // old isFirstApprovedDeposit()/payout-creation logic that used to
  // live inside approveTransaction() below is gone, not ported —
  // keeping it would have meant either double-paying bonuses or two
  // copies of "is this really their first deposit" logic that could
  // drift apart.
  const [referralCampaigns, setReferralCampaigns] = useState([])

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

  // Real backend now (see server/README.md) — fetched on load and
  // refetched after any mutating action, rather than kept in sync
  // with localStorage. currentUser comes from AuthContext; an admin
  // gets everyone's transactions (GET /api/transactions), a client
  // gets only their own (GET /api/transactions/mine) — same split as
  // the backend routes themselves.
  const refreshTransactions = useCallback(async () => {
    if (!getToken() || !currentUser) return
    const path = currentUser.role === 'admin' ? '/api/transactions' : '/api/transactions/mine'
    const result = await apiRequest(path)
    if (result.transactions) setTransactions(result.transactions)
  }, [currentUser])

  useEffect(() => { refreshTransactions() }, [refreshTransactions])

  const refreshReferralCampaigns = useCallback(async () => {
    if (!getToken() || currentUser?.role !== 'admin') return
    const result = await apiRequest('/api/referrals/campaigns')
    if (result.campaigns) setReferralCampaigns(result.campaigns)
  }, [currentUser])

  useEffect(() => { refreshReferralCampaigns() }, [refreshReferralCampaigns])

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

        // Tick every session's scenarios independently, AND within a
        // session, tick every symbol's scenario independently of its
        // sibling symbols. sessionScenarios[sessionId] is now a map
        // keyed by symbol, not a single blob — so a session can have
        // BTC/USD biased bullish while EUR/USD in that same session
        // (or with no scenario at all) keeps reading the real feed,
        // and two different symbols can run two different scenarios
        // at once. A symbol not present in a session's map simply
        // isn't touched — it reads the plain `next` prices above.
        const updatedScenarios = {}
        Object.entries(sessionScenariosRef.current).forEach(([sessionId, symbolScenarios]) => {
          const updatedSymbols = {}
          Object.entries(symbolScenarios).forEach(([symbol, scenario]) => {
            if (scenario.reset) {
              const elapsed = Date.now() - new Date(scenario.reset.startedAt).getTime()
              const progress = Math.min(1, Math.max(0, elapsed / scenario.reset.durationMs))
              if (progress >= 1) {
                // Fully settled back to normal — drop this symbol's
                // scenario entirely so it goes back to reading the
                // real global feed directly, nothing layered on top.
                return
              }
              const from = scenario.reset.fromPrice
              const to = next[symbol]
              updatedSymbols[symbol] = { ...scenario, price: from + (to - from) * progress }
            } else {
              const drift = biasToDrift(scenario)
              const volatility = scenario.volatility || 1
              const steps = Math.max(1, Math.min(10, Math.round(scenario.speed || 1)))
              let stepped = scenario.price
              for (let i = 0; i < steps; i++) {
                stepped = randomWalk(stepped, drift, volatility)
              }
              updatedSymbols[symbol] = { ...scenario, price: stepped }
            }
          })
          if (Object.keys(updatedSymbols).length > 0) {
            updatedScenarios[sessionId] = updatedSymbols
          }
        })
        setSessionScenarios(updatedScenarios)

        // Auto-expiry: any active session whose expiresAt has passed
        // gets force-settled here. Each session settles against ITS
        // OWN effective prices — the plain global feed, with each
        // scenario'd symbol's synthetic price substituted in — computed
        // fresh from this same tick, never stale.
        const expired = sessionsRef.current.filter(
          (s) => s.status === 'active' && s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now()
        )
        if (expired.length > 0) {
          expired.forEach((session) => {
            const effectivePrices = { ...next }
            Object.entries(updatedScenarios[session.id] || {}).forEach(([symbol, scenario]) => {
              effectivePrices[symbol] = scenario.price
            })
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
                status: 'pending',
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
              `Your session timer ran out. Result: ${payout >= 0 ? '+' : ''}$${payout.toFixed(2)} — pending admin certification before it's added to your balance.`,
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
    const symbolScenarios = sessionScenarios[sessionId]
    if (!symbolScenarios || Object.keys(symbolScenarios).length === 0) return prices
    const effective = { ...prices }
    Object.entries(symbolScenarios).forEach(([symbol, scenario]) => {
      effective[symbol] = scenario.price
    })
    return effective
  }

  const RESET_DURATIONS = { mild: 5 * 60 * 1000, normal: 90 * 1000, hard: 15 * 1000 }
  const SCENARIO_MODES = ['neutral', 'bullish', 'bearish']

  // ADMIN-ONLY, demo tool. Applies (or updates) a bias to exactly ONE
  // symbol within ONE session — every other symbol, in this session
  // or any other, keeps reading the real, unbiased global price feed
  // unless it has its own separate scenario applied. This is what
  // makes "BTC/USD bullish while EUR/USD bearish, same session, same
  // time" possible: each symbol's synthetic price is tracked and
  // ticked independently (see sessionScenarios[sessionId][symbol]).
  //   mode/strength: which way this symbol's synthetic price leans, how hard
  //   volatility: how big each swing is
  //   speed: how many steps compound per tick (visibly faster motion)
  function applySessionScenario(sessionId, symbol, mode, strength = 1, volatility = 1, speed = 1) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'active') return { error: 'Session is not active.' }
    if (!SCENARIO_MODES.includes(mode)) return { error: 'Invalid scenario mode.' }
    if (!prices[symbol]) return { error: 'Unknown symbol.' }

    const existing = sessionScenarios[sessionId]?.[symbol]
    // Continuation, not a jump: if this symbol already has a
    // synthetic price running, keep it as the starting point for the
    // new settings. Otherwise seed from wherever the real market is.
    const seedPrice = existing?.price ?? prices[symbol]

    setSessionScenarios((prev) => ({
      ...prev,
      [sessionId]: {
        ...(prev[sessionId] || {}),
        [symbol]: {
          mode,
          strength: Math.min(3, Math.max(1, Math.round(strength))),
          volatility: Math.min(3, Math.max(1, Math.round(volatility))),
          speed: Math.min(10, Math.max(1, Math.round(speed))),
          appliedAt: new Date().toISOString(),
          price: seedPrice,
          reset: null
        }
      }
    }))
    return { ok: true }
  }

  // ADMIN-ONLY, demo tool. Starts one symbol's synthetic price
  // interpolating back to the real market price over a chosen
  // duration — mild (5 min, gentle) / normal (90s) / hard (15s, a
  // near-immediate snap back). Once progress reaches 1 that symbol's
  // scenario is dropped entirely (handled in the tick above) and it
  // goes back to reading the real feed directly. Other symbols in the
  // same session, if they have their own scenarios, are untouched.
  function resetSessionScenario(sessionId, symbol, level) {
    if (!RESET_DURATIONS[level]) return { error: 'Invalid reset level.' }
    const scenario = sessionScenarios[sessionId]?.[symbol]
    if (!scenario) return { error: 'This symbol has no scenario applied to reset.' }

    setSessionScenarios((prev) => ({
      ...prev,
      [sessionId]: {
        ...prev[sessionId],
        [symbol]: {
          ...scenario,
          reset: {
            level,
            startedAt: new Date().toISOString(),
            durationMs: RESET_DURATIONS[level],
            fromPrice: scenario.price
          }
        }
      }
    }))
    return { ok: true }
  }

  // Convenience for "reset everything on this session" — same effect
  // as calling resetSessionScenario once per symbol currently active.
  function resetAllSessionScenarios(sessionId, level) {
    const symbolScenarios = sessionScenarios[sessionId]
    if (!symbolScenarios || Object.keys(symbolScenarios).length === 0) return { error: 'No scenarios on this session.' }
    Object.keys(symbolScenarios).forEach((symbol) => resetSessionScenario(sessionId, symbol, level))
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
  //
  // A fee never subtracts from the main balance, whether it's
  // outstanding or fully paid — its "cost" isn't taken out of money
  // the client already had, it's covered by fresh money they
  // specifically deposit toward the Fee Balance (see payFeeBalance).
  // That means a fee_payment transaction doesn't add to the main
  // balance either — it's fully absorbed into the fee's amountPaid
  // bookkeeping. Only genuine EXCESS beyond what was owed spills over
  // as its own real 'deposit' transaction (created at approval time),
  // which does add here like any other deposit. Net effect: paying a
  // fee exactly leaves the main balance unchanged; overpaying credits
  // the difference; nothing about a fee ever appears as a debit here.
  // Grants a one-time signup bonus, as a real transaction, to every
  // real (non-demo) client who doesn't have one yet — fires whenever
  // the roster changes (i.e. right after a signup) or when an admin
  // turns the toggle on, so it also catches anyone who signed up
  // while it was off. Idempotent by construction: it checks for an
  // existing signup_bonus transaction before creating one, so this
  // can safely re-run on every render without ever double-granting.
  // Deliberately NOT an editable balance field or an unlimited
  // faucet — one grant per real client, admin-capped amount, exactly
  // the same shape as the existing referral bonus.
  useEffect(() => {
    if (!settings.signupBonusEnabled || !settings.signupBonusAmount || settings.signupBonusAmount <= 0) return
    const ungranted = users.filter(
      (u) => u.role !== 'admin' && !u.isDemoGenerated &&
        !transactions.some((t) => t.userId === u.id && t.type === 'signup_bonus')
    )
    if (ungranted.length === 0) return
    setTransactions((prev) => [
      ...ungranted.map((u) => ({
        id: Date.now() + Math.random(),
        userId: u.id,
        userName: u.name,
        type: 'signup_bonus',
        amount: settings.signupBonusAmount,
        note: 'Signup bonus',
        date: new Date().toISOString(),
        status: 'approved'
      })),
      ...prev
    ])
    ungranted.forEach((u) => {
      logAudit({
        action: 'signup_bonus_granted',
        actor: null,
        targetUserId: u.id,
        targetUserName: u.name,
        details: { amount: settings.signupBonusAmount }
      })
    })
  }, [users, transactions, settings.signupBonusEnabled, settings.signupBonusAmount])

  function getAccountBalance(userId) {
    return transactions
      .filter((t) => t.userId === userId && t.status === 'approved')
      .reduce((sum, t) => {
        if (t.type === 'deposit') return sum + t.amount
        if (t.type === 'withdrawal') return sum - t.amount
        if (t.type === 'session_settlement') return sum + t.amount
        if (t.type === 'capped_profit_release') return sum + t.amount
        if (t.type === 'referral_bonus') return sum + t.amount
        if (t.type === 'signup_bonus') return sum + t.amount
        return sum
      }, 0)
  }

  // total = real (certified) balance. pending = capital currently
  // locked in active sessions. sessionBalance = money from CLOSED
  // sessions/trades that's real and computed, but not yet certified
  // by an admin — it sits outside `total` until certifyTransaction()
  // moves it over, same mechanism for a profit or a loss. available
  // is what a client can actually withdraw or commit to a new
  // session — deliberately does NOT include sessionBalance, since
  // that money isn't confirmed yet.
  function getBalanceBreakdown(userId) {
    const total = getAccountBalance(userId)
    const pending = sessions
      .filter((s) => s.userId === userId && (s.status === 'active' || s.status === 'awaiting_start'))
      .reduce((sum, s) => sum + s.amount, 0)
    const pendingSessionSettlements = transactions
      .filter((t) => t.userId === userId && t.type === 'session_settlement' && t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0)
    const pendingCappedProfit = transactions
      .filter((t) => t.userId === userId && t.type === 'capped_profit_release' && t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0)
    const sessionBalance = pendingSessionSettlements + pendingCappedProfit
    const outstandingFees = transactions
      .filter((t) => t.userId === userId && t.type === 'fee' && t.feeStatus === 'outstanding')
      .reduce((sum, t) => sum + getFeeOwedAmount(t), 0)
    return { total, available: total - pending, pending, pendingSessionSettlements, pendingCappedProfit, sessionBalance, outstandingFees }
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

    // Managed mode only applies when the client is committing to
    // their own session — an admin starting one on a client's behalf
    // (from AdminUserDetail) always goes straight to active, since
    // the admin IS the human sign-off this mode exists to require.
    const isManaged = settings.investmentMode === 'managed' && currentUser?.id === targetUserId
    const committedAt = new Date()
    const startedAt = isManaged ? null : committedAt
    const expiresAt = isManaged ? null : new Date(startedAt.getTime() + resolvedDuration * 24 * 60 * 60 * 1000)

    const session = {
      id: Date.now(),
      userId: targetUserId,
      tierId,
      amount,
      durationDays: resolvedDuration,
      leverage: tier.defaultLeverage,
      cash: amount,
      positions: [],
      committedAt: committedAt.toISOString(),
      startedAt: startedAt ? startedAt.toISOString() : null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      status: isManaged ? 'awaiting_start' : 'active',
      closedAt: null,
      closedReason: null,
      endValue: null,
      rawPnl: null,
      payout: null,
      initiatedByName: currentUser?.name,
      initiatedBySelf: currentUser?.id === targetUserId
    }
    setSessions((prev) => [session, ...prev])

    if (isManaged) {
      logAudit({
        action: 'session_committed_awaiting_start',
        actor: currentUser,
        targetUserId,
        targetUserName: currentUser?.name,
        details: { tierId, amount }
      })
      notify(
        targetUserId,
        'session_awaiting_start',
        'Investment committed — awaiting start',
        `Your ${formatUsd(amount)} commitment to ${tier.name} is reserved and no longer available, but the session won't begin until your account manager starts it.`,
        { tierId, amount }
      )
    }

    return { session }
  }

  // ADMIN-ONLY: begins a session that a client committed to under
  // Managed investment mode — starts the timer now, for the
  // duration the client originally chose. This is the "admin says
  // so" step: funds were already moved out of the client's main
  // balance the moment they committed, this just starts the clock.
  // Cancels a commitment that's still awaiting admin start — the
  // committed amount was never touched otherwise (managed mode
  // doesn't create any transaction, it just marks the session's
  // status), so canceling is simply flipping status to 'cancelled'.
  // getBalanceBreakdown's `pending` calc only counts 'active' and
  // 'awaiting_start' sessions, so a cancelled one immediately stops
  // being held and the amount is available again — no refund
  // transaction needed since nothing was ever debited in the first
  // place, only reserved.
  function cancelAwaitingSession(sessionId) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'awaiting_start') return { error: 'Session is not awaiting start.' }

    setSessions((prev) => prev.map((s) => (
      s.id === sessionId ? { ...s, status: 'cancelled', closedAt: new Date().toISOString() } : s
    )))

    const owner = users.find((u) => u.id === session.userId)
    logAudit({
      action: 'session_commitment_cancelled',
      actor: currentUser,
      targetUserId: session.userId,
      targetUserName: owner?.name,
      details: { sessionId, amount: session.amount }
    })
    if (currentUser?.role === 'admin' && currentUser.id !== session.userId) {
      notify(
        session.userId,
        'session_cancelled',
        'Investment commitment cancelled',
        `Your ${formatUsd(session.amount)} commitment was cancelled by your account manager and is available again.`,
        { sessionId }
      )
    }
    return { ok: true }
  }

  function beginAwaitingSession(sessionId) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'awaiting_start') return { error: 'Session is not awaiting start.' }

    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + session.durationDays * 24 * 60 * 60 * 1000)
    setSessions((prev) => prev.map((s) => (
      s.id === sessionId ? { ...s, status: 'active', startedAt: startedAt.toISOString(), expiresAt: expiresAt.toISOString() } : s
    )))

    const owner = users.find((u) => u.id === session.userId)
    logAudit({
      action: 'session_started_by_admin',
      actor: currentUser,
      targetUserId: session.userId,
      targetUserName: owner?.name,
      details: { sessionId, amount: session.amount }
    })
    notify(
      session.userId,
      'session_started',
      'Your investment has started',
      `Your ${formatUsd(session.amount)} commitment is now active and running for ${session.durationDays} day${session.durationDays === 1 ? '' : 's'}.`,
      { sessionId }
    )
    return { ok: true }
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
    const owner = users.find((u) => u.id === session.userId)
    logAudit({
      action: 'session_leverage_changed',
      actor: currentUser,
      targetUserId: session.userId,
      targetUserName: owner?.name,
      details: { sessionId, previousLeverage: session.leverage, newLeverage: clamped }
    })
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
    const owner = users.find((u) => u.id === session.userId)
    logAudit({
      action: 'session_duration_changed',
      actor: currentUser,
      targetUserId: session.userId,
      targetUserName: owner?.name,
      details: { sessionId, previousExpiresAt: session.expiresAt, newDurationDays: clamped, newExpiresAt: newExpiresAt.toISOString() }
    })
    return { days: clamped, expiresAt: newExpiresAt.toISOString() }
  }

  // ADMIN-ONLY: opens a leveraged position scoped to ONE session's own
  // cash — never the client's wider account balance. marginAmount is
  // deducted from the session's cash the moment the position opens;
  // that's the literal enforcement of "can only trade with the exact
  // amount committed to this session."
  function openSessionPosition(sessionId, symbol, marginAmount, direction = 'long') {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'active') return { error: 'Session is not active.' }
    const price = getEffectivePricesForSession(sessionId)[symbol]
    if (!price || !marginAmount || marginAmount <= 0) return { error: 'Invalid symbol or margin amount.' }
    if (marginAmount > session.cash) return { error: 'Exceeds this session\u2019s available cash.' }
    if (direction !== 'long' && direction !== 'short') return { error: 'Invalid direction.' }

    const position = {
      id: Date.now(),
      symbol,
      direction,
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
    logSessionAction(session.userId, sessionId, 'open_position', symbol, marginAmount, session.leverage, price, null, direction)
    const owner = users.find((u) => u.id === session.userId)
    logAudit({
      action: 'session_position_opened',
      actor: currentUser,
      targetUserId: session.userId,
      targetUserName: owner?.name,
      details: { sessionId, symbol, direction, marginAmount, leverage: session.leverage, entryPrice: price }
    })
    notify(
      session.userId,
      'trade_opened',
      'Trade opened',
      `${symbol} ${direction === 'short' ? 'short' : 'long'} position opened — ${formatUsd(marginAmount)} margin at ${session.leverage}x.`,
      { sessionId, symbol, direction, marginAmount, leverage: session.leverage }
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
    logSessionAction(session.userId, sessionId, 'close_position', position.symbol, position.marginAmount, position.leverage, price, pnl, position.direction || 'long')
    const owner = users.find((u) => u.id === session.userId)
    logAudit({
      action: 'session_position_closed',
      actor: currentUser,
      targetUserId: session.userId,
      targetUserName: owner?.name,
      details: { sessionId, symbol: position.symbol, direction: position.direction || 'long', marginAmount: position.marginAmount, leverage: position.leverage, exitPrice: price, pnl }
    })
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
  function logSessionAction(targetUserId, sessionId, type, symbol, marginAmount, leverage, price, pnl, direction = 'long') {
    setOrders((prev) => [
      {
        id: Date.now(),
        userId: targetUserId,
        sessionId,
        executedByAdminId: currentUser?.id,
        executedByAdminName: currentUser?.name,
        type,
        symbol,
        direction,
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
        status: 'pending',
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
      `Result: ${payout >= 0 ? '+' : ''}${formatUsd(payout)}${payout < rawPnl ? ' (capped by tier)' : ''} — pending admin certification before it's added to your balance.`,
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

  // ADMIN-ONLY, demo tool. Builds real deposit + session records for a
  // batch of accounts in one shot. This deliberately does NOT call
  // startSession/openSessionPosition/closeSession in a loop — those
  // read from React state, so back-to-back calls in one synchronous
  // pass would all see the same stale `sessions` snapshot. Instead
  // this constructs the records directly and commits them in one
  // batch — but every closed session's payout still comes from the
  // real, shared computeSessionSettlement() function run against a
  // real current price and a randomized (but genuine) exit price, not
  // a number typed in. A generated account is functionally
  // indistinguishable from a real one once created; it's just
  // pre-populated instead of starting empty.
  function generateDemoActivity(userIds, opts = {}) {
    const {
      minDeposit = 300,
      maxDeposit = 8000,
      minSessionsPerUser = 1,
      maxSessionsPerUser = 3,
      closedRatio = 0.7 // fraction of generated sessions settled vs left active
    } = opts

    const rand = (min, max) => min + Math.random() * (max - min)
    function pickTier() {
      const roll = Math.random()
      if (roll < 0.6) return TIERS[0]
      if (roll < 0.9) return TIERS[1]
      return TIERS[2]
    }

    let idCounter = Date.now()
    const nextId = () => idCounter++

    const newTransactions = []
    const newSessions = []
    const newOrders = []
    const symbols = Object.keys(prices)

    userIds.forEach((userId) => {
      const owner = users.find((u) => u.id === userId)
      const joinedAt = owner ? new Date(owner.createdAt) : new Date()

      // Real deposit, backdated close to signup so it reads as a
      // genuinely funded account rather than something created today.
      const depositAmount = Math.round(rand(minDeposit, maxDeposit))
      const depositDate = new Date(joinedAt.getTime() + rand(0, 2) * 24 * 60 * 60 * 1000)
      newTransactions.push({
        id: nextId(),
        userId,
        userName: owner?.name,
        type: 'deposit',
        amount: depositAmount,
        date: depositDate.toISOString(),
        status: 'approved'
      })

      let availableCash = depositAmount
      const sessionCount = Math.round(rand(minSessionsPerUser, maxSessionsPerUser))

      for (let i = 0; i < sessionCount; i++) {
        const tier = pickTier()
        const cap = Math.min(tier.maxDeposit, availableCash)
        if (cap < tier.minDeposit) continue // not enough left to fund this tier's floor

        const sessionAmount = Math.round(rand(tier.minDeposit, cap))
        const leverage = clampLeverage(tier.id, tier.defaultLeverage)
        const durationDays = clampDuration(tier.id, tier.durationDays)
        const startedAt = new Date(depositDate.getTime() + i * 6 * 60 * 60 * 1000)
        const expiresAt = new Date(startedAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
        const willClose = Math.random() < closedRatio
        const sessionId = nextId()

        // 1-2 synthetic positions, entered at a REAL current price —
        // the price relationship is genuine even though the position
        // itself is synthetic.
        let cash = sessionAmount
        const positions = []
        const positionCount = Math.random() < 0.6 ? 1 : 2
        for (let p = 0; p < positionCount; p++) {
          const symbol = symbols[Math.floor(Math.random() * symbols.length)]
          const marginAmount = Math.round(rand(cash * 0.2, cash * 0.6))
          if (marginAmount <= 0 || marginAmount > cash) continue
          cash -= marginAmount
          const direction = Math.random() < 0.7 ? 'long' : 'short' // long-biased, same as real client behavior tends to skew
          const position = { id: nextId(), symbol, direction, entryPrice: prices[symbol], marginAmount, leverage, openedAt: startedAt.toISOString() }
          positions.push(position)
          newOrders.push({
            id: nextId(), userId, sessionId, executedByAdminId: currentUser?.id, executedByAdminName: currentUser?.name,
            type: 'open_position', symbol, direction, marginAmount, leverage, price: prices[symbol], pnl: null, date: startedAt.toISOString()
          })
        }

        if (willClose) {
          // A plausible exit price for each position — still random,
          // slightly positive-skewed like the real feed's drift, then
          // run through the exact same settlement function every real
          // session uses. The payout is genuinely computed here, not
          // set directly.
          const exitPrices = {}
          positions.forEach((pos) => { exitPrices[pos.symbol] = pos.entryPrice * (1 + (Math.random() - 0.45) * 0.08) })
          const { endValue, rawPnl, payout, excessPending } = computeSessionSettlement(
            { tierId: tier.id, amount: sessionAmount, cash, positions },
            exitPrices
          )
          const closedAt = new Date(Math.min(expiresAt.getTime(), Date.now()) - rand(0, 6) * 60 * 60 * 1000)

          newSessions.push({
            id: sessionId, userId, tierId: tier.id, amount: sessionAmount, leverage, cash: endValue, positions: [],
            startedAt: startedAt.toISOString(), expiresAt: expiresAt.toISOString(), status: 'closed',
            closedAt: closedAt.toISOString(), closedReason: 'auto_expiry', endValue, rawPnl, payout, excessPending,
            initiatedByName: currentUser?.name, initiatedBySelf: false
          })
          newTransactions.push({
            id: nextId(), userId, userName: owner?.name, type: 'session_settlement', amount: payout,
            date: closedAt.toISOString(), status: 'approved', sessionId, closedReason: 'auto_expiry'
          })
          if (excessPending > 0) {
            newTransactions.push({
              id: nextId(), userId, userName: owner?.name, type: 'capped_profit_release',
              amount: excessPending, date: closedAt.toISOString(), status: 'pending', sessionId
            })
          }
          availableCash = availableCash - sessionAmount + payout
        } else {
          newSessions.push({
            id: sessionId, userId, tierId: tier.id, amount: sessionAmount, leverage, cash, positions,
            startedAt: startedAt.toISOString(), expiresAt: expiresAt.toISOString(), status: 'active',
            closedAt: null, closedReason: null, endValue: null, rawPnl: null, payout: null,
            initiatedByName: currentUser?.name, initiatedBySelf: false
          })
          availableCash -= sessionAmount
        }
      }
    })

    setTransactions((prev) => [...newTransactions, ...prev])
    setSessions((prev) => [...newSessions, ...prev])
    setOrders((prev) => [...newOrders, ...prev])

    return {
      usersGenerated: userIds.length,
      totalDeposited: newTransactions.filter((t) => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
      sessionsCreated: newSessions.length,
      sessionsClosed: newSessions.filter((s) => s.status === 'closed').length
    }
  }

  // Cleanup counterpart to generateDemoActivity — strips
  // transactions/sessions/orders belonging to the given user ids. Only
  // ever called with ids AuthContext.removeDemoClients() already
  // confirmed were isDemoGenerated, so real client data is never at risk.
  function purgeDataForUsers(userIds) {
    const idSet = new Set(userIds)
    setTransactions((prev) => prev.filter((t) => !idSet.has(t.userId)))
    setSessions((prev) => prev.filter((s) => !idSet.has(s.userId)))
    setOrders((prev) => prev.filter((o) => !idSet.has(o.userId)))
  }

  // Client-initiated only — always targets currentUser, never called
  // on someone else's behalf (admin actions use their own dedicated
  // functions like applyFee). That makes this the one correct place
  // to gate a withdrawal on KYC status: nothing admin-initiated ever
  // passes through here, so this can never accidentally block a
  // legitimate admin action.
  async function addTransaction(type, amount, details = {}) {
    if (type === 'withdrawal' && (settings.kycEnabled || currentUser?.kycRequired) && currentUser?.kyc?.status !== 'verified') {
      return { error: 'Identity verification is required before you can withdraw. Submit your document on the Verification page.' }
    }
    // A fee locks withdrawals until it's cleared — deliberately
    // checked against getOutstandingFees (owed > 0), not a boolean
    // flag, so a partial Fee Balance payment doesn't quietly unlock
    // things early: it stays locked until the full amount is paid.
    // NOTE: this and the KYC check above are client-side UX only —
    // the backend's POST /api/transactions doesn't independently
    // enforce either yet, so a technically savvy client could still
    // bypass them by calling the API directly. Same category of gap
    // as the original security discussion; worth a hardening pass
    // before this handles real money.
    if (type === 'withdrawal' && getOutstandingFees(currentUser?.id).length > 0) {
      return { error: 'You have an outstanding fee. Clear it from your Fee Balance before withdrawing.' }
    }
    if (type === 'withdrawal') {
      const { withdrawalMethod, destinationAddress } = details
      if (!withdrawalMethod || !settings.withdrawalMethods[withdrawalMethod]) {
        return { error: 'Choose a withdrawal method.' }
      }
      if (withdrawalMethod === 'bank' && currentUser?.kycEnhanced?.status !== 'verified') {
        return { error: 'Bank withdrawal requires enhanced verification. Submit it on the Verification page.' }
      }
      if ((withdrawalMethod === 'usdt' || withdrawalMethod === 'btc') && !destinationAddress?.trim()) {
        return { error: 'Enter the wallet address to send funds to.' }
      }
    }
    if (type === 'deposit') {
      const { depositMethod } = details
      if (!depositMethod || !settings.depositMethods[depositMethod]) {
        return { error: 'Choose a deposit method.' }
      }
    }

    // The blockchain-verification-stub check stays purely client-side
    // — it's an honest "not really connected" placeholder (see
    // services/blockchainVerification.js), and the backend has no
    // column to persist it to. Shown as immediate feedback only; not
    // sent to the server, not part of the stored record.
    let verification = null
    if (type === 'deposit' && details.depositMethod !== 'bank') {
      verification = settings.blockchainVerificationEnabled
        ? requestDepositVerification({ method: details.depositMethod, chain: details.depositChain, amount })
        : { status: 'manual', reason: null }
    }

    // destinationAddress is deliberately NOT sent/stored per
    // transaction — per the wallet-binding architecture, a crypto
    // withdrawal's destination is always the client's one bound
    // wallet address (see AuthContext's bindWallet), never a
    // free-typed value re-entered per withdrawal. Anywhere the UI
    // needs to show "sent to", it should read currentUser.boundWallet
    // .address rather than a per-transaction field.
    const body = type === 'withdrawal'
      ? { type, amount, method: details.withdrawalMethod, chain: details.withdrawalChain || null }
      : { type, amount, method: details.depositMethod, chain: details.depositChain || null, note: details.depositReference?.trim() || undefined }

    const result = await apiRequest('/api/transactions', { method: 'POST', body })
    if (result.error) return { error: result.error }
    await refreshTransactions()
    return { ok: true, verification }
  }

  // ADMIN-ONLY: charges a client a fee, immediately — this is
  // admin-initiated (like a session settlement or a manual trade),
  // not a client request, so it's auto-approved rather than sitting
  // in the pending queue. Shows up inline with deposits/withdrawals
  // in the client's transaction history as a debit.
  // `discount`, if provided, is { discountAmount, durationHours } — a
  // time-limited price cut on this specific fee. Nothing about the
  // "invoice until paid" rule changes: the fee still doesn't touch
  // the balance until paid, this only affects what "paid in full"
  // means while the discount window is open.
  // linkedSessionId ties this fee to a specific capped session's
  // pending excess profit — once a fee linked this way is fully
  // paid, that session's capped_profit_release becomes approvable
  // for the FULL amount, not just the tier-capped portion. See
  // isSessionUnlocked() and approveTransaction()'s guard below.
  async function applyFee(targetUserId, amount, note, discount, linkedSessionId = null) {
    if (!amount || amount <= 0) return { error: 'Enter a fee amount above zero.' }
    if (discount?.discountAmount > 0) {
      if (discount.discountAmount >= amount) return { error: 'Discount must be less than the fee amount.' }
      if (!discount.durationHours || discount.durationHours <= 0) return { error: 'Enter how long the discount should last.' }
    }
    // Audit logging and the client notification both now happen
    // server-side (routes/fees.js's POST / and utils/notifications.js)
    // — removed here rather than kept as a second copy that could
    // say something slightly different from what the backend logs.
    const result = await apiRequest('/api/fees', {
      method: 'POST',
      body: {
        targetUserId,
        amount,
        note: note || undefined,
        discountAmount: discount?.discountAmount > 0 ? discount.discountAmount : undefined,
        durationHours: discount?.discountAmount > 0 ? discount.durationHours : undefined,
        linkedSessionId: linkedSessionId || undefined
      }
    })
    if (result.error) return { error: result.error }
    await refreshTransactions()
    return { ok: true }
  }

  // Whether a capped session's excess profit is clear to release —
  // true when at least one fee tied to this session (via
  // linkedSessionId) has been fully paid. A session with no linked
  // fee at all is simply never unlockable this way; the tier-capped
  // amount can still be certified normally, just not the excess.
  function isSessionUnlocked(sessionId) {
    return transactions.some((t) => t.type === 'fee' && t.linkedSessionId === sessionId && t.feeStatus === 'paid')
  }

  // ADMIN-ONLY: adds a time-limited discount to a fee that's already
  // outstanding. utils/fees.js's feeOwedAmount() on the backend checks
  // the expiry fresh every time it's read, so there's no background
  // timer process; the discount simply stops applying once real time
  // passes discountExpiresAt.
  async function applyDiscountToFee(feeId, discountAmount, durationHours) {
    const fee = transactions.find((t) => t.id === feeId && t.type === 'fee')
    if (!fee) return { error: 'Fee not found.' }
    if (fee.feeStatus !== 'outstanding') return { error: 'Only an outstanding fee can be discounted.' }
    if (!discountAmount || discountAmount <= 0) return { error: 'Enter a discount amount above zero.' }
    if (discountAmount >= fee.amount) return { error: 'Discount must be less than the fee amount.' }
    if (!durationHours || durationHours <= 0) return { error: 'Enter how long the discount should last.' }

    const result = await apiRequest(`/api/fees/${feeId}/discount`, { method: 'POST', body: { discountAmount, durationHours } })
    if (result.error) return { error: result.error }
    await refreshTransactions()
    return { ok: true }
  }

  // CLIENT-INITIATED: deposits ANY amount toward the Fee Balance — the
  // pooled total of everything currently owed across all outstanding
  // fees (oldest first). This replaces the old "pay this exact fee"
  // model entirely:
  //   - If the amount covers less than the full pool, it's absorbed
  //     entirely into reducing what's owed (oldest fees first) — the
  //     remainder stays outstanding for whatever's left.
  //   - If it covers the whole pool with some left over, that excess
  //     "spills" into a real, separate deposit that credits the main
  //     balance — genuine new money that wasn't needed to cover fees.
  // Allocation is computed and locked in HERE, at submission time —
  // not recalculated later at approval — so a fee charged in between
  // can't eat into money the client already committed, and a discount
  // expiring in the meantime can't retroactively change what was owed
  // when they acted.
  // Shared by payFeeBalance (initial request) and correctTransactionAmount
  // (re-running this same math when an admin fixes the actual amount
  // received) — one allocation algorithm, never two copies that could
  // drift apart from each other.
  // Allocation logic moved server-side — see utils/fees.js on the
  // backend (payFeeBalance and correctTransactionAmount below both
  // used to share this local copy; both now call the backend, which
  // has its own single shared allocateAgainstOutstandingFees()).

  async function payFeeBalance(amount, meta = {}) {
    if (!amount || amount <= 0) return { error: 'Enter an amount above zero.' }
    const fees = getOutstandingFees(currentUser?.id)
    if (fees.length === 0) return { error: 'No outstanding fees to pay.' }

    // Allocation against outstanding fees (oldest first) is now
    // computed and locked in SERVER-SIDE, at submission time (see
    // utils/fees.js's allocateAgainstOutstandingFees on the backend)
    // — the old client-side copy of this logic is gone, not kept as
    // a preview, since a client-computed allocation could disagree
    // with what the server actually applies once approved.
    const result = await apiRequest('/api/fees/pay', {
      method: 'POST',
      body: { amount, method: meta.depositMethod || undefined, chain: meta.depositChain || undefined, note: meta.depositReference || undefined }
    })
    if (result.error) return { error: result.error }
    await refreshTransactions()
    return { ok: true, amount, spilloverAmount: result.transaction?.spilloverAmount }
  }

  // Every fee still marked outstanding for this user, oldest first —
  // this ordering is what the backend's allocation follows (oldest
  // debt gets covered first), and what the Balance page lists so a
  // client can see exactly what makes up their Fee Balance. Stays a
  // pure local filter — `transactions` already holds real fee data.
  function getOutstandingFees(userId) {
    return transactions
      .filter((t) => t.userId === userId && t.type === 'fee' && getFeeOwedAmount(t) > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }

  // Hard-deleting a transaction record has no backend endpoint, on
  // purpose — it directly contradicts the project's own "balances
  // calculated from transaction records, never hand-edited" guarantee
  // (see principles-and-architecture). Erasing a real record, even
  // with an audit trail of what was erased, retroactively changes
  // every balance calculation that summed over it with no trace left
  // in the actual data. The real-world equivalent — a reversing
  // entry that keeps both the original and the correction visible —
  // is a genuine feature worth building, just not the same thing as
  // this function did, so it's disabled rather than quietly wired to
  // something unsafe or silently dropped.
  async function deleteTransaction(transactionId, reason) {
    return { error: 'Deleting transaction records isn\'t available — it would break balance history. If this was created in error, ask your admin about a reversing entry instead.' }
  }

  // ADMIN-ONLY: creates a referral bonus campaign — a bounded window
  // (start/end date) during which a referrer earns `bonusAmount` the
  // instant someone they referred makes their first approved deposit.
  // Multiple campaigns can exist for history; only ones marked
  // `active` AND currently inside their own date window ever pay out
  // (see getActiveReferralCampaign) — ended campaigns just stay as a
  // record, never deleted out from under past bonuses.
  async function createReferralCampaign({ name, bonusAmount, startDate, endDate, note }) {
    if (!name?.trim()) return { error: 'Give the campaign a name.' }
    if (!bonusAmount || bonusAmount <= 0) return { error: 'Enter a bonus amount above zero.' }
    if (!startDate || !endDate) return { error: 'Set a start and end date.' }
    if (new Date(endDate) < new Date(startDate)) return { error: 'End date must be on or after the start date.' }

    // Audit logging now happens server-side (routes/referrals.js) —
    // removed here rather than kept as a second copy.
    const result = await apiRequest('/api/referrals/campaigns', {
      method: 'POST',
      body: { name: name.trim(), bonusAmount, startDate, endDate, note: note?.trim() || undefined }
    })
    if (result.error) return { error: result.error }
    await refreshReferralCampaigns()
    return { campaign: result.campaign }
  }

  // Admin can edit a campaign's terms (e.g. extend the end date,
  // adjust the bonus) — existing bonuses already paid out under the
  // old terms are untouched, since they're already-recorded
  // transactions, not something this recalculates retroactively.
  async function updateReferralCampaign(id, updates) {
    const result = await apiRequest(`/api/referrals/campaigns/${id}`, { method: 'PATCH', body: updates })
    if (result.error) return { error: result.error }
    await refreshReferralCampaigns()
    return { ok: true }
  }

  // Toggle a campaign on/off without deleting it — an admin might
  // want to pause a campaign early, or reactivate a past one.
  async function setCampaignActive(id, active) {
    const result = await apiRequest(`/api/referrals/campaigns/${id}/active`, { method: 'POST', body: { active } })
    if (result.error) return { error: result.error }
    await refreshReferralCampaigns()
    return { ok: true }
  }

  // The campaign (if any) actually live right now — `active` AND
  // today's date inside [startDate, endDate]. Referral bonuses only
  // ever check against this; everything else is just history the
  // admin can look back on. Stays a pure local check over
  // already-fetched referralCampaigns.
  function getActiveReferralCampaign() {
    const now = new Date()
    return (
      referralCampaigns.find(
        (c) => c.active && new Date(c.startDate) <= now && now <= new Date(c.endDate + 'T23:59:59')
      ) || null
    )
  }

  // Real stats (count + totalPaid), computed server-side from actual
  // referral_bonus transactions — routes/referrals.js's GET /campaigns
  // already attaches `.stats` to every campaign it returns. Reading
  // it here instead of recomputing locally (and instead of the old
  // `t.campaignId` field, which was never how the backend actually
  // stores it — see details.campaignId in sql/011_referrals.sql)
  // means there's exactly one place this math lives.
  function getCampaignStats(campaignId) {
    const campaign = referralCampaigns.find((c) => c.id === campaignId)
    return campaign?.stats || { count: 0, totalPaid: 0 }
  }

  // isFirstApprovedDeposit() and the referral-bonus-creation logic
  // that used to live inside approveTransaction() are both gone —
  // the backend pays referral bonuses automatically the instant a
  // referred user's first deposit is approved (see
  // routes/transactions.js), so this frontend copy would either
  // double-pay or need to somehow avoid racing the server's own
  // check. One place for this logic, and it's the backend now.

  // Collapses to one call now — the backend's POST
  // /api/transactions/:id/approve already handles everything this
  // used to do by hand: applying fee_payment allocations, crediting
  // genuine spillover as a real deposit, paying out a referral bonus
  // on a qualifying first deposit, and sending the client's
  // notification. Keeping any of that logic here risked it disagreeing
  // with what the server actually does once approved.
  async function approveTransaction(id) {
    const tx = transactions.find((t) => t.id === id)
    if (tx?.type === 'capped_profit_release' && !isSessionUnlocked(tx.linkedSessionId)) {
      return { error: 'This client must pay a linked unlock fee before the extra profit above their tier cap can be released. Apply one from their account page.' }
    }
    const result = await apiRequest(`/api/transactions/${id}/approve`, { method: 'POST' })
    if (result.error) return { error: result.error }
    await refreshTransactions()
    return { ok: true }
  }

  // Fixes the gap between "what the client typed" and "what actually
  // arrived" — the honest answer to not having real deposit
  // verification yet. Never silently overwrites: the original figure
  // stays on the transaction as `requestedAmount`, screenshots and a
  // note are the evidence trail, and every correction is audit-logged.
  // Does NOT approve — that stays a separate, deliberate step, same
  // as every other pending request on this platform.
  // Client-initiated: "I've sent this, here's my proof" — distinct
  // from correctTransactionAmount's admin-initiated evidence (see
  // that function above). Deliberately does NOT touch `status` — it
  // stays 'pending' the whole time, same value it's always had, so
  // nothing that filters/styles on status (the pending/resolved
  // split, the 3 status-pill CSS classes) needs to know a 4th state
  // exists. clientConfirmed is a separate flag the admin's pending
  // queue reads to show "Awaiting review" instead of a plain request.
  async function submitDepositProof(id, screenshots) {
    const tx = transactions.find((t) => t.id === id)
    if (!tx) return { error: 'Transaction not found.' }
    if (!screenshots || screenshots.length === 0) return { error: 'Add at least one screenshot.' }
    const result = await apiRequest(`/api/transactions/${id}/proof`, { method: 'POST', body: { screenshots } })
    if (result.error) return { error: result.error }
    await refreshTransactions()
    return { ok: true }
  }

  // Deposit/withdrawal only — fee_payment correction needs its
  // allocation recomputed too, which the backend deliberately doesn't
  // support yet (see server/sql/004_transaction_corrections.sql) —
  // the server returns a clear error for that case rather than this
  // function silently guessing at a client-side recompute.
  async function correctTransactionAmount(id, actualAmount, screenshots = [], note = '') {
    const tx = transactions.find((t) => t.id === id)
    if (!tx) return { error: 'Transaction not found.' }
    if (!actualAmount || actualAmount <= 0) return { error: 'Enter the actual amount received.' }

    const result = await apiRequest(`/api/transactions/${id}/correct`, {
      method: 'POST',
      body: { actualAmount, screenshots, note: note || undefined }
    })
    if (result.error) return { error: result.error }
    await refreshTransactions()
    return { ok: true }
  }

  // One call now — the backend's POST /:id/appeal creates the linked
  // support case itself (see server/sql/005_support.sql), so this no
  // longer needs to separately call createCase() and hope the two
  // stay in sync.
  async function appealTransaction(id, note) {
    const tx = transactions.find((t) => t.id === id)
    if (!tx) return { error: 'Transaction not found.' }
    if (tx.userId !== currentUser?.id) return { error: "You can only appeal your own transactions." }
    if (tx.requestedAmount == null || tx.requestedAmount === tx.amount) return { error: 'Only a corrected transaction can be appealed.' }

    const result = await apiRequest(`/api/transactions/${id}/appeal`, { method: 'POST', body: { note } })
    if (result.error) return { error: result.error }
    await refreshTransactions()
    return { ok: true, caseId: result.caseId }
  }

  // Notification now happens server-side (routes/transactions.js
  // doesn't currently send one on reject — see server/README.md;
  // worth adding in a future batch, not silently duplicated here in
  // the meantime).
  async function rejectTransaction(id, reason) {
    const result = await apiRequest(`/api/transactions/${id}/reject`, { method: 'POST', body: { reason } })
    if (result.error) return { error: result.error }
    await refreshTransactions()
    return { ok: true }
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
    refreshTransactions,
    refreshReferralCampaigns,
    history,
    priceFeedStatus,
    getRecentRange,
    orders,
    watchlist,
    toggleWatchlist,
    transactions,
    addTransaction,
    applyFee,
    isSessionUnlocked,
    applyDiscountToFee,
    payFeeBalance,
    deleteTransaction,
    getOutstandingFees,
    approveTransaction,
    correctTransactionAmount,
    submitDepositProof,
    appealTransaction,
    rejectTransaction,
    referralCampaigns,
    createReferralCampaign,
    updateReferralCampaign,
    setCampaignActive,
    getActiveReferralCampaign,
    getCampaignStats,
    accountBalance,
    getAccountBalance,
    getBalanceBreakdown,
    sessions,
    startSession,
    beginAwaitingSession,
    cancelAwaitingSession,
    closeSession,
    openSessionPosition,
    closeSessionPosition,
    setSessionLeverage,
    setSessionDuration,
    sessionCurrentValue,
    getSessionsForUser,
    generateDemoActivity,
    purgeDataForUsers,
    sessionScenarios,
    applySessionScenario,
    resetSessionScenario,
    resetAllSessionScenarios,
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