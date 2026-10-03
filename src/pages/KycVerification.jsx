import { useState } from 'react'
import { ShieldCheck, Upload, Clock3, CheckCircle2, XCircle } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import FileDropInput from '../components/FileDropInput.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

const DOC_LABELS = { passport: 'Passport', id: 'National ID' }

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function KycVerification() {
  const { currentUser, submitKycDocument, submitEnhancedKyc } = useAuth()
  const { settings } = useSettings()
  const acceptedTypes = settings.kycAcceptedDocumentTypes.length ? settings.kycAcceptedDocumentTypes : ['passport', 'id']
  const [documentType, setDocumentType] = useState(acceptedTypes[0])
  const [frontImage, setFrontImage] = useState(null)
  const [backImage, setBackImage] = useState(null)
  const [error, setError] = useState('')
  const [enhancedImage, setEnhancedImage] = useState(null)
  const [enhancedError, setEnhancedError] = useState('')

  const kyc = currentUser.kyc
  const kycEnhanced = currentUser.kycEnhanced
  // Passports don't have a meaningful "back" — that's true regardless
  // of the admin's kycRequireBackSide setting, which only ever
  // applies to two-sided documents like a national ID.
  const needsBackSide = settings.kycRequireBackSide && documentType !== 'passport'

  async function handleSubmit() {
    setError('')
    if (!frontImage) return setError(`Upload the front of your ${DOC_LABELS[documentType] || documentType}.`)
    if (needsBackSide && !backImage) return setError('Upload the back of your document too.')

    const result = await submitKycDocument({ documentType, frontImageDataUrl: frontImage, backImageDataUrl: needsBackSide ? backImage : null })
    if (result.error) return setError(result.error)
    setFrontImage(null)
    setBackImage(null)
  }

  async function handleSubmitEnhanced() {
    setEnhancedError('')
    if (!enhancedImage) return setEnhancedError('Upload a proof of address document.')
    const result = await submitEnhancedKyc({ frontImageDataUrl: enhancedImage })
    if (result.error) return setEnhancedError(result.error)
    setEnhancedImage(null)
  }

  const bankAvailable = settings.withdrawalMethods?.bank
  if (!settings.kycEnabled && !currentUser.kycRequired && !bankAvailable) {
    return (
      <Layout pageTitle="Verification">
        <h1 className="page-title">Verification</h1>
        <div className="panel">
          <div className="empty-state"><p>Identity verification isn't required on this platform right now.</p></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout pageTitle="Verification">
      <h1 className="page-title">Identity verification</h1>
      <p className="page-sub">Verify your identity with a government-issued document. This is reviewed by your account manager, not processed automatically.</p>

      {kyc && (
        <div className="panel" style={{ maxWidth: 520, marginBottom: 16 }}>
          <div className="panel-head"><h3>Current status</h3></div>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div className="icon-badge" style={
              kyc.status === 'verified' ? { background: 'var(--success-bg)', color: 'var(--success)' }
              : kyc.status === 'rejected' ? { background: 'var(--danger-bg)', color: 'var(--danger)' }
              : {}
            }>
              {kyc.status === 'verified' ? <CheckCircle2 size={18} /> : kyc.status === 'rejected' ? <XCircle size={18} /> : <Clock3 size={18} />}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14.5, textTransform: 'capitalize' }}>{kyc.status}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {DOC_LABELS[kyc.documentType] || kyc.documentType} submitted {new Date(kyc.submittedAt).toLocaleDateString()}
              </div>
              {kyc.status === 'rejected' && kyc.reviewNote && (
                <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 6 }}>Reason: {kyc.reviewNote}</div>
              )}
              {kyc.status === 'verified' && (
                <div style={{ fontSize: 12.5, color: 'var(--success)', marginTop: 6 }}>Verified by {kyc.reviewedByName} on {new Date(kyc.reviewedAt).toLocaleDateString()}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {(!kyc || kyc.status === 'rejected') && (
        <div className="panel" style={{ maxWidth: 520 }}>
          <div className="panel-head"><h3><ShieldCheck size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{kyc ? 'Resubmit document' : 'Submit document'}</h3></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Document type
              <select
                value={documentType}
                onChange={(e) => { setDocumentType(e.target.value); setBackImage(null) }}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5 }}
              >
                {acceptedTypes.map((t) => <option key={t} value={t}>{DOC_LABELS[t] || t}</option>)}
              </select>
            </label>

            <FileDropInput
              label="Front of document"
              value={frontImage}
              onFile={async (file) => setFrontImage(await readAsDataUrl(file))}
              onClear={() => setFrontImage(null)}
            />

            {needsBackSide && (
              <FileDropInput
                label="Back of document"
                value={backImage}
                onFile={async (file) => setBackImage(await readAsDataUrl(file))}
                onClear={() => setBackImage(null)}
              />
            )}

            {error && <div className="form-error">{error}</div>}

            <button className="tx-btn deposit" style={{ padding: '9px 16px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }} onClick={handleSubmit}>
              <Upload size={14} /> Submit for review
            </button>
          </div>
        </div>
      )}

      {bankAvailable && kyc?.status === 'verified' && (
        <div className="panel" style={{ maxWidth: 520, marginTop: 16 }}>
          <div className="panel-head"><h3><ShieldCheck size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Enhanced verification</h3></div>
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0 }}>
              Required only if you want to withdraw to a bank account. Upload a proof of address — a recent
              utility bill or bank statement showing your name and address.
            </p>

            {kycEnhanced ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: kycEnhanced.status === 'rejected' ? 16 : 0 }}>
                <div className="icon-badge" style={
                  kycEnhanced.status === 'verified' ? { background: 'var(--success-bg)', color: 'var(--success)' }
                  : kycEnhanced.status === 'rejected' ? { background: 'var(--danger-bg)', color: 'var(--danger)' }
                  : {}
                }>
                  {kycEnhanced.status === 'verified' ? <CheckCircle2 size={18} /> : kycEnhanced.status === 'rejected' ? <XCircle size={18} /> : <Clock3 size={18} />}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5, textTransform: 'capitalize' }}>{kycEnhanced.status}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    Submitted {new Date(kycEnhanced.submittedAt).toLocaleDateString()}
                  </div>
                  {kycEnhanced.status === 'rejected' && kycEnhanced.reviewNote && (
                    <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 6 }}>Reason: {kycEnhanced.reviewNote}</div>
                  )}
                  {kycEnhanced.status === 'verified' && (
                    <div style={{ fontSize: 12.5, color: 'var(--success)', marginTop: 6 }}>Verified by {kycEnhanced.reviewedByName}</div>
                  )}
                </div>
              </div>
            ) : null}

            {(!kycEnhanced || kycEnhanced.status === 'rejected') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: kycEnhanced ? 0 : 4 }}>
                <FileDropInput
                  label="Proof of address"
                  value={enhancedImage}
                  onFile={async (file) => setEnhancedImage(await readAsDataUrl(file))}
                  onClear={() => setEnhancedImage(null)}
                />
                {enhancedError && <div className="form-error">{enhancedError}</div>}
                <button className="tx-btn deposit" style={{ padding: '9px 16px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }} onClick={handleSubmitEnhanced}>
                  <Upload size={14} /> Submit for review
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
