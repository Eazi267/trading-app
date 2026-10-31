import { useCallback, useEffect, useRef, useState } from 'react'
import { MailCheck } from 'lucide-react'
import Modal from './Modal.jsx'
import { apiRequest, setOtpHandler } from '../api/client.js'

const WHAT = {
  withdrawal: 'your withdrawal request', deposit: 'your deposit request', wallet: 'saving your withdrawal wallet',
  session: 'starting your investment session', password: 'changing your password'
}

// Mounted once (in App). When the server asks for an emailed confirmation code,
// api/client.js calls the handler registered here; we show this dialog, wait for
// the code, and hand it back so the original request can be repeated.
export default function OtpHost() {
  const [info, setInfo] = useState(null)   // { operation, message, wrongCode } while open
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const resolver = useRef(null)

  useEffect(() => {
    setOtpHandler((request) => new Promise((resolve) => {
      resolver.current = resolve
      setCode(''); setNote('')
      setInfo(request)
    }))
    return () => setOtpHandler(null)
  }, [])

  const finish = useCallback((value) => {
    const r = resolver.current
    resolver.current = null
    setInfo(null)
    r?.(value)
  }, [])

  async function resend() {
    setNote(''); setBusy(true)
    const r = await apiRequest('/api/otp/resend', { method: 'POST', body: { operation: info.operation } })
    setBusy(false)
    setNote(r.error || 'A new code is on its way.')
  }

  return (
    <Modal open={!!info} onClose={() => finish(null)} title="Confirm with a code" description={info ? `We emailed a 6-digit code to confirm ${WHAT[info.operation] || 'this action'}. It works for 15 minutes.` : ''}>
      {info && (
        <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) finish(code.trim()) }}>
          <div className="ve-icon" style={{ margin: '0 auto 12px' }}><MailCheck size={24} /></div>
          {info.wrongCode && <div className="form-error" style={{ textAlign: 'left' }}>{info.message}</div>}
          {note && <p className="st-ok">{note}</p>}
          <input className="ve-code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" aria-label="6-digit code" />
          <button type="submit" className="btn-primary pg-start-btn" disabled={!code.trim()}>Confirm</button>
          <button type="button" className="dz-btn-o ve-resend" onClick={resend} disabled={busy}>Send me a new code</button>
          <button type="button" className="dz-btn-o ve-resend" onClick={() => finish(null)}>Cancel</button>
        </form>
      )}
    </Modal>
  )
}
