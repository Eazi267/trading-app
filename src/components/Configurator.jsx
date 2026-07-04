import { useState } from 'react'
import { Settings2, X, Moon, Sun } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

const ACCENTS = ['ember', 'rose', 'amber']

export default function Configurator() {
  const [open, setOpen] = useState(false)
  const { theme, setTheme, accent, setAccent } = useApp()

  return (
    <>
      <button className="configurator-trigger" onClick={() => setOpen(true)} aria-label="Open settings">
        <Settings2 size={18} />
      </button>

      {open && <div className="configurator-backdrop" onClick={() => setOpen(false)} />}

      <div className={'configurator-panel' + (open ? ' open' : '')}>
        <div className="configurator-head">
          <div>
            <h2>Configurator</h2>
            <p>Personalize how Pulse looks for you.</p>
          </div>
          <button className="configurator-close" onClick={() => setOpen(false)}><X size={16} /></button>
        </div>
        <div className="configurator-body">
          <div className="configurator-section">
            <h3>Mode</h3>
            <div className="mode-toggle">
              <button
                className={'mode-btn' + (theme === 'dark' ? ' active' : '')}
                onClick={() => setTheme('dark')}
              >
                <Moon size={14} /> Dark
              </button>
              <button
                className={'mode-btn' + (theme === 'light' ? ' active' : '')}
                onClick={() => setTheme('light')}
              >
                <Sun size={14} /> Light
              </button>
            </div>
          </div>
          <div className="configurator-section">
            <h3>Accent color</h3>
            <div className="accent-swatches">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  className={'accent-swatch swatch-' + a + (accent === a ? ' active' : '')}
                  onClick={() => setAccent(a)}
                  aria-label={a + ' accent'}
                />
              ))}
            </div>
          </div>
          <div className="configurator-note">Preferences are saved to this browser.</div>
        </div>
      </div>
    </>
  )
}