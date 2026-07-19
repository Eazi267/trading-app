// history stores one frame per tick, for every symbol, so a symbol
// that only changes every 20-90s (BTC/ETH's real feed) ends up with
// many consecutive frames holding the exact same value. Plotted
// as-is, that reads as "flat line, occasional jump" — technically
// accurate but visually poor. This collapses those runs down to just
// the real transitions, so the chart's own curve smoothing draws a
// natural line BETWEEN real data points instead of a flat-then-jump
// stair-step. Nothing here changes or invents a price — it only
// removes redundant repeats of the same real value.
export function dedupeSeriesForSymbol(history, symbol) {
  const result = []
  let lastValue = null
  history.forEach((point, i) => {
    const value = point[symbol]
    if (value == null) return
    const isLast = i === history.length - 1
    if (value !== lastValue || isLast) {
      result.push(point)
      lastValue = value
    }
  })
  return result
}

// Buckets an already-deduped series into OHLC candles. bucketSize is
// "how many real transitions per candle" now, not "how many raw
// ticks" — since the series passed in should already be deduped,
// every bucket represents that many genuine price changes.
export function bucketToCandles(deduped, symbol, bucketSize) {
  const values = deduped.map((point) => point[symbol]).filter((v) => v != null)
  const candles = []
  for (let i = 0; i < values.length; i += bucketSize) {
    const chunk = values.slice(i, i + bucketSize)
    if (chunk.length === 0) continue
    candles.push({
      open: chunk[0],
      close: chunk[chunk.length - 1],
      high: Math.max(...chunk),
      low: Math.min(...chunk)
    })
  }
  return candles
}

// A tight Y-axis domain around the actual visible range, with a
// small padding — recharts' 'auto' often over-pads, which is part of
// why small real moves can look flatter than they are.
export function tightDomain(values, paddingPercent = 0.15) {
  if (!values || values.length === 0) return ['auto', 'auto']
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || max * 0.01 || 1
  const pad = range * paddingPercent
  return [min - pad, max + pad]
}
