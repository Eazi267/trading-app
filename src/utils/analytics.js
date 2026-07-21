// ---------------------------------------------------------
// Pure functions only — every number here is derived from real
// stored records (orders, transactions, sessions), the same rule
// that governs every balance in this app. A brand-new account with
// no trades yet will correctly show zeros/empty states, not
// impressive-looking placeholder numbers.
//
// Two different "profit" concepts are used on purpose, and kept
// separate rather than blended into one misleading figure:
//   - Trade-level pnl: the raw, uncapped result of each closed
//     position (from `orders`). Used for win rate, average trade,
//     largest win/loss — these describe trading SKILL.
//   - Session-settlement amount: the tier-capped payout that
//     actually moves the client's balance (from `transactions`).
//     Used for Today/Weekly/Monthly/Total profit and ROI — these
//     describe real ACCOUNT impact, which is never allowed to
//     exceed a tier's cap even if the underlying trades did better.
// ---------------------------------------------------------

export function getClosedPositions(orders, userId) {
  return orders.filter((o) => o.userId === userId && o.type === 'close_position' && o.pnl != null)
}

export function getTradeStats(orders, userId) {
  const closed = getClosedPositions(orders, userId)
  const totalTrades = closed.length
  const winners = closed.filter((o) => o.pnl > 0)
  const losers = closed.filter((o) => o.pnl < 0)
  const grossPnl = closed.reduce((sum, o) => sum + o.pnl, 0)
  const winRate = totalTrades > 0 ? (winners.length / totalTrades) * 100 : 0
  const averageTrade = totalTrades > 0 ? grossPnl / totalTrades : 0
  const largestWin = winners.length > 0 ? Math.max(...winners.map((o) => o.pnl)) : 0
  const largestLoss = losers.length > 0 ? Math.min(...losers.map((o) => o.pnl)) : 0

  return {
    totalTrades,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate,
    grossPnl,
    averageTrade,
    largestWin,
    largestLoss
  }
}

function getSessionSettlements(transactions, userId) {
  // Approved capped-profit releases are real, realized profit too —
  // they just arrived on a delay for admin review. Once approved,
  // they count the same as any other settlement.
  return transactions.filter(
    (t) => t.userId === userId && t.status === 'approved' &&
    (t.type === 'session_settlement' || t.type === 'capped_profit_release')
  )
}

function sumAmountSince(entries, sinceDate) {
  return entries
    .filter((t) => new Date(t.date).getTime() >= sinceDate.getTime())
    .reduce((sum, t) => sum + t.amount, 0)
}

// Real account-level profit, windowed by real settlement dates.
// "Today" = since local midnight; "This week"/"This month" = trailing
// 7/30 days, kept simple and consistent with how "recent" is framed
// elsewhere in this app (e.g. price range on the Markets page).
export function getProfitBreakdown(transactions, userId) {
  const settlements = getSessionSettlements(transactions, userId)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  return {
    today: sumAmountSince(settlements, startOfToday),
    thisWeek: sumAmountSince(settlements, sevenDaysAgo),
    thisMonth: sumAmountSince(settlements, thirtyDaysAgo),
    allTime: settlements.reduce((sum, t) => sum + t.amount, 0)
  }
}

// ROI against real money actually put in — total settlement profit
// divided by total approved deposits. Returns 0 if nothing's been
// deposited yet, rather than dividing by zero.
export function getROI(transactions, userId) {
  const totalDeposited = transactions
    .filter((t) => t.userId === userId && t.type === 'deposit' && t.status === 'approved')
    .reduce((sum, t) => sum + t.amount, 0)
  if (totalDeposited <= 0) return 0
  const { allTime } = getProfitBreakdown(transactions, userId)
  return (allTime / totalDeposited) * 100
}

// A running-balance-over-time series, built by replaying every
// approved transaction in chronological order — the same
// calculation getAccountBalance() does, just kept as a series
// instead of collapsed to one final number. This is what "account
// growth" / "balance history" actually is: a real ledger replay,
// not a fabricated smooth line.
export function getBalanceHistory(transactions, userId) {
  const approved = transactions
    .filter((t) => t.userId === userId && t.status === 'approved')
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  let running = 0
  return approved.map((t) => {
    if (t.type === 'deposit') running += t.amount
    else if (t.type === 'withdrawal') running -= t.amount
    else if (t.type === 'session_settlement') running += t.amount
    else if (t.type === 'capped_profit_release') running += t.amount
    else if (t.type === 'referral_bonus') running += t.amount
    else if (t.type === 'fee' && t.feeStatus === 'paid') running -= t.amount
    return { date: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), balance: running }
  })
}

// The full account ledger — every deposit, withdrawal, fee, session
// settlement, and capped-profit review for this client, newest
// first, each tagged with the running balance AT THAT POINT. Only
// approved entries move the running balance; pending/rejected ones
// are shown with the balance as it stood before them (they haven't
// affected the account yet, or never will).
export function getFullTransactionHistory(transactions, userId) {
  const mine = transactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  let running = 0
  const withBalance = mine.map((t) => {
    if (t.status === 'approved') {
      if (t.type === 'deposit') running += t.amount
      else if (t.type === 'withdrawal') running -= t.amount
      else if (t.type === 'session_settlement') running += t.amount
      else if (t.type === 'capped_profit_release') running += t.amount
      else if (t.type === 'referral_bonus') running += t.amount
      else if (t.type === 'fee' && t.feeStatus === 'paid') running -= t.amount
    }
    return { ...t, runningBalance: running }
  })

  return withBalance.reverse()
}


// positions — margin × leverage, i.e. the real notional size being
// risked per instrument right now. Empty if nothing's open.
export function getAssetAllocation(sessions, userId) {
  const exposureBySymbol = {}
  sessions
    .filter((s) => s.userId === userId && s.status === 'active')
    .forEach((s) => {
      s.positions.forEach((p) => {
        const exposure = p.marginAmount * p.leverage
        exposureBySymbol[p.symbol] = (exposureBySymbol[p.symbol] || 0) + exposure
      })
    })
  return Object.entries(exposureBySymbol).map(([symbol, value]) => ({ symbol, value }))
}

// Count of trade-related actions (position opens + closes) per day
// over the trailing `days` days — a real activity log, not a guess.
export function getTradingActivity(orders, userId, days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const relevant = orders.filter(
    (o) => o.userId === userId && new Date(o.date).getTime() >= since.getTime()
  )
  const buckets = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    buckets[key] = 0
  }
  relevant.forEach((o) => {
    const key = new Date(o.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    if (key in buckets) buckets[key] += 1
  })
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
}

// Count of open positions right now, across every active session —
// this is what "Active Trades" means on the dashboard.
export function getActiveTradeCount(sessions, userId) {
  return sessions
    .filter((s) => s.userId === userId && s.status === 'active')
    .reduce((sum, s) => sum + s.positions.length, 0)
}
