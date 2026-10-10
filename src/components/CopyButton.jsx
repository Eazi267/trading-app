import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

// Small icon button that copies `value` to the clipboard and shows a
// tick for 1.5s as confirmation. `label` is used for hover/screen-reader text.
export default function CopyButton({ value, label = 'Copy', size = 14, style }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(String(value ?? ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked (e.g. non-secure context) — fail quietly.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : label}
      aria-label={label}
      style={{
        background: 'none',
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        color: copied ? 'var(--accent-bright, currentColor)' : 'inherit',
        opacity: copied ? 1 : 0.7,
        display: 'inline-flex',
        verticalAlign: 'middle',
        ...style
      }}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}
