// Recharts has no built-in candlestick chart type, so this draws one
// directly with SVG — each candle is a wick (high-low line) plus a
// body (open-close rectangle), colored by whether the instrument
// closed above or below where it opened. Pure presentational
// component: it just draws whatever OHLC candles it's given.
export default function CandlestickChart({ candles, height = 240 }) {
  if (!candles || candles.length === 0) {
    return (
      <div className="empty-state">
        <p>Not enough price history yet — check back in a few seconds.</p>
      </div>
    )
  }

  const candleWidth = 14
  const width = Math.max(candles.length * candleWidth, 200)
  const padding = 12
  const allValues = candles.flatMap((c) => [c.high, c.low])
  const max = Math.max(...allValues)
  const min = Math.min(...allValues)
  const range = max - min || max * 0.01 || 1

  function y(price) {
    return padding + (1 - (price - min) / range) * (height - padding * 2)
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {candles.map((c, i) => {
          const x = i * candleWidth + candleWidth / 2
          const isUp = c.close >= c.open
          const color = isUp ? 'var(--success)' : 'var(--danger)'
          const bodyTop = y(Math.max(c.open, c.close))
          const bodyBottom = y(Math.min(c.open, c.close))
          const bodyHeight = Math.max(1, bodyBottom - bodyTop)
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1} />
              <rect x={x - 4} y={bodyTop} width={8} height={bodyHeight} fill={color} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
