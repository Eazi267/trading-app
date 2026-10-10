import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'

// Password input with a show/hide toggle. Extra props (value, onChange,
// autoComplete, required, minLength...) pass straight to the <input>.
// variant="plain": just input + toggle (used in Settings, where the
// parent supplies its own styling via `style`). Default: matches the
// Login/Signup field look (lock icon inside .field-input-wrap).
export default function PasswordField({ variant = 'default', style, ...inputProps }) {
  const [visible, setVisible] = useState(false)
  const type = visible ? 'text' : 'password'

  const toggle = (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      aria-label={visible ? 'Hide password' : 'Show password'}
      title={visible ? 'Hide password' : 'Show password'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'inherit',
        opacity: 0.7,
        display: 'inline-flex',
        padding: 4,
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)'
      }}
    >
      {/* The page CSS pins every svg inside .field-input-wrap to the left edge; override it for this icon only. */}
      {visible
        ? <EyeOff size={16} style={{ position: 'static', transform: 'none' }} />
        : <Eye size={16} style={{ position: 'static', transform: 'none' }} />}
    </button>
  )

  if (variant === 'plain') {
    return (
      <div style={{ position: 'relative' }}>
        <input {...inputProps} type={type} style={{ ...style, paddingRight: 36 }} />
        {toggle}
      </div>
    )
  }

  return (
    <div className="field-input-wrap">
      <Lock size={16} />
      <input {...inputProps} type={type} style={{ ...style, paddingRight: 36 }} />
      {toggle}
    </div>
  )
}
