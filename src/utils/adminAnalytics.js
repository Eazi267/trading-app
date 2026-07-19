import { getClients } from '../config/clients.js'

// Same balance replay logic AppContext.getAccountBalance uses,
// reimplemented here as a pure function (no closures) so this file
// can compute balances for every client at once without threading
// AppContext functions through as parameters — same convention
// utils/analytics.js already uses for getBalanceHistory().
function computeBalance(transactions, userId) {
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

// One row per real client — their balance breakdown, computed fresh,
// never stored. Used as the base for every other aggregate below.
export function getClientBalances(users, transactions, sessions) {
  return getClients(users).map((user) => {
    const total = computeBalance(transactions, user.id)
    const committed = sessions
      .filter((s) => s.userId === user.id && s.status === 'active')
      .reduce((sum, s) => sum + s.amount, 0)
    const pendingReview = transactions
      .filter((t) => t.userId === user.id && t.type === 'capped_profit_release' && t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0)
    return { user, total, available: total - committed, committed, pendingReview }
  })
}

// The platform-wide headline numbers for the admin dashboard/balance
// pages — assets under management, how much is committed vs free,
// how much is awaiting review, how many clients and sessions exist.
export function getPlatformTotals(users, transactions, sessions) {
  const balances = getClientBalances(users, transactions, sessions)
  return {
    totalClients: balances.length,
    flaggedClients: balances.filter((b) => b.user.flaggedForReview).length,
    totalAUM: balances.reduce((sum, b) => sum + b.total, 0),
    totalAvailable: balances.reduce((sum, b) => sum + b.available, 0),
    totalCommitted: balances.reduce((sum, b) => sum + b.committed, 0),
    totalPendingReview: balances.reduce((sum, b) => sum + b.pendingReview, 0),
    activeSessionCount: sessions.filter((s) => s.status === 'active').length
  }
}

// Every active session across every client, with its owner attached
// — the "all active sessions at a glance" table.
export function getActiveSessionsOverview(sessions, users) {
  return sessions
    .filter((s) => s.status === 'active')
    .map((session) => ({ session, owner: users.find((u) => u.id === session.userId) }))
}

// How many active sessions are running at each tier — for a quick
// distribution chart (e.g. "mostly Tier 2 right now").
export function getSessionsByTier(sessions) {
  const active = sessions.filter((s) => s.status === 'active')
  const counts = {}
  active.forEach((s) => { counts[s.tierId] = (counts[s.tierId] || 0) + 1 })
  return Object.entries(counts).map(([tierId, count]) => ({ tierId, count }))
}

// Counts and dollar totals for everything currently sitting in the
// admin approval queue, broken out by type.
export function getPendingRequestsSummary(transactions) {
  const pending = transactions.filter((t) => t.status === 'pending')
  function bucket(type) {
    const items = pending.filter((t) => t.type === type)
    return { count: items.length, amount: items.reduce((sum, t) => sum + t.amount, 0) }
  }
  return {
    deposits: bucket('deposit'),
    withdrawals: bucket('withdrawal'),
    cappedProfitReleases: bucket('capped_profit_release')
  }
}

// Approved deposit vs withdrawal dollar volume per day, trailing N
// days — the "are we net funding in or out" trend chart.
export function getDepositWithdrawTrend(transactions, days = 14) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000
  const buckets = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    buckets[key] = { date: key, deposits: 0, withdrawals: 0 }
  }
  transactions
    .filter((t) => t.status === 'approved' && new Date(t.date).getTime() >= since && (t.type === 'deposit' || t.type === 'withdrawal'))
    .forEach((t) => {
      const key = new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      if (buckets[key]) buckets[key][t.type === 'deposit' ? 'deposits' : 'withdrawals'] += t.amount
    })
  return Object.values(buckets)
}

// Real notional exposure by symbol across EVERY client's open
// positions at once — the platform-wide version of the per-client
// asset allocation chart on the personal Analytics page.
export function getPlatformAssetAllocation(sessions) {
  const exposure = {}
  sessions
    .filter((s) => s.status === 'active')
    .forEach((s) => {
      s.positions.forEach((p) => {
        const notional = p.marginAmount * p.leverage
        exposure[p.symbol] = (exposure[p.symbol] || 0) + notional
      })
    })
  return Object.entries(exposure).map(([symbol, value]) => ({ symbol, value }))
}

// Merges orders + transactions into one recency-sorted feed — a
// platform-wide activity log for the admin dashboard.
export function getRecentPlatformActivity(orders, transactions, limit = 10) {
  const events = [
    ...orders.map((o) => ({ ...o, kind: 'order' })),
    ...transactions.map((t) => ({ ...t, kind: 'transaction' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date))
  return events.slice(0, limit)
}
