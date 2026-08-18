import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Rendered via a portal straight to <body>, not inline where it's
// called. Reason: Layout.jsx wraps every page in a div with the
// `fade-in-up` animation class, which animates `transform`. Once
// that animation settles, the div is left with `transform:
// translateY(0)` — and ANY non-none transform on an ancestor makes
// it the containing block for descendant `position: fixed`
// elements, per the CSS spec. Without the portal, this modal's
// "fixed to the viewport" positioning was actually resolving
// relative to that page-content div instead — which is exactly why
// it rendered anchored inline in the page rather than centered over
// the whole screen. The portal sidesteps the whole problem by
// leaving that DOM subtree entirely.
export default function Modal({ open, onClose, title, description, children }) {
  if (!open) return null

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, zIndex: 200
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
          width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 22px 0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
            {description && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, flex: 'none' }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>,
    document.body
  )
}
