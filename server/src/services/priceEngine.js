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
export const FX_SYMBOLS = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'XAG/USD']
export const SIMULATED_SYMBOLS = FX_SYMBOLS // kept for older imports

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

// Forex + metals come from Twelve Data (https://twelvedata.com) when
// TWELVEDATA_API_KEY is set. One batch request covers all four pairs.
// Free plan = 800 credits/day and each symbol costs 1 credit, so the
// default poll is every 10 minutes; a paid plan can set
// FX_POLL_SECONDS=15 (or similar) for near-real-time. Without a key
// nothing changes: these symbols stay simulated AND are labelled so.
const FX_API_URL = process.env.FX_API_URL || 'https://api.twelvedata.com/price'
const FX_API_KEY = process.env.TWELVEDATA_API_KEY || ''
const FX_POLL_MS = Math.max(5, Number(process.env.FX_POLL_SECONDS) || 600) * 1000

const SIMULATED_TICK_MS = 2000
const REAL_PRICE_POLL_MS = 20 * 1000 // 3 req/min, well under CoinGecko's keyless rate limit

let prices = { ...STARTING_PRICES }

// Where each symbol's current price really comes from:
//   'live'      - fetched from a real market feed recently
//   'delayed'   - was live, the feed has since gone quiet; last real price is held
//   'simulated' - no real feed for this symbol; random walk
const sources = {}
const lastRealAt = {}
Object.keys(STARTING_PRICES).forEach((sym) => {
  // Crypto is never random-walked: until its first successful fetch it
  // just shows the starting placeholder, which is honestly 'delayed'.
  sources[sym] = REAL_SYMBOLS.includes(sym) ? 'delayed' : 'simulated'
})

function markLive(symbol, price) {
  prices = { ...prices, [symbol]: price }
  sources[symbol] = 'live'
  lastRealAt[symbol] = Date.now()
}

// A symbol that was live but hasn't refreshed for 3 poll intervals is
// 'delayed': we keep its last real price instead of inventing movement.
function refreshStaleness() {
  const now = Date.now()
  for (const symbol of Object.keys(lastRealAt)) {
    const limit = (FX_SYMBOLS.includes(symbol) ? FX_POLL_MS : REAL_PRICE_POLL_MS) * 3
    if (now - lastRealAt[symbol] > limit) sources[symbol] = 'delayed'
  }
}

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

export function getPriceSources() {
  return { ...sources }
}

// Parses a Twelve Data batch response. Returns only symbols that came
// back as a sane positive number; anything else is ignored so one bad
// field can never zero or corrupt a price.
export function parseFxResponse(data) {
  const out = {}
  if (!data || typeof data !== 'object') return out
  for (const symbol of FX_SYMBOLS) {
    const raw = data[symbol]?.price
    const n = Number(raw)
    if (raw !== undefined && Number.isFinite(n) && n > 0) out[symbol] = n
  }
  return out
}

async function fetchFxPrices() {
  if (!FX_API_KEY) return null
  try {
    const url = `${FX_API_URL}?symbol=${FX_SYMBOLS.join(',')}&apikey=${encodeURIComponent(FX_API_KEY)}`
    const response = await fetch(url)
    if (!response.ok) return null
    return parseFxResponse(await response.json())
  } catch {
    return null
  }
}

// Called once at server boot (see index.js). Two independent
// intervals, same split as the frontend: simulated symbols tick
// fast and locally, real symbols only change when a CoinGecko fetch
// actually succeeds — a failed fetch keeps the last known real price
// rather than zeroing it out or blocking the simulated tick.
export function startPriceEngine() {
  setInterval(() => {
    const next = { ...prices }
    // Only symbols that have NEVER had a real price are simulated. Once a
    // symbol has been live, we hold its last real price rather than
    // inventing movement on top of it.
    FX_SYMBOLS.forEach((symbol) => {
      if (sources[symbol] === 'simulated') next[symbol] = randomWalk(prices[symbol])
    })
    prices = next
  }, SIMULATED_TICK_MS)

  const pollReal = async () => {
    const real = await fetchRealCryptoPrices()
    if (real) Object.entries(real).forEach(([sym, price]) => markLive(sym, price))
    refreshStaleness()
  }
  pollReal()
  setInterval(pollReal, REAL_PRICE_POLL_MS)

  const pollFx = async () => {
    const fx = await fetchFxPrices()
    if (fx) Object.entries(fx).forEach(([sym, price]) => markLive(sym, price))
    refreshStaleness()
  }
  if (FX_API_KEY) {
    pollFx()
    setInterval(pollFx, FX_POLL_MS)
  }
}
