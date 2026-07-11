import { useEffect, useRef, useState } from 'react'

// Animates a number counting up (or down) to `target` whenever it
// changes, instead of just snapping to the new value. Runs on plain
// requestAnimationFrame — no animation library needed for this.
// Used anywhere a stat card shows a number that updates live.
export function useCountUp(target, durationMs = 600) {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef(null)

  useEffect(() => {
    const from = fromRef.current
    const to = target
    if (from === to || Number.isNaN(to)) {
      setDisplay(to)
      return
    }

    const start = performance.now()
    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / durationMs)
      // Ease-out so the count settles smoothly instead of stopping abruptly.
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (to - from) * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return display
}
