import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { isLiveMode } from '../config/tradingMode.js'

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
  const { currentUser } = useAuth()
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

  useEffect(() => {
    localStorage.setItem('pulse_transactions', JSON.stringify(transactions))
  }, [transactions])

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

  // FIX: now scoped to the logged-in user only — previously this summed
  // every user's approved transactions into one shared number.
  const accountBalance = transactions
    .filter((t) => t.userId === currentUser?.id && t.status === 'approved')
    .reduce((sum, t) => sum + (t.type === 'deposit' ? t.amount : -t.amount), 0)

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
    accountBalance
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}