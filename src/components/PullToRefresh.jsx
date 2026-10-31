import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

const TRIGGER = 64 // how far (px) you have to pull before letting go refreshes

// Pull down at the very top of a page on a phone to refetch balances,
// sessions and trades. It ignores touches that start on things that scroll or
// are dragged on their own (charts, carousels, chat, inputs, open menus).
export default function PullToRefresh() {
  const { refreshAll } = useApp()
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const pullRef = useRef(0)
  const busyRef = useRef(false)
  const refreshRef = useRef(refreshAll)
  refreshRef.current = refreshAll

  useEffect(() => {
    const touch = { y0: null, x0: 0, active: false }
    const blocked = 'input,textarea,select,.pg-tiers,.recharts-wrapper,.chat-thread,.pg-filters,.dz-ticks,.sidebar,.m-sheet,.dropdown-panel,.candles'

    function reset() { touch.y0 = null; touch.active = false }
    function setBoth(v) { pullRef.current = v; setPull(v) }

    function onStart(e) {
      if (!window.matchMedia('(max-width: 900px)').matches) return
      if (busyRef.current || window.scrollY > 0 || document.body.style.overflow === 'hidden') return
      if (e.target.closest && e.target.closest(blocked)) return
      touch.y0 = e.touches[0].clientY
      touch.x0 = e.touches[0].clientX
      touch.active = false
    }
    function onMove(e) {
      if (touch.y0 == null) return
      const dy = e.touches[0].clientY - touch.y0
      const dx = Math.abs(e.touches[0].clientX - touch.x0)
      if (!touch.active) {
        if (dy > 10 && dy > dx * 1.5) touch.active = true
        else if (dy < -4 || dx > Math.max(dy, 0)) { reset(); return }
      }
      if (touch.active) {
        if (window.scrollY > 0) { reset(); setBoth(0); return }
        setBoth(Math.min(96, dy * 0.5))
      }
    }
    async function onEnd() {
      const wasActive = touch.active
      reset()
      if (!wasActive) return
      if (pullRef.current >= TRIGGER) {
        busyRef.current = true
        setBusy(true)
        setBoth(TRIGGER)
        const started = Date.now()
        try { await refreshRef.current() } catch { /* the page keeps its old data */ }
        const wait = Math.max(0, 700 - (Date.now() - started)) // keep the spinner long enough to notice
        setTimeout(() => { busyRef.current = false; setBusy(false); setBoth(0) }, wait)
      } else {
        setBoth(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (pull === 0 && !busy) return null
  const ready = pull >= TRIGGER
  return (
    <div className="ptr" style={{ transform: `translate(-50%, ${pull - 44}px)`, opacity: Math.min(1, pull / 40) }} aria-live="polite">
      <div className={'ptr-dot' + (ready || busy ? ' ready' : '')}>
        <RefreshCw size={18} className={busy ? 'spin' : ''} style={busy ? undefined : { transform: `rotate(${pull * 4}deg)` }} />
      </div>
      <span className="ptr-text">{busy ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}</span>
    </div>
  )
}
