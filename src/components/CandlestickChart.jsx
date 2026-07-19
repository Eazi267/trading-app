function formatAxisPrice(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: n > 100 ? 2 : 4 })
}

// Recharts has no built-in candlestick chart type, so this draws one
// directly with SVG — each candle is a wick (high-low line) plus a
// body (open-close rectangle), colored by whether the instrument
// closed above or below where it opened. A right-side price axis
// with gridlines and a dashed current-price line are added on top,
// matching the layout convention most trading platforms (MT5
// included) use — price scale on the right, not the left.
export default function CandlestickChart({ candles, height = 320 }) {
  if (!candles || candles.length === 0) {
    return (
      <div className="empty-state">
        <p>Not enough price history yet — check back in a few seconds.</p>
      </div>
    )
  }

  const candleWidth = 16
  const axisWidth = 64
  const chartWidth = Math.max(candles.length * candleWidth, 200)
  const width = chartWidth + axisWidth
  const padding = 16
  const allValues = candles.flatMap((c) => [c.high, c.low])
  const max = Math.max(...allValues)
  const min = Math.min(...allValues)
  const range = max - min || max * 0.01 || 1
  const paddedMax = max + range * 0.08
  const paddedMin = min - range * 0.08
  const paddedRange = paddedMax - paddedMin

  function y(price) {
    return padding + (1 - (price - paddedMin) / paddedRange) * (height - padding * 2)
  }

  const currentPrice = candles[candles.length - 1].close
  const gridLevels = 5
  const gridPrices = Array.from({ length: gridLevels }, (_, i) => paddedMin + (paddedRange * i) / (gridLevels - 1))

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {gridPrices.map((price) => (
          <line
            key={price}
            x1={0} x2={chartWidth}
            y1={y(price)} y2={y(price)}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}

        {candles.map((c, i) => {
          const x = i * candleWidth + candleWidth / 2
          const isUp = c.close >= c.open
          const color = isUp ? 'var(--success)' : 'var(--danger)'
          const bodyTop = y(Math.max(c.open, c.close))
          const bodyBottom = y(Math.min(c.open, c.close))
          const bodyHeight = Math.max(1, bodyBottom - bodyTop)
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1.5} />
              <rect x={x - 5} y={bodyTop} width={10} height={bodyHeight} fill={color} />
            </g>
          )
        })}

        <line
          x1={0} x2={chartWidth}
          y1={y(currentPrice)} y2={y(currentPrice)}
          stroke="var(--accent-bright)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      </svg>

      <div style={{ position: 'relative', marginTop: -height, height, width: axisWidth, marginLeft: chartWidth, pointerEvents: 'none' }}>
        {gridPrices.map((price) => (
          <div
            key={price}
            style={{ position: 'absolute', top: y(price) - 7, left: 6, fontSize: 10.5, color: 'var(--text-muted)' }}
          >
            {formatAxisPrice(price)}
          </div>
        ))}
        <div
          style={{
            position: 'absolute', top: y(currentPrice) - 8, left: 4, fontSize: 10.5, fontWeight: 700,
            color: '#fff', background: 'var(--accent-bright)', padding: '2px 6px', borderRadius: 4
          }}
        >
          {formatAxisPrice(currentPrice)}
        </div>
      </div>
    </div>
  )
}
