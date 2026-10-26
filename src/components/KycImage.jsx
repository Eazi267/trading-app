import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client.js'

// Shows one KYC document image. The picture is NOT part of the user record any
// more: it is fetched here, on demand, from GET /api/kyc/:userId/image/:slot,
// which checks permission and (for admins) writes an audit entry.
export default function KycImage({ userId, slot, alt, style }) {
  const [src, setSrc] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setSrc(null); setError('')
    apiRequest(`/api/kyc/${userId}/image/${slot}`).then((r) => {
      if (cancelled) return
      if (r.dataUrl) setSrc(r.dataUrl)
      else setError(r.error || 'Could not load this image.')
    })
    return () => { cancelled = true }
  }, [userId, slot])

  if (error) return <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>
  if (!src) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
  return <img src={src} alt={alt} style={style} />
}
