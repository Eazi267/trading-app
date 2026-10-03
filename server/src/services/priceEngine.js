// Server-authoritative prices for session/position math. Mirrors
// AppContext.jsx's price logic exactly (same STARTING_PRICES, same
// randomWalk formula/amplitude, same real-vs-simulated symbol split)
// but runs here instead of in the browser — this is the actual fix
// for the gap flagged before this batch started: a client-submitted
// price for their own P&L would be a client controlling their own
// trading result. Positions/sessions read getCurrentPrices() only;
// nothing about a position or session ever accepts a price as input
// from a request body.

export const REAL_SYMBOLS = ['BTC/USD', 'ETH/USD']
export const SIMULATED_SYMBOLS = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'XAG/USD']

const STARTING_PRICES = {
  'BTC/USD': 64200,
  'ETH/USD': 3150,
  'EUR/USD': 1.086,
  'GBP/USD': 1.271,
  'XAU/USD': 2380,
  'XAG/USD': 28.4
}

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'
const COINGECKO_ID_BY_SYMBOL = { 'BTC/USD': 'bitcoin', 'ETH/USD': 'ethereum' }

const SIMULATED_TICK_MS = 2000
const REAL_PRICE_POLL_MS = 20 * 1000 // 3 req/min, well under CoinGecko's keyless rate limit

let prices = { ...STARTING_PRICES }

function randomWalk(price) {
  const changePercent = (Math.random() - 0.5) * 0.006
  return price * (1 + changePercent)
}

async function fetchRealCryptoPrices() {
  try {
    const response = await fetch(COINGECKO_URL)
    if (!response.ok) return null
    const data = await response.json()
    const result = {}
    for (const [symbol, coinId] of Object.entries(COINGECKO_ID_BY_SYMBOL)) {
      const price = data[coinId]?.usd
      if (typeof price !== 'number') return null
      result[symbol] = price
    }
    return result
  } catch {
    return null
  }
}

export function getCurrentPrices() {
  return { ...prices }
}

// Called once at server boot (see index.js). Two independent
// intervals, same split as the frontend: simulated symbols tick
// fast and locally, real symbols only change when a CoinGecko fetch
// actually succeeds — a failed fetch keeps the last known real price
// rather than zeroing it out or blocking the simulated tick.
export function startPriceEngine() {
  setInterval(() => {
    const next = { ...prices }
    SIMULATED_SYMBOLS.forEach((symbol) => {
      next[symbol] = randomWalk(prices[symbol])
    })
    prices = next
  }, SIMULATED_TICK_MS)

  const pollReal = async () => {
    const real = await fetchRealCryptoPrices()
    if (real) prices = { ...prices, ...real }
  }
  pollReal()
  setInterval(pollReal, REAL_PRICE_POLL_MS)
}
