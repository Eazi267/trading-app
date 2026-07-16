// CoinGecko's keyless public endpoint — no API key, no auth header,
// no signup. Free tier is rate-limited (~10-30 req/min) but we're
// making one request per poll for two coins, nowhere close to that.
// https://docs.coingecko.com/docs/keyless-public-api
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'

// Maps our internal symbol names to CoinGecko's coin ids. Add an
// entry here (and to REAL_SYMBOLS in AppContext) to bring another
// instrument onto the real feed later.
export const COINGECKO_ID_BY_SYMBOL = {
  'BTC/USD': 'bitcoin',
  'ETH/USD': 'ethereum'
}

// Returns { 'BTC/USD': 67000, 'ETH/USD': 3500 } on success, or null
// on any failure (network error, rate limit, malformed response) —
// callers should keep the last known price rather than crash or
// zero it out when this returns null.
export async function fetchRealCryptoPrices() {
  try {
    const response = await fetch(COINGECKO_URL)
    if (!response.ok) return null
    const data = await response.json()

    const prices = {}
    for (const [symbol, coinId] of Object.entries(COINGECKO_ID_BY_SYMBOL)) {
      const price = data[coinId]?.usd
      if (typeof price !== 'number') return null
      prices[symbol] = price
    }
    return prices
  } catch {
    return null
  }
}
