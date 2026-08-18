import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Drop-in replacement for the .panel + .panel-head pattern used
// everywhere in the admin pages, for sections whose content can grow
// long (trade history, transaction history, session history). The
// header stays visible and clickable either way — only the body
// collapses — so the count is always visible even when closed.
export default function CollapsiblePanel({ title, count, defaultOpen = false, headerExtra, children, style }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="panel" style={style}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          all: 'unset', cursor: 'pointer', width: '100%', boxSizing: 'border-box',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: open ? '1px solid var(--border)' : 'none'
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          {title}
          {count != null && (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 8px' }}>
              {count}
            </span>
          )}
        </h3>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {headerExtra}
          <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', color: 'var(--text-muted)' }} />
        </span>
      </button>
      {open && children}
    </div>
  )
}

// Caps a list's initial render length with a "Show N more" control —
// used inside an already-open CollapsiblePanel so a client with
// hundreds of trades doesn't render (or force-scroll past) all of
// them at once.
export function useShowMore(totalLength, step = 10) {
  const [limit, setLimit] = useState(step)
  return {
    limit,
    hasMore: limit < totalLength,
    showMore: () => setLimit((l) => l + step),
    reset: () => setLimit(step)
  }
}
