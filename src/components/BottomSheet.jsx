import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// A phone-style sheet that slides up from the bottom. Close it by tapping the
// dark backdrop, pressing Escape, or dragging the handle down. It is rendered
// through a portal for the same reason Modal.jsx is (see the note there).
export default function BottomSheet({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const [dragY, setDragY] = useState(0)
  const startY = useRef(null)

  // Mount first, then flip "shown" on the next frame so the slide-up animates.
  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 240)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!mounted) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [mounted, onClose])

  if (!mounted) return null

  function onTouchStart(e) { startY.current = e.touches[0].clientY }
  function onTouchMove(e) {
    if (startY.current == null) return
    setDragY(Math.max(0, e.touches[0].clientY - startY.current))
  }
  function onTouchEnd() {
    const close = dragY > 90
    startY.current = null
    setDragY(0)
    if (close) onClose()
  }

  return createPortal(
    <div className={'m-sheet-backdrop' + (shown ? ' in' : '')} onClick={onClose}>
      <div
        className="m-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div className="m-sheet-grab" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="m-sheet-handle" />
          {title && <h2 className="m-sheet-title">{title}</h2>}
        </div>
        <div className="m-sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}
