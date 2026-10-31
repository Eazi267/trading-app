import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import Modal from './Modal.jsx'
import ToggleSwitch from './ToggleSwitch.jsx'
import { getConsent, saveConsent, clearPreferenceStorage } from '../utils/consent.js'

// Bottom banner until the person chooses; "Cookie settings" (footer) reopens the details.
export default function CookieConsent() {
  const [chosen, setChosen] = useState(() => !!getConsent())
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState(() => getConsent()?.preferences ?? false)

  useEffect(() => {
    const show = () => { setPrefs(getConsent()?.preferences ?? false); setOpen(true) }
    window.addEventListener('pulse:open-cookie-settings', show)
    return () => window.removeEventListener('pulse:open-cookie-settings', show)
  }, [])

  function choose(allowPrefs) {
    if (!allowPrefs) clearPreferenceStorage()
    saveConsent(allowPrefs)
    setChosen(true); setOpen(false)
  }

  return (
    <>
      {!chosen && (
        <div className="ck-banner" role="region" aria-label="Cookie consent">
          <span className="ck-ico"><Cookie size={18} /></span>
          <p>We use essential cookies to keep you signed in. With your permission we also remember your theme and favourites. <Link to="/cookies">Cookie policy</Link></p>
          <div className="ck-actions">
            <button type="button" className="dz-btn-o" onClick={() => choose(false)}>Essential only</button>
            <button type="button" className="dz-btn-o" onClick={() => { setPrefs(false); setOpen(true) }}>Customize</button>
            <button type="button" className="btn-primary" onClick={() => choose(true)}>Accept all</button>
          </div>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Cookie settings" description="Choose what this browser may remember. You can change this any time.">
        <div className="ck-row"><div><strong>Essential</strong><small>Sign-in session and security. Always on.</small></div><ToggleSwitch checked disabled onChange={() => {}} /></div>
        <div className="ck-row"><div><strong>Preferences</strong><small>Theme, colours, favourite pages and markets.</small></div><ToggleSwitch checked={prefs} onChange={setPrefs} /></div>
        <button type="button" className="btn-primary pg-start-btn" onClick={() => choose(prefs)}>Save choice</button>
      </Modal>
    </>
  )
}
