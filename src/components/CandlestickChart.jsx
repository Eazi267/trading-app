import { useEffect, useRef, useState } from 'react'

function formatAxisPrice(n) {
  const digits = n > 100 ? 2 : 4
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// Recharts has no built-in candlestick chart type, so this draws one
// directly with SVG — each candle is a wick (high-low line) plus a
// body (open-close rectangle), colored by whether the instrument
// closed above or below where it opened. A right-side price axis
// with gridlines and a dashed current-price line are added on top,
// matching the layout convention most trading platforms use — price
// scale on the right, not the left.
//
// The chart measures its own width, so the price axis always sits at
// the right edge and the candles always fill the space — however wide
// the container is, and however few candles there are. With little
// history the newest candles sit at the right and the left stays
// empty, the way a real trading chart does while data accumulates.
// Nothing is invented to fill that space.
export default function CandlestickChart({ candles, height = 320 }) {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(640)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const measure = () => setWidth(Math.max(240, el.clientWidth))
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (!candles || candles.length === 0) {
    return (
      <div ref={wrapRef}>
        <div className="empty-state">
          <p>Not enough price history yet — check back in a few seconds.</p>
        </div>
      </div>
    )
  }

  const axisWidth = 64
  const padding = 16
  const plotWidth = Math.max(120, width - axisWidth)
  const minSlots = 40
  const slots = Math.max(candles.length, minSlots)
  const slotWidth = plotWidth / slots
  const bodyWidth = Math.max(2, Math.min(slotWidth * 0.62, 12))
  const startX = plotWidth - candles.length * slotWidth

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
  const tagY = y(currentPrice)

  return (
    <div ref={wrapRef}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }} role="img" aria-label="Candlestick price chart">
        {gridPrices.map((price) => (
          <g key={price}>
            <line x1={0} x2={plotWidth} y1={y(price)} y2={y(price)} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 4" />
            <text x={plotWidth + 8} y={y(price) + 4} fontSize={10.5} style={{ fill: 'var(--text-muted)' }}>
              {formatAxisPrice(price)}
            </text>
          </g>
        ))}

        {candles.map((c, i) => {
          const x = startX + i * slotWidth + slotWidth / 2
          const isUp = c.close >= c.open
          const color = isUp ? 'var(--success)' : 'var(--danger)'
          const bodyTop = y(Math.max(c.open, c.close))
          const bodyBottom = y(Math.min(c.open, c.close))
          const bodyHeight = Math.max(1, bodyBottom - bodyTop)
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1.5} />
              <rect x={x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
            </g>
          )
        })}

        <line x1={0} x2={plotWidth} y1={tagY} y2={tagY} stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" />
        <rect x={plotWidth + 2} y={tagY - 9} width={axisWidth - 4} height={18} rx={4} style={{ fill: 'var(--accent)' }} />
        <text x={plotWidth + 8} y={tagY + 4} fontSize={10.5} fontWeight={700} style={{ fill: 'var(--on-accent, #fff)' }}>
          {formatAxisPrice(currentPrice)}
        </text>
      </svg>
    </div>
  )
}
