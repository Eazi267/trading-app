import { useState } from 'react'
import {
  Image, Info, Gift, DollarSign, ArrowDownToLine, ArrowUpFromLine, Mail,
  HelpCircle, FileText, Shield, Palette, Settings as SettingsIcon, ChevronRight, RotateCcw, ShieldCheck
} from 'lucide-react'
import Layout from '../components/Layout.jsx'
import Modal from '../components/Modal.jsx'
import { useSettings, LOGO_ICONS } from '../context/SettingsContext.jsx'
import { CURRENCIES } from '../config/currencies.js'

const inputStyle = { display: 'block', width: '100%', marginTop: 4, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5 }

const SAMPLE_ABOUT_HTML = `<h2>About Us</h2>
<p>We help account managers oversee client portfolios with a transparent, auditable record of every deposit, withdrawal, and result.</p>
<h2>Our approach</h2>
<p>Every balance is calculated from real transaction records — never a number typed in by hand. Session results are reviewed by a real account manager before they ever touch a client's balance.</p>
<p>Plain text works fine too — you don't need any tags at all if you'd rather just write it out.</p>`

const SAMPLE_PRIVACY_HTML = `<h2>Privacy Policy</h2>
<p>We collect only the information needed to manage your account: your name, email, and the documents you submit for identity verification.</p>
<h2>How we use it</h2>
<ul>
  <li>To manage your deposits, withdrawals, and sessions</li>
  <li>To verify your identity where required</li>
  <li>To contact you about your account</li>
</ul>
<p>We never sell your information to third parties.</p>`
const labelStyle = { fontSize: 12.5, color: 'var(--text-muted)' }

// One row in the settings list — icon, label, chevron. Tapping opens
// the matching modal. This is the "list of rows, each opens a
// focused dialog" pattern instead of one long page of stacked forms.
function SettingRow({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset', cursor: 'pointer', width: '100%', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '15px 18px', borderRadius: 14,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        marginBottom: 10, transition: 'border-color .15s var(--ease), transform .15s var(--ease)'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-dark)'; e.currentTarget.style.transform = 'translateX(2px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}
    >
      <div className="icon-badge"><Icon size={18} /></div>
      <span style={{ flex: 1, textAlign: 'left', fontSize: 14.5, fontWeight: 500 }}>{label}</span>
      <ChevronRight size={17} style={{ color: 'var(--accent-bright)' }} />
    </button>
  )
}

function ModalSaveButton({ onClick, saved, children = 'Save' }) {
  return (
    <div style={{ marginTop: 14 }}>
      <button className="tx-btn deposit" style={{ padding: '9px 16px', fontSize: 13.5 }} onClick={onClick}>
        {children}
      </button>
      {saved && <span style={{ marginLeft: 10, fontSize: 12.5, color: 'var(--success)' }}>Saved.</span>}
    </div>
  )
}

function useSavedFlag() {
  const [saved, setSaved] = useState(false)
  function flash() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  return [saved, flash]
}

export default function AdminBusinessSettings() {
  const { settings, updateSettings, resetSettings } = useSettings()
  const [openModal, setOpenModal] = useState(null) // which row's modal is open, or null

  // --- Brand + logo/favicon ---
  const [brandName, setBrandName] = useState(settings.brandName)
  const [brandTagline, setBrandTagline] = useState(settings.brandTagline)
  const [brandSaved, flashBrand] = useSavedFlag()
  function handleFileUpload(field, file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateSettings({ [field]: reader.result })
    reader.readAsDataURL(file)
  }

  // --- Company info ---
  const [companyInfo, setCompanyInfo] = useState({
    companyAddress: settings.companyAddress, companyPhone: settings.companyPhone,
    companyEmail: settings.companyEmail, metaTitle: settings.metaTitle, metaDescription: settings.metaDescription
  })
  const [companySaved, flashCompany] = useSavedFlag()

  // --- Signup bonus ---
  const [signupBonusAmount, setSignupBonusAmount] = useState(settings.signupBonusAmount)
  const [signupSaved, flashSignup] = useSavedFlag()

  // --- Currency ---

  // --- Deposit / withdrawal ---
  const [depositCfg, setDepositCfg] = useState({ depositMin: settings.depositMin, depositMax: settings.depositMax, depositInstructions: settings.depositInstructions })
  const [withdrawalCfg, setWithdrawalCfg] = useState({ withdrawalMin: settings.withdrawalMin, withdrawalMax: settings.withdrawalMax, withdrawalInstructions: settings.withdrawalInstructions })
  const [depositSaved, flashDeposit] = useSavedFlag()
  const [withdrawalSaved, flashWithdrawal] = useSavedFlag()

  // --- Welcome email ---
  const [emailCfg, setEmailCfg] = useState({
    welcomeEmailSubject: settings.welcomeEmailSubject, welcomeEmailBody: settings.welcomeEmailBody,
    emailFromName: settings.emailFromName, emailFromAddress: settings.emailFromAddress
  })
  const [emailSaved, flashEmail] = useSavedFlag()

  // --- Blockchain verification ---
  const [blockchainProviderName, setBlockchainProviderName] = useState(settings.blockchainProviderName)
  const [blockchainSaved, flashBlockchain] = useSavedFlag()

  // --- Help Q&A ---
  const [qaQuestion, setQaQuestion] = useState('')
  const [qaAnswer, setQaAnswer] = useState('')
  function handleAddQA() {
    if (!qaQuestion.trim() || !qaAnswer.trim()) return
    updateSettings({ helpQA: [...settings.helpQA, { id: Date.now(), question: qaQuestion.trim(), answer: qaAnswer.trim() }] })
    setQaQuestion(''); setQaAnswer('')
  }

  // --- About / Privacy ---
  const [aboutHtml, setAboutHtml] = useState(settings.aboutUsHtml)
  const [privacyHtml, setPrivacyHtml] = useState(settings.privacyPolicyHtml)
  const [aboutSaved, flashAbout] = useSavedFlag()
  const [privacySaved, flashPrivacy] = useSavedFlag()

  // --- Custom color ---
  const [customColor, setCustomColor] = useState(settings.customPrimaryColor || '#ea580c')

  const ROWS = [
    { key: 'logo', icon: Image, label: 'Setup site logo and icon' },
    { key: 'company', icon: Info, label: 'Edit company info' },
    { key: 'signup', icon: Gift, label: 'Signup bonus' },
    { key: 'currency', icon: DollarSign, label: 'Currency setup' },
    { key: 'deposit', icon: ArrowDownToLine, label: 'Deposit setup' },
    { key: 'withdrawal', icon: ArrowUpFromLine, label: 'Withdrawal setup' },
    { key: 'email', icon: Mail, label: 'Email settings' },
    { key: 'blockchain', icon: ShieldCheck, label: 'Blockchain verification' },
    { key: 'help', icon: HelpCircle, label: 'Edit help page' },
    { key: 'privacy', icon: Shield, label: 'Change privacy policy' },
    { key: 'about', icon: FileText, label: 'Edit about us page' },
    { key: 'color', icon: Palette, label: 'Edit site color' },
    { key: 'other', icon: SettingsIcon, label: 'Other setup' }
  ]

  return (
    <Layout pageTitle="Business Settings">
      <h1 className="page-title">Business Settings</h1>
      <p className="page-sub">
        These settings are what make one deployment of this platform different from another — all without
        touching any code.
      </p>

      <div style={{ maxWidth: 460 }}>
        {ROWS.map((row) => (
          <SettingRow key={row.key} icon={row.icon} label={row.label} onClick={() => setOpenModal(row.key)} />
        ))}
      </div>

      {/* ---------- Logo & icon ---------- */}
      <Modal open={openModal === 'logo'} onClose={() => setOpenModal(null)} title="Setup site logo and icon" description="Brand name, tagline, and the logo shown across the platform.">
        <label style={labelStyle}>
          Business name
          <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ ...labelStyle, display: 'block', marginTop: 12 }}>
          Tagline
          <input type="text" value={brandTagline} onChange={(e) => setBrandTagline(e.target.value)} style={inputStyle} />
        </label>

        <div style={{ marginTop: 14 }}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Logo mark (used unless a logo image is uploaded below)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(LOGO_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                onClick={() => updateSettings({ logoIconKey: key })}
                className="tx-btn"
                style={{
                  width: 40, height: 40, flex: 'none', padding: 0,
                  background: settings.logoIconKey === key ? 'var(--accent-bright)' : 'var(--bg)',
                  border: '1px solid ' + (settings.logoIconKey === key ? 'var(--accent-bright)' : 'var(--border)'),
                  color: settings.logoIconKey === key ? '#fff' : 'var(--text)'
                }}
                aria-label={key}
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
          <div>
            {settings.logoImageDataUrl && (
              <img src={settings.logoImageDataUrl} alt="Logo preview" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 6, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }} />
            )}
            <label style={labelStyle}>
              Logo image
              <input type="file" accept="image/*" onChange={(e) => handleFileUpload('logoImageDataUrl', e.target.files[0])} style={{ display: 'block', marginTop: 4, fontSize: 12 }} />
            </label>
          </div>
          <div>
            {settings.faviconDataUrl && (
              <img src={settings.faviconDataUrl} alt="Favicon preview" style={{ width: 32, height: 32, objectFit: 'contain', marginBottom: 6, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' }} />
            )}
            <label style={labelStyle}>
              Favicon
              <input type="file" accept="image/*" onChange={(e) => handleFileUpload('faviconDataUrl', e.target.files[0])} style={{ display: 'block', marginTop: 4, fontSize: 12 }} />
            </label>
          </div>
        </div>

        <ModalSaveButton
          onClick={() => { updateSettings({ brandName: brandName.trim() || settings.brandName, brandTagline: brandTagline.trim() }); flashBrand() }}
          saved={brandSaved}
        />
      </Modal>

      {/* ---------- Company info ---------- */}
      <Modal open={openModal === 'company'} onClose={() => setOpenModal(null)} title="Edit company info">
        <label style={labelStyle}>
          Company address
          <textarea rows={2} value={companyInfo.companyAddress} onChange={(e) => setCompanyInfo({ ...companyInfo, companyAddress: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Phone
            <input type="text" value={companyInfo.companyPhone} onChange={(e) => setCompanyInfo({ ...companyInfo, companyPhone: e.target.value })} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Email
            <input type="email" value={companyInfo.companyEmail} onChange={(e) => setCompanyInfo({ ...companyInfo, companyEmail: e.target.value })} style={inputStyle} />
          </label>
        </div>
        <label style={{ ...labelStyle, display: 'block', marginTop: 12 }}>
          Page title (meta head)
          <input type="text" value={companyInfo.metaTitle} onChange={(e) => setCompanyInfo({ ...companyInfo, metaTitle: e.target.value })} style={inputStyle} />
        </label>
        <label style={{ ...labelStyle, display: 'block', marginTop: 12 }}>
          Page description (meta head)
          <textarea rows={2} value={companyInfo.metaDescription} onChange={(e) => setCompanyInfo({ ...companyInfo, metaDescription: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
        <ModalSaveButton onClick={() => { updateSettings(companyInfo); flashCompany() }} saved={companySaved} />
      </Modal>

      {/* ---------- Signup bonus ---------- */}
      <Modal open={openModal === 'signup'} onClose={() => setOpenModal(null)} title="Signup bonus" description="A one-time real transaction granted per real client — same mechanism as the referral bonus.">
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.signupBonusEnabled} onChange={(e) => updateSettings({ signupBonusEnabled: e.target.checked })} style={{ marginTop: 3 }} />
          <span>
            <strong style={{ fontSize: 13.5 }}>Signup bonus enabled</strong>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Off by default — turn on once an amount is set below.</div>
          </span>
        </label>
        <label style={{ ...labelStyle, display: 'block', marginTop: 14 }}>
          Signup bonus amount (USD)
          <input type="number" min="0" step="1" value={signupBonusAmount} onChange={(e) => setSignupBonusAmount(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }} />
        </label>
        <ModalSaveButton onClick={() => { updateSettings({ signupBonusAmount: Math.max(0, Number(signupBonusAmount) || 0) }); flashSignup() }} saved={signupSaved} />
      </Modal>

      {/* ---------- Currency ---------- */}
      <Modal open={openModal === 'currency'} onClose={() => setOpenModal(null)} title="Currency setup" description="Site-wide default equivalent currency. Clients can override their own in their profile settings. USD always stays the real, stored balance.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => updateSettings({ currencyCode: c.code, currencySymbol: c.symbol })}
              className="tx-btn"
              style={{
                padding: '10px 14px', fontSize: 13.5, justifyContent: 'space-between',
                background: settings.currencyCode === c.code ? 'var(--accent-bright)' : 'var(--bg)',
                border: '1px solid ' + (settings.currencyCode === c.code ? 'var(--accent-bright)' : 'var(--border)'),
                color: settings.currencyCode === c.code ? '#fff' : 'var(--text)'
              }}
            >
              <span>{c.name} ({c.code})</span><span>{c.symbol}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* ---------- Deposit setup ---------- */}
      <Modal open={openModal === 'deposit'} onClose={() => setOpenModal(null)} title="Deposit setup">
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Payment methods clients can indicate</div>
          {[
            { id: 'usdt', label: 'USDT' },
            { id: 'btc', label: 'BTC' },
            { id: 'bank', label: 'Bank Transfer' }
          ].map((m) => (
            <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!settings.depositMethods[m.id]}
                onChange={(e) => updateSettings({ depositMethods: { ...settings.depositMethods, [m.id]: e.target.checked } })}
              />
              <span style={{ fontSize: 13.5 }}>{m.label}</span>
            </label>
          ))}
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            This is metadata only, for your own reconciliation — no wallet address or bank account is shown to
            clients on the platform. Coordinate actual payment details through your own channels, then approve
            the deposit here once received.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Minimum deposit
            <input type="number" min="0" value={depositCfg.depositMin} onChange={(e) => setDepositCfg({ ...depositCfg, depositMin: e.target.value })} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Maximum deposit
            <input type="number" min="0" value={depositCfg.depositMax} onChange={(e) => setDepositCfg({ ...depositCfg, depositMax: e.target.value })} style={inputStyle} />
          </label>
        </div>
        <label style={{ ...labelStyle, display: 'block', marginTop: 12 }}>
          Instructions shown on the deposit form
          <textarea rows={3} value={depositCfg.depositInstructions} onChange={(e) => setDepositCfg({ ...depositCfg, depositInstructions: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
        <ModalSaveButton
          onClick={() => { updateSettings({ depositMin: Number(depositCfg.depositMin) || 0, depositMax: Number(depositCfg.depositMax) || 0, depositInstructions: depositCfg.depositInstructions }); flashDeposit() }}
          saved={depositSaved}
        />
      </Modal>

      {/* ---------- Withdrawal setup ---------- */}
      <Modal open={openModal === 'withdrawal'} onClose={() => setOpenModal(null)} title="Withdrawal setup">
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Payout methods clients can choose from</div>
          {[
            { id: 'usdt', label: 'USDT' },
            { id: 'btc', label: 'BTC' },
            { id: 'bank', label: 'Bank Account', note: 'Requires enhanced verification (proof of address) from the client, on top of basic ID.' }
          ].map((m) => (
            <label key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!settings.withdrawalMethods[m.id]}
                onChange={(e) => updateSettings({ withdrawalMethods: { ...settings.withdrawalMethods, [m.id]: e.target.checked } })}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong style={{ fontSize: 13.5 }}>{m.label}</strong>
                {m.note && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.note}</div>}
              </span>
            </label>
          ))}
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Crypto methods don't move real crypto — the client provides a destination address and you fulfill it
            manually, same as every other withdrawal on this platform.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Minimum withdrawal
            <input type="number" min="0" value={withdrawalCfg.withdrawalMin} onChange={(e) => setWithdrawalCfg({ ...withdrawalCfg, withdrawalMin: e.target.value })} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Maximum withdrawal
            <input type="number" min="0" value={withdrawalCfg.withdrawalMax} onChange={(e) => setWithdrawalCfg({ ...withdrawalCfg, withdrawalMax: e.target.value })} style={inputStyle} />
          </label>
        </div>
        <label style={{ ...labelStyle, display: 'block', marginTop: 12 }}>
          Instructions shown on the withdrawal form
          <textarea rows={3} value={withdrawalCfg.withdrawalInstructions} onChange={(e) => setWithdrawalCfg({ ...withdrawalCfg, withdrawalInstructions: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
        <ModalSaveButton
          onClick={() => { updateSettings({ withdrawalMin: Number(withdrawalCfg.withdrawalMin) || 0, withdrawalMax: Number(withdrawalCfg.withdrawalMax) || 0, withdrawalInstructions: withdrawalCfg.withdrawalInstructions }); flashWithdrawal() }}
          saved={withdrawalSaved}
        />
      </Modal>

      {/* ---------- Email settings ---------- */}
      <Modal open={openModal === 'email'} onClose={() => setOpenModal(null)} title="Email settings" description="No real email leaves this platform yet — see the note below. Everything here is stored and ready for when a real provider is connected.">
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.emailSendingEnabled} onChange={(e) => updateSettings({ emailSendingEnabled: e.target.checked })} style={{ marginTop: 3 }} />
          <span>
            <strong style={{ fontSize: 13.5 }}>Email sending enabled</strong>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Off by default. Turn off if you already forward client emails through your own system — this
              keeps Pulse from also trying to send and creating duplicates.
            </div>
          </span>
        </label>

        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '14px 0 16px', padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          Real sending needs a backend to hold a mail provider's API key — that can't live safely in the browser.
          Until that's wired up, every email the app would send is logged to the <strong>Email Outbox</strong> page
          instead, so you can see exactly what would go out.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            From name
            <input type="text" placeholder="Your Company" value={emailCfg.emailFromName} onChange={(e) => setEmailCfg({ ...emailCfg, emailFromName: e.target.value })} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            From address
            <input type="email" placeholder="support@yourdomain.com" value={emailCfg.emailFromAddress} onChange={(e) => setEmailCfg({ ...emailCfg, emailFromAddress: e.target.value })} style={inputStyle} />
          </label>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '-8px 0 16px' }}>
          Use your own domain, not a shared one — otherwise real email providers flag it as spoofed.
        </p>

        <label style={labelStyle}>
          Welcome email subject
          <input type="text" value={emailCfg.welcomeEmailSubject} onChange={(e) => setEmailCfg({ ...emailCfg, welcomeEmailSubject: e.target.value })} style={inputStyle} />
        </label>
        <label style={{ ...labelStyle, display: 'block', marginTop: 12 }}>
          Welcome email body
          <textarea rows={4} value={emailCfg.welcomeEmailBody} onChange={(e) => setEmailCfg({ ...emailCfg, welcomeEmailBody: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>Use {'{{name}}'} to insert the client's name.</p>
        <ModalSaveButton onClick={() => { updateSettings(emailCfg); flashEmail() }} saved={emailSaved} />
      </Modal>

      {/* ---------- Blockchain verification ---------- */}
      <Modal
        open={openModal === 'blockchain'}
        onClose={() => setOpenModal(null)}
        title="Blockchain verification"
        description="No deposit is verified automatically yet — this is stored and ready for when a real provider is connected."
      >
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.blockchainVerificationEnabled}
            onChange={(e) => updateSettings({ blockchainVerificationEnabled: e.target.checked })}
            style={{ marginTop: 3 }}
          />
          <span>
            <strong style={{ fontSize: 13.5 }}>Automatic verification enabled</strong>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Off by default. Turning this on does not make deposits verify automatically today — it just marks
              crypto deposits with a clear "no provider connected" status instead of leaving that blank, so
              nothing is silently skipped once a provider is wired in.
            </div>
          </span>
        </label>

        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '14px 0 16px', padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          Real verification needs a backend to hold a payment processor's API key (Coinbase Commerce, NOWPayments,
          BitPay, or similar) and a real, uniquely-generated receiving address per deposit. This platform
          deliberately never displays a receiving address on its own — that pattern only becomes trustworthy with
          a real processor confirming it, not before.
        </p>

        <label style={labelStyle}>
          Provider name (for your reference)
          <input
            type="text"
            placeholder="e.g. Coinbase Commerce"
            value={blockchainProviderName}
            onChange={(e) => setBlockchainProviderName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <ModalSaveButton onClick={() => { updateSettings({ blockchainProviderName }); flashBlockchain() }} saved={blockchainSaved} />
      </Modal>

      {/* ---------- Help page ---------- */}
      <Modal open={openModal === 'help'} onClose={() => setOpenModal(null)} title="Edit help page" description="Add new Q&A for the help page.">
        <label style={labelStyle}>
          Question
          <input type="text" value={qaQuestion} onChange={(e) => setQaQuestion(e.target.value)} style={inputStyle} placeholder="Enter question" />
        </label>
        <label style={{ ...labelStyle, display: 'block', marginTop: 10 }}>
          Answer
          <input type="text" value={qaAnswer} onChange={(e) => setQaAnswer(e.target.value)} style={inputStyle} placeholder="Enter answer" />
        </label>
        <div style={{ marginTop: 10 }}>
          <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleAddQA}>Add new Q&amp;A</button>
        </div>

        {settings.helpQA.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {settings.helpQA.map((qa) => (
              <div key={qa.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{qa.question}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{qa.answer}</div>
                </div>
                <button className="tx-btn withdraw" style={{ padding: '4px 9px', fontSize: 11, flex: 'none' }} onClick={() => updateSettings({ helpQA: settings.helpQA.filter((q) => q.id !== qa.id) })}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ---------- Privacy policy ---------- */}
      <Modal open={openModal === 'privacy'} onClose={() => setOpenModal(null)} title="Privacy policy page" description="Accepts HTML — rendered as-is on the public /privacy page. Plain text with no tags works too.">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button
            className="tx-btn"
            style={{ padding: '5px 10px', fontSize: 11.5 }}
            onClick={() => setPrivacyHtml(SAMPLE_PRIVACY_HTML)}
          >
            Use sample as a starting point
          </button>
        </div>
        <textarea rows={9} value={privacyHtml} onChange={(e) => setPrivacyHtml(e.target.value)} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
          Common tags: <code>&lt;h2&gt;</code> heading, <code>&lt;p&gt;</code> paragraph, <code>&lt;ul&gt;&lt;li&gt;</code> bullet list, <code>&lt;strong&gt;</code> bold.
        </p>
        <ModalSaveButton onClick={() => { updateSettings({ privacyPolicyHtml: privacyHtml }); flashPrivacy() }} saved={privacySaved} />
      </Modal>

      {/* ---------- About us ---------- */}
      <Modal open={openModal === 'about'} onClose={() => setOpenModal(null)} title="About us" description="Accepts HTML — rendered as-is on the public /about page. Plain text with no tags works too.">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button
            className="tx-btn"
            style={{ padding: '5px 10px', fontSize: 11.5 }}
            onClick={() => setAboutHtml(SAMPLE_ABOUT_HTML)}
          >
            Use sample as a starting point
          </button>
        </div>
        <textarea rows={9} value={aboutHtml} onChange={(e) => setAboutHtml(e.target.value)} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
          Common tags: <code>&lt;h2&gt;</code> heading, <code>&lt;p&gt;</code> paragraph, <code>&lt;ul&gt;&lt;li&gt;</code> bullet list, <code>&lt;strong&gt;</code> bold.
        </p>
        <ModalSaveButton onClick={() => { updateSettings({ aboutUsHtml: aboutHtml }); flashAbout() }} saved={aboutSaved} />
      </Modal>

      {/* ---------- Site color ---------- */}
      <Modal open={openModal === 'color'} onClose={() => setOpenModal(null)} title="Primary color" description="Drag or pick a color to customize your accent throughout the platform.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} style={{ width: 52, height: 40, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }} />
          <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13, flex: 'none' }} onClick={() => updateSettings({ customPrimaryColor: customColor })}>
            Apply
          </button>
          {settings.customPrimaryColor && (
            <button className="tx-btn withdraw" style={{ padding: '8px 14px', fontSize: 13, flex: 'none' }} onClick={() => updateSettings({ customPrimaryColor: null })}>
              Revert
            </button>
          )}
        </div>
      </Modal>

      {/* ---------- Other setup ---------- */}
      <Modal open={openModal === 'other'} onClose={() => setOpenModal(null)} title="Others" description="Other settings for the platform.">
        <label style={labelStyle}>
          Investment mode
          <select
            value={settings.investmentMode}
            onChange={(e) => updateSettings({ investmentMode: e.target.value })}
            style={inputStyle}
          >
            <option value="direct">Direct Mode</option>
            <option value="managed">Managed Mode</option>
          </select>
        </label>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 16px' }}>
          {settings.investmentMode === 'managed'
            ? "With Managed mode, a client's commitment moves out of their main balance immediately, but the session doesn't officially start until an admin begins it from the Requests queue or the client's page."
            : "With Direct mode, users can commit an amount and their session starts immediately — no admin action needed."}
        </p>

        <label style={labelStyle}>
          KYC status
          <select
            value={settings.kycEnabled ? 'on' : 'off'}
            onChange={(e) => updateSettings({ kycEnabled: e.target.value === 'on' })}
            style={inputStyle}
          >
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </label>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 16px' }}>
          When on, clients see a Verification page to upload an ID document, and it appears in the client's admin
          page for you to approve or reject.
        </p>

        {settings.kycEnabled && (
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Accepted document types</div>
            {[{ id: 'passport', label: 'Passport' }, { id: 'id', label: 'National ID' }].map((doc) => (
              <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.kycAcceptedDocumentTypes.includes(doc.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...settings.kycAcceptedDocumentTypes, doc.id]
                      : settings.kycAcceptedDocumentTypes.filter((d) => d !== doc.id)
                    if (next.length === 0) return // at least one type must stay accepted
                    updateSettings({ kycAcceptedDocumentTypes: next })
                  }}
                />
                <span style={{ fontSize: 13 }}>{doc.label}</span>
              </label>
            ))}

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 10 }}>
              <input type="checkbox" checked={settings.kycRequireBackSide} onChange={(e) => updateSettings({ kycRequireBackSide: e.target.checked })} style={{ marginTop: 3 }} />
              <span>
                <strong style={{ fontSize: 13.5 }}>Require back-side image</strong>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Only applies to National ID — a passport's photo page is the whole document.</div>
              </span>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.showReferrals} onChange={(e) => updateSettings({ showReferrals: e.target.checked })} style={{ marginTop: 3 }} />
            <span>
              <strong style={{ fontSize: 13.5 }}>Referral program</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Client referral links, bonus campaigns, and the Referrals nav link.</div>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.showVipTiers} onChange={(e) => updateSettings({ showVipTiers: e.target.checked })} style={{ marginTop: 3 }} />
            <span>
              <strong style={{ fontSize: 13.5 }}>VIP tiers</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hidden higher tiers an admin can unlock for specific clients.</div>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.demoModeEnabled} onChange={(e) => updateSettings({ demoModeEnabled: e.target.checked })} style={{ marginTop: 3 }} />
            <span>
              <strong style={{ fontSize: 13.5 }}>Demo mode</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Turn off once onboarding real clients.</div>
            </span>
          </label>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button
            className="tx-btn withdraw"
            style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => { resetSettings(); setBrandName(settings.brandName); setBrandTagline(settings.brandTagline) }}
          >
            <RotateCcw size={14} /> Reset all settings to defaults
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
