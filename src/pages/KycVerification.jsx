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
        <header className="dz-head"><h1 className="dz-title">Verification</h1></header>
        <div className="dz-card"><div className="dz-empty">Identity verification isn't required on this platform right now.</div></div>
      </Layout>
    )
  }

  // One shared look for "where is my review at" on both checks.
  const StatusBlock = ({ record, title }) => (
    <div className={'kv-status kv-' + record.status}>
      <div className="kv-status-icon">
        {record.status === 'verified' ? <CheckCircle2 size={20} /> : record.status === 'rejected' ? <XCircle size={20} /> : <Clock3 size={20} />}
      </div>
      <div>
        <strong>{title}: <span style={{ textTransform: 'capitalize' }}>{record.status === 'pending' ? 'In review' : record.status}</span></strong>
        <div className="dz-muted">
          {record.documentType ? `${DOC_LABELS[record.documentType] || record.documentType} submitted ` : 'Submitted '}
          {new Date(record.submittedAt).toLocaleDateString()}
        </div>
        {record.status === 'rejected' && record.reviewNote && <div className="kv-reason">Reason: {record.reviewNote}</div>}
        {record.status === 'verified' && <div className="kv-ok">Verified by {record.reviewedByName}{record.reviewedAt ? ` on ${new Date(record.reviewedAt).toLocaleDateString()}` : ''}</div>}
      </div>
    </div>
  )

  const idDone = kyc?.status === 'verified'
  const stepClass = (done, active) => 'kv-step' + (done ? ' done' : active ? ' active' : '')

  return (
    <Layout pageTitle="Verification">
      <header className="dz-head">
        <h1 className="dz-title">Identity verification</h1>
        <div className="dz-muted">Verify your identity with a government-issued document. Your account manager reviews it; nothing is processed automatically.</div>
      </header>

      <div className="dz-grid kv-grid">
        <div className="dz-main">
          {kyc && <div className="dz-card"><StatusBlock record={kyc} title="Identity" /></div>}

          {(!kyc || kyc.status === 'rejected') && (
            <div className="dz-card">
              <div className="dz-card-head"><h3><ShieldCheck size={15} className="st-ico" />{kyc ? 'Resubmit document' : 'Submit document'}</h3></div>
              <div className="kv-form">
                <label className="st-f">
                  <span className="pg-label">Document type</span>
                  <select className="pg-field" value={documentType} onChange={(e) => { setDocumentType(e.target.value); setBackImage(null) }}>
                    {acceptedTypes.map((t) => <option key={t} value={t}>{DOC_LABELS[t] || t}</option>)}
                  </select>
                </label>

                <FileDropInput label="Front of document" value={frontImage} onFile={async (file) => setFrontImage(await readAsDataUrl(file))} onClear={() => setFrontImage(null)} />

                {needsBackSide && (
                  <FileDropInput label="Back of document" value={backImage} onFile={async (file) => setBackImage(await readAsDataUrl(file))} onClear={() => setBackImage(null)} />
                )}

                {error && <div className="form-error">{error}</div>}

                <button className="btn-primary pg-start-btn" style={{ marginTop: 0 }} onClick={handleSubmit}>
                  <Upload size={14} /> Submit for review
                </button>
              </div>
            </div>
          )}

          {bankAvailable && idDone && (
            <div className="dz-card">
              <div className="dz-card-head"><h3><ShieldCheck size={15} className="st-ico" />Enhanced verification</h3></div>
              <p className="dz-muted st-hint" style={{ marginTop: 0 }}>
                Required only if you want to withdraw to a bank account. Upload a proof of address: a recent utility bill or bank statement showing your name and address.
              </p>
              {kycEnhanced && <StatusBlock record={kycEnhanced} title="Address" />}
              {(!kycEnhanced || kycEnhanced.status === 'rejected') && (
                <div className="kv-form" style={{ marginTop: kycEnhanced ? 14 : 4 }}>
                  <FileDropInput label="Proof of address" value={enhancedImage} onFile={async (file) => setEnhancedImage(await readAsDataUrl(file))} onClear={() => setEnhancedImage(null)} />
                  {enhancedError && <div className="form-error">{enhancedError}</div>}
                  <button className="btn-primary pg-start-btn" style={{ marginTop: 0 }} onClick={handleSubmitEnhanced}>
                    <Upload size={14} /> Submit for review
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="dz-side">
          <div className="dz-card">
            <div className="dz-card-head"><h3>Your progress</h3></div>
            <ol className="kv-steps">
              <li className={stepClass(!!kyc, !kyc)}><b>1</b><span>Upload your ID or passport</span></li>
              <li className={stepClass(idDone, !!kyc && !idDone)}><b>2</b><span>Review by your account manager</span></li>
              {bankAvailable && <li className={stepClass(kycEnhanced?.status === 'verified', idDone && kycEnhanced?.status !== 'verified')}><b>3</b><span>Proof of address (bank withdrawals only)</span></li>}
            </ol>
          </div>
          <div className="dz-note">
            <ShieldCheck size={16} />
            <span>Documents are only used to confirm who you are. Make sure all four corners are visible and the text is readable.</span>
          </div>
        </aside>
      </div>
    </Layout>
  )
}
