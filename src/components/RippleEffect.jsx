import { useEffect } from 'react'

// A single click listener at the root, instead of wiring ripple logic
// into every button across the app. Any element matching these
// classes gets the effect automatically, including ones added later.
export default function RippleEffect() {
  useEffect(() => {
    function handleClick(e) {
      const target = e.target.closest('.tx-btn, .btn-primary, .icon-btn')
      if (!target || target.disabled) return

      const rect = target.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height)
      const ripple = document.createElement('span')
      ripple.className = 'ripple-effect'
      ripple.style.width = ripple.style.height = `${size}px`
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`

      if (getComputedStyle(target).position === 'static') {
        target.style.position = 'relative'
      }
      target.style.overflow = 'hidden'
      target.appendChild(ripple)
      ripple.addEventListener('animationend', () => ripple.remove())
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}
