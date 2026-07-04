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

const STARTING_PORTFOLIO = [
  { symbol: 'BTC/USD', units: 0.42, avgPrice: 61000 },
  { symbol: 'ETH/USD', units: 3.1, avgPrice: 2980 },
  { symbol: 'EUR/USD', units: 5000, avgPrice: 1.079 }
]

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

  const [portfolio, setPortfolio] = useState(() => {
    const saved = localStorage.getItem('pulse_portfolio')
    return saved ? JSON.parse(saved) : STARTING_PORTFOLIO
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
    localStorage.setItem('pulse_portfolio', JSON.stringify(portfolio))
  }, [portfolio])

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

  function logOrder(type, symbol, units, price) {
    setOrders((prev) => [
      {
        id: Date.now(),
        userId: currentUser?.id,
        userName: currentUser?.name,
        type,
        symbol,
        units,
        price,
        date: new Date().toISOString()
      },
      ...prev
    ])
  }

  // Buying: if you already hold this symbol, blend the average price
  // (this is how real brokers compute cost basis). Otherwise open a
  // new position.
  function buyAsset(symbol, units) {
    const price = prices[symbol]
    if (!price || units <= 0) return

    setPortfolio((prev) => {
      const existing = prev.find((p) => p.symbol === symbol)
      if (existing) {
        const totalUnits = existing.units + units
        const blendedAvg = (existing.avgPrice * existing.units + price * units) / totalUnits
        return prev.map((p) =>
          p.symbol === symbol ? { ...p, units: totalUnits, avgPrice: blendedAvg } : p
        )
      }
      return [...prev, { symbol, units, avgPrice: price }]
    })

    logOrder('buy', symbol, units, price)
  }

  // Selling: reduce units, never below zero, avgPrice stays the same
  // (cost basis doesn't change when you sell part of a position).
  function sellAsset(symbol, units) {
    const price = prices[symbol]
    const existing = portfolio.find((p) => p.symbol === symbol)
    if (!price || !existing || units <= 0 || units > existing.units) return

    setPortfolio((prev) =>
      prev.map((p) =>
        p.symbol === symbol ? { ...p, units: p.units - units } : p
      )
    )

    logOrder('sell', symbol, units, price)
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

  const accountBalance = transactions
    .filter((t) => t.status === 'approved')
    .reduce((sum, t) => sum + (t.type === 'deposit' ? t.amount : -t.amount), 0)

  const value = {
    theme,
    setTheme: setThemeState,
    accent,
    setAccent: setAccentState,
    prices,
    history,
    portfolio,
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