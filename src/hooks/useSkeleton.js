import { useEffect, useState } from 'react'

// A brief, deliberate loading state on mount — not hiding real
// latency (this app has none, it's all local state), just giving
// data-heavy pages a moment of skeleton before revealing real numbers,
// the way most polished dashboards do.
export function useSkeleton(delayMs = 500) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])
  return loading
}
