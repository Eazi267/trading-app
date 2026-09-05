import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useAudit } from './AuditContext.jsx'
import { useEmail } from './EmailContext.jsx'
import { useSettings } from './SettingsContext.jsx'
import { requestDepositVerification } from '../services/blockchainVerification.js'
import { useNotifications } from './NotificationContext.jsx'
import { useSupport } from './SupportContext.jsx'
import { getTier, clampLeverage, clampDuration, TIERS } from '../config/tiers.js'
import { fetchRealCryptoPrices } from '../services/coingecko.js'

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
  const { createCase } = useSupport()
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

  // Admin-defined referral bonus campaigns (e.g. "Christmas Bonus").
  // A campaign is data, not code — unlike tiers.js (fixed, developer-
  // edited), campaigns are created/edited by an admin at runtime, so
  // they live here alongside transactions/sessions, not in config/.
  const [referralCampaigns, setReferralCampaigns] = useState(() => {
    const saved = localStorage.getItem('pulse_referral_campaigns')
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
    localStorage.setItem('pulse_referral_campaigns', JSON.stringify(referralCampaigns))
  }, [referralCampaigns])

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
  function addTransaction(type, amount, details = {}) {
    if (type === 'withdrawal' && (settings.kycEnabled || currentUser?.kycRequired) && currentUser?.kyc?.status !== 'verified') {
      return { error: 'Identity verification is required before you can withdraw. Submit your document on the Verification page.' }
    }
    // A fee locks withdrawals until it's cleared — deliberately
    // checked against getOutstandingFees (owed > 0), not a boolean
    // flag, so a partial Fee Balance payment doesn't quietly unlock
    // things early: it stays locked until the full amount is paid.
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
    // Crypto deposits get an honest verification status attached —
    // 'manual' when the toggle is off (current default: every
    // deposit is reviewed by a person, same as today), or whatever
    // requestDepositVerification() actually returns when it's on.
    // Right now that's always 'unavailable' — see that file for why
    // — so this never claims a check happened that didn't.
    let verification = null
    if (type === 'deposit' && details.depositMethod !== 'bank') {
      verification = settings.blockchainVerificationEnabled
        ? requestDepositVerification({ method: details.depositMethod, chain: details.depositChain, amount })
        : { status: 'manual', reason: null }
    }
    setTransactions((prev) => [
      {
        id: Date.now(),
        userId: currentUser?.id,
        userName: currentUser?.name,
        type,
        amount,
        date: new Date().toISOString(),
        status: 'pending',
        ...(type === 'withdrawal' ? {
          withdrawalMethod: details.withdrawalMethod,
          withdrawalChain: details.withdrawalChain || null,
          destinationAddress: details.destinationAddress?.trim() || null
        } : {}),
        ...(type === 'deposit' ? {
          depositMethod: details.depositMethod,
          depositChain: details.depositChain || null,
          depositReference: details.depositReference?.trim() || null,
          verificationStatus: verification?.status || null,
          verificationNote: verification?.reason || null
        } : {})
      },
      ...prev
    ])
    return { ok: true }
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
  function applyFee(targetUserId, amount, note, discount, linkedSessionId = null) {
    if (!amount || amount <= 0) return { error: 'Enter a fee amount above zero.' }
    if (discount?.discountAmount > 0) {
      if (discount.discountAmount >= amount) return { error: 'Discount must be less than the fee amount.' }
      if (!discount.durationHours || discount.durationHours <= 0) return { error: 'Enter how long the discount should last.' }
    }

    const owner = users.find((u) => u.id === targetUserId)
    const hasDiscount = discount?.discountAmount > 0
    const discountExpiresAt = hasDiscount ? new Date(Date.now() + discount.durationHours * 60 * 60 * 1000).toISOString() : null

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
        // A fee is recorded immediately as an outstanding invoice, but
        // never debits the main balance directly (see
        // getAccountBalance) — it's covered by whatever the client
        // deposits toward their Fee Balance (see payFeeBalance), which
        // reduces amountPaid here until it's fully covered.
        feeStatus: 'outstanding',
        amountPaid: 0,
        discountAmount: hasDiscount ? discount.discountAmount : null,
        discountExpiresAt,
        linkedSessionId: linkedSessionId || null,
        executedByAdminName: currentUser?.name
      },
      ...prev
    ])
    const owed = hasDiscount ? amount - discount.discountAmount : amount
    logAudit({
      action: 'fee_charged',
      actor: currentUser,
      targetUserId,
      targetUserName: owner?.name ?? null,
      details: { amount, note, discountAmount: hasDiscount ? discount.discountAmount : null, discountExpiresAt, linkedSessionId: linkedSessionId || null }
    })
    notify(
      targetUserId,
      'fee_charged',
      'Fee charged',
      hasDiscount
        ? `A fee of ${formatUsd(amount)} was added to your account${note ? `: ${note}` : '.'} A discount brings it to ${formatUsd(owed)} if paid within ${discount.durationHours} hours — after that it returns to the full amount.`
        : linkedSessionId
        ? `A fee of ${formatUsd(amount)} was added to your account${note ? `: ${note}` : '.'} Paying it in full unlocks the extra profit above your tier cap on that session.`
        : `A fee of ${formatUsd(amount)} was added to your account${note ? `: ${note}` : '.'} It won't affect your balance until paid — deposit that exact amount to clear it.`,
      { amount, note, discountAmount: hasDiscount ? discount.discountAmount : null, discountExpiresAt }
    )
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
  // outstanding. Just two fields (amount off + an expiry timestamp) —
  // getFeeOwedAmount() checks the expiry fresh every time it's read,
  // so there's no background timer process; the discount simply
  // stops applying once real time passes discountExpiresAt.
  function applyDiscountToFee(feeId, discountAmount, durationHours) {
    const fee = transactions.find((t) => t.id === feeId && t.type === 'fee')
    if (!fee) return { error: 'Fee not found.' }
    if (fee.feeStatus !== 'outstanding') return { error: 'Only an outstanding fee can be discounted.' }
    if (!discountAmount || discountAmount <= 0) return { error: 'Enter a discount amount above zero.' }
    if (discountAmount >= fee.amount) return { error: 'Discount must be less than the fee amount.' }
    if (!durationHours || durationHours <= 0) return { error: 'Enter how long the discount should last.' }

    const discountExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
    setTransactions((prev) => prev.map((t) => (t.id === feeId ? { ...t, discountAmount, discountExpiresAt } : t)))

    const owed = fee.amount - discountAmount
    logAudit({
      action: 'fee_discount_applied',
      actor: currentUser,
      targetUserId: fee.userId,
      targetUserName: fee.userName ?? null,
      details: { feeId, discountAmount, discountExpiresAt }
    })
    notify(
      fee.userId,
      'fee_charged',
      'Discount applied to your fee',
      `Your outstanding ${formatUsd(fee.amount)} fee is now ${formatUsd(owed)} if paid within ${durationHours} hours — after that it returns to the full amount.`,
      { feeId, discountAmount, discountExpiresAt }
    )
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
  function allocateAgainstOutstandingFees(userId, amount) {
    const fees = getOutstandingFees(userId)
    let remaining = amount
    const allocations = []
    for (const fee of fees) {
      if (remaining <= 0) break
      const owed = getFeeOwedAmount(fee)
      if (owed <= 0) continue
      const applied = Math.min(remaining, owed)
      allocations.push({ feeId: fee.id, amount: applied })
      remaining -= applied
    }
    return { allocations, spilloverAmount: Math.round(remaining * 100) / 100 }
  }

  function payFeeBalance(amount, meta = {}) {
    if (!amount || amount <= 0) return { error: 'Enter an amount above zero.' }
    const fees = getOutstandingFees(currentUser?.id)
    if (fees.length === 0) return { error: 'No outstanding fees to pay.' }

    const { allocations, spilloverAmount } = allocateAgainstOutstandingFees(currentUser.id, amount)

    setTransactions((prev) => [
      {
        id: Date.now(),
        userId: currentUser.id,
        userName: currentUser.name,
        type: 'fee_payment',
        amount,
        feeAllocations: allocations,
        spilloverAmount,
        // Same "how you're sending it" fields a real deposit collects
        // (see addTransaction's deposit branch) — a fee payment IS a
        // deposit, just one earmarked for the Fee Balance first, so it
        // needs the same reconciliation info an admin relies on for
        // any other deposit: method, chain, and an optional reference.
        depositMethod: meta.depositMethod || null,
        depositChain: meta.depositChain || null,
        depositReference: meta.depositReference || null,
        date: new Date().toISOString(),
        status: 'pending'
      },
      ...prev
    ])
    return { ok: true, amount, spilloverAmount }
  }

  // Every fee still marked outstanding for this user, oldest first —
  // this ordering is what payFeeBalance's allocation follows (oldest
  // debt gets covered first), and what the Balance page lists so a
  // client can see exactly what makes up their Fee Balance.
  function getOutstandingFees(userId) {
    return transactions
      .filter((t) => t.userId === userId && t.type === 'fee' && getFeeOwedAmount(t) > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }

  // ADMIN-ONLY: permanently removes a transaction record. This is
  // for fixing genuine data errors — a duplicate left over from a
  // fixed bug, a mistaken entry — not a way to make a balance look
  // better by erasing real results. A reason is required, and the
  // full transaction is kept inside the audit log entry's `details`
  // even after the live record is gone, so there's always a record
  // of exactly what was removed, by whom, and why.
  function deleteTransaction(transactionId, reason) {
    if (!reason?.trim()) return { error: 'Enter a reason for deleting this transaction.' }
    const tx = transactions.find((t) => t.id === transactionId)
    if (!tx) return { error: 'Transaction not found.' }

    const targetUser = users.find((u) => u.id === tx.userId)
    logAudit({
      action: 'transaction_deleted',
      actor: currentUser,
      targetUserId: tx.userId,
      targetUserName: targetUser?.name ?? tx.userName ?? null,
      details: { reason: reason.trim(), deletedTransaction: tx }
    })
    setTransactions((prev) => prev.filter((t) => t.id !== transactionId))
    return { ok: true }
  }

  // ADMIN-ONLY: creates a referral bonus campaign — a bounded window
  // (start/end date) during which a referrer earns `bonusAmount` the
  // instant someone they referred makes their first approved deposit.
  // Multiple campaigns can exist for history; only ones marked
  // `active` AND currently inside their own date window ever pay out
  // (see getActiveReferralCampaign) — ended campaigns just stay as a
  // record, never deleted out from under past bonuses.
  function createReferralCampaign({ name, bonusAmount, startDate, endDate, note }) {
    if (!name?.trim()) return { error: 'Give the campaign a name.' }
    if (!bonusAmount || bonusAmount <= 0) return { error: 'Enter a bonus amount above zero.' }
    if (!startDate || !endDate) return { error: 'Set a start and end date.' }
    if (new Date(endDate) < new Date(startDate)) return { error: 'End date must be on or after the start date.' }

    const campaign = {
      id: Date.now(),
      name: name.trim(),
      bonusAmount,
      startDate,
      endDate,
      note: note?.trim() || null,
      active: true,
      createdAt: new Date().toISOString(),
      createdByAdminName: currentUser?.name
    }
    setReferralCampaigns((prev) => [campaign, ...prev])
    logAudit({
      action: 'referral_campaign_created',
      actor: currentUser,
      details: { campaignId: campaign.id, name: campaign.name, bonusAmount, startDate, endDate }
    })
    return { campaign }
  }

  // Admin can edit a campaign's terms (e.g. extend the end date,
  // adjust the bonus) — existing bonuses already paid out under the
  // old terms are untouched, since they're already-recorded
  // transactions, not something this recalculates retroactively.
  function updateReferralCampaign(id, updates) {
    setReferralCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
    logAudit({
      action: 'referral_campaign_updated',
      actor: currentUser,
      details: { campaignId: id, updatedFields: Object.keys(updates) }
    })
  }

  // Toggle a campaign on/off without deleting it — an admin might
  // want to pause a campaign early, or reactivate a past one.
  function setCampaignActive(id, active) {
    setReferralCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)))
    logAudit({
      action: active ? 'referral_campaign_activated' : 'referral_campaign_deactivated',
      actor: currentUser,
      details: { campaignId: id }
    })
  }

  // The campaign (if any) actually live right now — `active` AND
  // today's date inside [startDate, endDate]. Referral bonuses only
  // ever check against this; everything else is just history the
  // admin can look back on.
  function getActiveReferralCampaign() {
    const now = new Date()
    return (
      referralCampaigns.find(
        (c) => c.active && new Date(c.startDate) <= now && now <= new Date(c.endDate + 'T23:59:59')
      ) || null
    )
  }

  // Purely derived stats for the admin campaign list — never a
  // separate counter that could drift from the real transactions.
  function getCampaignStats(campaignId) {
    const paid = transactions.filter((t) => t.type === 'referral_bonus' && t.campaignId === campaignId)
    return { count: paid.length, totalPaid: paid.reduce((sum, t) => sum + t.amount, 0) }
  }

  // True only the FIRST time this user has ever had a deposit
  // approved. This is the qualifying event for a referral bonus —
  // same principle already used for tier assignment (nothing real
  // happens at signup; a genuine funded deposit is what counts) —
  // so a referral can't be gamed by creating an account and never
  // depositing.
  function isFirstApprovedDeposit(userId, excludingTransactionId) {
    return !transactions.some(
      (t) => t.userId === userId && t.type === 'deposit' && t.status === 'approved' && t.id !== excludingTransactionId
    )
  }

  function approveTransaction(id) {
    const tx = transactions.find((t) => t.id === id)

    if (tx?.type === 'capped_profit_release' && !isSessionUnlocked(tx.sessionId)) {
      return { error: 'This client must pay a linked unlock fee before the extra profit above their tier cap can be released. Apply one from their account page.' }
    }

    if (tx?.type === 'fee_payment') {
      // Apply each locked-in allocation to its fee's cumulative
      // amountPaid; a fee whose owed amount reaches zero flips to
      // 'paid'. The fee_payment transaction itself never touches main
      // balance — it's entirely absorbed here.
      setTransactions((prev) =>
        prev.map((t) => {
          if (t.id === id) return { ...t, status: 'approved' }
          const allocation = tx.feeAllocations?.find((a) => a.feeId === t.id)
          if (allocation) {
            const newAmountPaid = (t.amountPaid || 0) + allocation.amount
            const stillOwed = getFeeOwedAmount({ ...t, amountPaid: newAmountPaid })
            return { ...t, amountPaid: newAmountPaid, feeStatus: stillOwed <= 0 ? 'paid' : 'outstanding' }
          }
          return t
        })
      )
      // Genuine excess beyond what was owed becomes a real, separate
      // deposit — new money that wasn't needed to cover fees, so it
      // credits the main balance like any other deposit.
      if (tx.spilloverAmount > 0) {
        setTransactions((prev) => [
          {
            id: Date.now() + 1,
            userId: tx.userId,
            userName: tx.userName,
            type: 'deposit',
            amount: tx.spilloverAmount,
            note: 'Excess from fee payment',
            date: new Date().toISOString(),
            status: 'approved'
          },
          ...prev
        ])
      }
      const coveredAmount = tx.amount - tx.spilloverAmount
      notify(
        tx.userId,
        'fee_paid',
        'Fee payment approved',
        tx.spilloverAmount > 0
          ? `Your payment of ${formatUsd(tx.amount)} cleared your Fee Balance (${formatUsd(coveredAmount)}) and the remaining ${formatUsd(tx.spilloverAmount)} was added to your balance.`
          : `Your payment of ${formatUsd(tx.amount)} was applied to your Fee Balance.`,
        { transactionId: id, amount: tx.amount, spilloverAmount: tx.spilloverAmount }
      )
      return
    }

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'approved' } : t))
    )

    // Referral bonus check — ONLY on a genuine deposit being approved
    // (fee_payment is its own separate type now, so this never needs
    // to guard against it), and ONLY on that depositor's very first
    // approved deposit ever (see isFirstApprovedDeposit). Pays out
    // instantly and automatically once a campaign is live — no
    // separate approval step needed, since the qualifying deposit
    // itself already went through one.
    if (tx?.type === 'deposit') {
      const depositor = users.find((u) => u.id === tx.userId)
      const campaign = getActiveReferralCampaign()
      const alreadyPaid = transactions.some((t) => t.type === 'referral_bonus' && t.referredUserId === tx.userId)
      if (depositor?.referredBy && campaign && !alreadyPaid && isFirstApprovedDeposit(tx.userId, tx.id)) {
        const referrer = users.find((u) => u.id === depositor.referredBy)
        // Second guard against the same thing signup() already
        // prevents — a generated demo client should never be able to
        // collect a real bonus, even if referredBy somehow got set
        // some other way in the future.
        if (referrer && !referrer.isDemoGenerated) {
          setTransactions((prev) => [
            {
              id: Date.now() + 1,
              userId: referrer.id,
              userName: referrer.name,
              type: 'referral_bonus',
              amount: campaign.bonusAmount,
              status: 'approved',
              campaignId: campaign.id,
              campaignName: campaign.name,
              referredUserId: depositor.id,
              referredUserName: depositor.name,
              date: new Date().toISOString()
            },
            ...prev
          ])
          notify(
            referrer.id,
            'referral_bonus',
            'Referral bonus earned!',
            `${depositor.name} made their first deposit — you earned a ${formatUsd(campaign.bonusAmount)} bonus from the "${campaign.name}" campaign.`,
            { amount: campaign.bonusAmount, campaignId: campaign.id, referredUserId: depositor.id }
          )
        }
      }
    }

    if (tx) {
      if (tx.type === 'capped_profit_release') {
        notify(
          tx.userId,
          'capped_profit_released',
          'Pending profit released',
          `The extra ${formatUsd(tx.amount)} held above your tier cap was approved and added to your balance.`,
          { transactionId: id, amount: tx.amount }
        )
      } else if (tx.type === 'session_settlement') {
        notify(
          tx.userId,
          'session_settlement_certified',
          tx.amount >= 0 ? 'Session profit certified' : 'Session loss certified',
          `Your session result of ${tx.amount >= 0 ? '+' : ''}${formatUsd(tx.amount)} was certified and moved to your main balance.`,
          { transactionId: id, amount: tx.amount, sessionId: tx.sessionId }
        )
      } else {
        notify(
          tx.userId,
          tx.type === 'deposit' ? 'deposit_approved' : 'withdrawal_approved',
          tx.type === 'deposit' ? 'Deposit approved' : 'Withdrawal approved',
          `Your ${tx.type} of ${formatUsd(tx.amount)} was approved.`,
          { transactionId: id, amount: tx.amount }
        )
        if (tx.type === 'deposit' || tx.type === 'withdrawal') {
          const owner = users.find((u) => u.id === tx.userId)
          sendEmail({
            to: owner?.email,
            subject: tx.type === 'deposit' ? 'Your deposit was approved' : 'Your withdrawal was approved',
            body: `Hi ${owner?.name || ''},\n\nYour ${tx.type} of ${formatUsd(tx.amount)} has been approved and reflected in your account.\n\nThanks.`,
            category: tx.type
          }, settings.emailSendingEnabled)
        }
      }
    }

    // Stamped once here, after every type-specific branch above has
    // already run its own setTransactions update — admin-only info
    // (see Transactions.jsx's detail view), never shown to the
    // client, just who to ask if a client has a question about it.
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, reviewedByAdminId: currentUser?.id, reviewedByAdminName: currentUser?.name, reviewedAt: new Date().toISOString() } : t))
    )
  }

  // Fixes the gap between "what the client typed" and "what actually
  // arrived" — the honest answer to not having real deposit
  // verification yet. Never silently overwrites: the original figure
  // stays on the transaction as `requestedAmount`, screenshots and a
  // note are the evidence trail, and every correction is audit-logged.
  // Does NOT approve — that stays a separate, deliberate step, same
  // as every other pending request on this platform.
  function correctTransactionAmount(id, actualAmount, screenshots = [], note = '') {
    const tx = transactions.find((t) => t.id === id)
    if (!tx) return { error: 'Transaction not found.' }
    if (tx.status !== 'pending') return { error: 'Only a pending request can be corrected.' }
    if (tx.type !== 'deposit' && tx.type !== 'fee_payment') return { error: 'Only deposits and fee payments can be corrected.' }
    if (!actualAmount || actualAmount <= 0) return { error: 'Enter the actual amount received.' }

    const requestedAmount = tx.requestedAmount ?? tx.amount
    const owner = users.find((u) => u.id === tx.userId)

    if (tx.type === 'fee_payment') {
      // The whole point of a correction on a fee payment: the fee
      // allocation was computed against the WRONG amount at request
      // time, so it has to be recomputed against the right one —
      // patching just `amount` and leaving stale allocations in place
      // would apply the old (wrong) split to the new (right) figure.
      const { allocations, spilloverAmount } = allocateAgainstOutstandingFees(tx.userId, actualAmount)
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, amount: actualAmount, requestedAmount, feeAllocations: allocations, spilloverAmount, correctionEvidence: screenshots, correctionNote: note, correctedAt: new Date().toISOString() }
            : t
        )
      )
    } else {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, amount: actualAmount, requestedAmount, correctionEvidence: screenshots, correctionNote: note, correctedAt: new Date().toISOString() }
            : t
        )
      )
    }

    logAudit({
      action: 'transaction_amount_corrected',
      actor: currentUser,
      targetUserId: tx.userId,
      targetUserName: owner?.name,
      details: { transactionId: id, type: tx.type, requestedAmount, actualAmount, note: note || undefined, screenshotCount: screenshots.length }
    })
    return { ok: true }
  }

  // One atomic action for a client disputing a correction — flags the
  // transaction AND sends the support message in the same call, so
  // the two can never end up out of sync (e.g. a message sent but the
  // transaction never actually marked appealed, or vice versa).
  function appealTransaction(id, note) {
    const tx = transactions.find((t) => t.id === id)
    if (!tx) return { error: 'Transaction not found.' }
    if (tx.userId !== currentUser?.id) return { error: "You can only appeal your own transactions." }
    if (tx.requestedAmount == null || tx.requestedAmount === tx.amount) return { error: 'Only a corrected transaction can be appealed.' }

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, appealed: true, appealedAt: new Date().toISOString() } : t))
    )
    const text = note?.trim()
      ? `I requested ${formatUsd(tx.requestedAmount)} but it was confirmed as ${formatUsd(tx.amount)}. ${note.trim()}`
      : `I requested ${formatUsd(tx.requestedAmount)} but it was confirmed as ${formatUsd(tx.amount)}. Please review.`
    const result = createCase({
      subject: `Appeal — Transaction #${id}`,
      category: 'appeal',
      body: text,
      relatedTransactionId: id
    })
    logAudit({
      action: 'transaction_appealed',
      actor: currentUser,
      targetUserId: tx.userId,
      targetUserName: currentUser.name,
      details: { transactionId: id, requestedAmount: tx.requestedAmount, confirmedAmount: tx.amount, caseId: result.case?.id }
    })
    return { ok: true, caseId: result.case?.id }
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
      } else if (tx.type === 'session_settlement') {
        notify(
          tx.userId,
          'balance_update',
          'Session result not certified',
          `Your session result of ${tx.amount >= 0 ? '+' : ''}${formatUsd(tx.amount)} was not certified and wasn't added to your balance. Contact support if this is unexpected.`,
          { transactionId: id, amount: tx.amount, sessionId: tx.sessionId }
        )
      } else if (tx.type === 'fee_payment') {
        notify(
          tx.userId,
          'balance_update',
          'Fee payment rejected',
          `Your Fee Balance payment of ${formatUsd(tx.amount)} was rejected. Contact support if this is unexpected.`,
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
    isSessionUnlocked,
    applyDiscountToFee,
    payFeeBalance,
    deleteTransaction,
    getOutstandingFees,
    approveTransaction,
    correctTransactionAmount,
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