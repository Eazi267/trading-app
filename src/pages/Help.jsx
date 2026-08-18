import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import PublicNav from '../components/PublicNav.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

function QAItem({ qa }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 0' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', color: 'var(--text)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left' }}
      >
        {qa.question}
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flex: 'none' }} />
      </button>
      {open && <p style={{ marginTop: 10, fontSize: 13.5, color: 'var(--text-secondary)' }}>{qa.answer}</p>}
    </div>
  )
}

export default function Help() {
  const { settings } = useSettings()

  return (
    <div className="home">
      <PublicNav />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        <h1 className="page-title">Help</h1>
        {settings.helpQA.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No help articles added yet.</p>
        ) : (
          <div>
            {settings.helpQA.map((qa) => <QAItem key={qa.id} qa={qa} />)}
          </div>
        )}
      </div>
    </div>
  )
}
