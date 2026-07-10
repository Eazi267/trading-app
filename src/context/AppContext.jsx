import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { isLiveMode } from '../config/tradingMode.js'
import { getTier } from '../config/tiers.js'

const AppContext = createContext(null)

const STARTING_PRICES = {
  'BTC/USD': 64200,
  'ETH/USD': 3150,
  'EUR/USD': 1.086,
  'GBP/USD': 1.271
}

// Only the original demo trader (id 1) starts with sample positions.
// Everyone else starts empty until an admin trades on their behalf.
const STARTING_PORTFOLIOS = {
  1: [
    { symbol: 'BTC/USD', units: 0.42, avgPrice: 61000 },
    { symbol: 'ETH/USD', units: 3.1, avgPrice: 2980 },
    { symbol: 'EUR/USD', units: 5000, avgPrice: 1.079 }
  ]
}

const STARTING_WATCHLIST = ['BTC/USD', 'ETH/USD']

function randomWalk(price) {
  const changePercent = (Math.random() - 0.5) * 0.006
  return price * (1 + changePercent)
}

export function AppProvider({ children }) {
  const { currentUser, users } = useAuth()
  const [theme, setThemeState] = useState(() => localStorage.getItem('pulse_theme') || 'dark')
  const [accent, setAccentState] = useState(() => localStorage.getItem('pulse_accent') || 'ember')
  const [prices, setPrices] = useState(STARTING_PRICES)
  const [history, setHistory] = useState([])

  // Keyed by userId: { [userId]: [ { symbol, units, avgPrice }, ... ] }
  const [portfolios, setPortfolios] = useState(() => {
    const saved = localStorage.getItem('pulse_portfolios')
    return saved ? JSON.parse(saved) : STARTING_PORTFOLIOS
  })

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
    localStorage.setItem('pulse_portfolios', JSON.stringify(portfolios))
  }, [portfolios])

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

  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        const next = {}
        Object.keys(prev).forEach((symbol) => {
          next[symbol] = randomWalk(prev[symbol])
        })
        setHistory((prevHistory) => {
          const point = { time: new Date().toLocaleTimeString(), value: next['BTC/USD'] }
          return [...prevHistory, point].slice(-30)
        })
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

  // Reads one user's portfolio. Returns [] if they don't have one yet.
  function getPortfolio(userId) {
    return portfolios[userId] || []
  }

  function logOrder(targetUserId, type, symbol, units, price) {
    setOrders((prev) => [
      {
        id: Date.now(),
        userId: targetUserId,
        executedByAdminId: currentUser?.id,
        executedByAdminName: currentUser?.name,
        type,
        symbol,
        units,
        price,
        date: new Date().toISOString()
      },
      ...prev
    ])
  }

  // Admin buys on behalf of targetUserId. Blends cost basis like a real broker.
  function buyAsset(targetUserId, symbol, units) {
    const price = prices[symbol]
    if (!price || units <= 0) return

    setPortfolios((prev) => {
      const existingList = prev[targetUserId] || []
      const existing = existingList.find((p) => p.symbol === symbol)
      let nextList
      if (existing) {
        const totalUnits = existing.units + units
        const blendedAvg = (existing.avgPrice * existing.units + price * units) / totalUnits
        nextList = existingList.map((p) =>
          p.symbol === symbol ? { ...p, units: totalUnits, avgPrice: blendedAvg } : p
        )
      } else {
        nextList = [...existingList, { symbol, units, avgPrice: price }]
      }
      return { ...prev, [targetUserId]: nextList }
    })

    logOrder(targetUserId, 'buy', symbol, units, price)
  }

  // Admin sells on behalf of targetUserId. Never below zero; avgPrice unchanged.
  function sellAsset(targetUserId, symbol, units) {
    const price = prices[symbol]
    const existingList = portfolios[targetUserId] || []
    const existing = existingList.find((p) => p.symbol === symbol)
    if (!price || !existing || units <= 0 || units > existing.units) return

    setPortfolios((prev) => ({
      ...prev,
      [targetUserId]: (prev[targetUserId] || []).map((p) =>
        p.symbol === symbol ? { ...p, units: p.units - units } : p
      )
    }))

    logOrder(targetUserId, 'sell', symbol, units, price)
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
  // that isn't actually there.
  function startSession(targetUserId, tierId, amount) {
    const tier = getTier(tierId)
    if (!tier || !amount || amount <= 0) return { error: 'Invalid tier or amount.' }

    const { available } = getBalanceBreakdown(targetUserId)
    if (amount > available) return { error: 'Amount exceeds available balance.' }

    const session = {
      id: Date.now(),
      userId: targetUserId,
      tierId,
      amount,
      startPrices: { ...prices },
      startedAt: new Date().toISOString(),
      status: 'active',
      closedAt: null,
      endValue: null,
      rawPnl: null,
      payout: null,
      initiatedByName: currentUser?.name,
      initiatedBySelf: currentUser?.id === targetUserId
    }
    setSessions((prev) => [session, ...prev])
    return { session }
  }

  // A session's live value tracks the average % move across the
  // instruments it started against — calculated from the real price
  // feed, never typed in. This is what "current value" means for an
  // active session before it's closed.
  function sessionCurrentValue(session) {
    const symbols = Object.keys(session.startPrices)
    const avgChange =
      symbols.reduce((sum, s) => sum + (prices[s] - session.startPrices[s]) / session.startPrices[s], 0) /
      symbols.length
    return session.amount * (1 + avgChange)
  }

  // Closes a session, applies the tier's payout cap, and posts a real
  // settlement transaction so the client's balance actually updates.
  // Rule: if the real gain is positive, payout is the SMALLER of the
  // real gain or (amount * tier.maxPayoutMultiplier). If the real
  // result is a loss, payout is the full loss — losses are never capped.
  function closeSession(sessionId) {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || session.status !== 'active') return

    const tier = getTier(session.tierId)
    const endValue = sessionCurrentValue(session)
    const rawPnl = endValue - session.amount
    const cappedGain = tier ? session.amount * tier.maxPayoutMultiplier : rawPnl
    const payout = rawPnl > 0 ? Math.min(rawPnl, cappedGain) : rawPnl

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, status: 'closed', closedAt: new Date().toISOString(), endValue, rawPnl, payout }
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
        sessionId
      },
      ...prev
    ])
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
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'approved' } : t))
    )
  }

  function rejectTransaction(id) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'rejected' } : t))
    )
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
    getPortfolio,
    buyAsset,
    sellAsset,
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
    sessionCurrentValue,
    getSessionsForUser
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}