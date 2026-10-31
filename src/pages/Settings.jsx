import { useState, useRef } from 'react'
import { Camera, Lock, Wallet, ShieldAlert, Bitcoin, Coins, Landmark } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSupport } from '../context/SupportContext.jsx'
import { CURRENCIES, COUNTRY_CURRENCY, COUNTRIES } from '../config/currencies.js'
import { CRYPTO_CHAINS, METHOD_LABELS } from '../config/paymentMethods.js'
import PasswordField from '../components/PasswordField.jsx'
import CopyButton from '../components/CopyButton.jsx'
import TwoFactorPanel from '../components/TwoFactorPanel.jsx'

const METHOD_ICONS = { usdt: Coins, btc: Bitcoin }

export default function Settings() {
  const { currentUser, updateProfile, changePassword, bindWallet } = useAuth()
  const { createCase } = useSupport()
  const [walletMethod, setWalletMethod] = useState('usdt')
  const [walletChain, setWalletChain] = useState(CRYPTO_CHAINS.usdt[0])
  const [walletAddress, setWalletAddress] = useState('')
  const [walletError, setWalletError] = useState('')
  const [unlinkSent, setUnlinkSent] = useState(false)

  async function handleBindWallet() {
    const result = await bindWallet(walletMethod, CRYPTO_CHAINS[walletMethod] ? walletChain : null, walletAddress)
    if (result.error) return setWalletError(result.error)
    setWalletError('')
  }

 async function handleRequestUnlink() {
  const w = currentUser.boundWallet
  const result = await createCase({
    subject: 'Unlink withdrawal wallet',
    category: 'account',
    body: `I'd like to unlink my withdrawal wallet (currently ${METHOD_LABELS[w.method] || w.method}${w.chain ? ` on ${w.chain}` : ''}, ${w.address}) so I can bind a different one. Please help me unlink it.`
  })
  if (result.error) return setWalletError(result.error)
  setUnlinkSent(true)
}
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    name: currentUser.name || '',
    email: currentUser.email || '',
    phone: currentUser.phone || '',
    country: currentUser.country || 'Nigeria',
    // Defaults to whatever the client's country maps to, but is a
    // free choice from here on — someone living abroad from their
    // home country isn't stuck with the wrong equivalent currency.
    preferredCurrency: currentUser.preferredCurrency || COUNTRY_CURRENCY[currentUser.country || 'Nigeria'] || 'USD',
    avatar: currentUser.avatar || ''
  })
  const [saved, setSaved] = useState(false)

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  function handleChange(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      // Changing country re-suggests a currency, but only if the
      // person hasn't already made an explicit currency choice this
      // session — don't fight a deliberate override.
      if (field === 'country' && !f._currencyTouched) {
        next.preferredCurrency = COUNTRY_CURRENCY[value] || next.preferredCurrency
      }
      if (field === 'preferredCurrency') next._currencyTouched = true
      return next
    })
    setSaved(false)
  }

  function handleAvatarPick(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => handleChange('avatar', reader.result)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    const { _currencyTouched, ...profileFields } = form
    const result = await updateProfile(profileFields)
    if (!result.error) setSaved(true)
  }

  function handlePwChange(field, value) {
    setPwForm((f) => ({ ...f, [field]: value }))
    setPwError('')
    setPwSaved(false)
  }

  async function handlePasswordSave() {
    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match.')
      return
    }
    const result = await changePassword(pwForm.current, pwForm.next)
    if (result.error) {
      setPwError(result.error)
      return
    }
    setPwForm({ current: '', next: '', confirm: '' })
    setPwSaved(true)
  }

  const initials = form.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <Layout pageTitle="Settings">
      <header className="dz-head">
        <h1 className="dz-title">Settings</h1>
        <div className="dz-muted">Your profile, withdrawal wallet and password. Changes are saved and reflected everywhere right away.</div>
      </header>

      <div className="dz-grid st-grid">
        <div className="dz-main">
          <div className="dz-card">
            <div className="dz-card-head"><h3>Profile</h3></div>
            <div className="st-avatar-row">
              <button
                type="button"
                className="st-avatar"
                aria-label="Change photo"
                onClick={() => fileRef.current.click()}
                style={form.avatar ? { background: `url(${form.avatar}) center/cover` } : undefined}
              >
                {!form.avatar && initials}
                <span className="st-avatar-cam"><Camera size={12} /></span>
              </button>
              <input type="file" accept="image/*" ref={fileRef} onChange={handleAvatarPick} style={{ display: 'none' }} />
              <div>
                <strong>{form.name || 'Your name'}</strong>
                <div className="dz-muted">Tap the photo to change it</div>
              </div>
            </div>

            <div className="st-form">
              <label className="st-f">
                <span className="pg-label">Display name</span>
                <input className="pg-field" type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
              </label>
              <label className="st-f">
                <span className="pg-label">Email</span>
                <input className="pg-field" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
              </label>
              <label className="st-f">
                <span className="pg-label">Phone number</span>
                <input className="pg-field" type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+234..." />
              </label>
              <label className="st-f">
                <span className="pg-label">Country</span>
                <select className="pg-field" value={form.country} onChange={(e) => handleChange('country', e.target.value)}>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="st-f st-wide">
                <span className="pg-label">Display currency</span>
                <select className="pg-field" value={form.preferredCurrency} onChange={(e) => handleChange('preferredCurrency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                </select>
                <span className="dz-muted st-hint">Your balance is always tracked in USD. This only controls the approximate equivalent shown next to deposit and withdrawal amounts.</span>
              </label>
            </div>

            <button className="btn-primary pg-start-btn" onClick={handleSave}>Save changes</button>
            {saved && <p className="st-ok">Saved.</p>}
          </div>

          <div className="dz-card">
            <div className="dz-card-head"><h3><Lock size={15} className="st-ico" />Change password</h3></div>
            {pwError && <div className="form-error" style={{ marginBottom: 14 }}>{pwError}</div>}
            <div className="st-form">
              <label className="st-f st-wide">
                <span className="pg-label">Current password</span>
                <PasswordField variant="plain" value={pwForm.current} onChange={(e) => handlePwChange('current', e.target.value)} style={{}} className="pg-field" autoComplete="current-password" />
              </label>
              <label className="st-f">
                <span className="pg-label">New password</span>
                <PasswordField variant="plain" value={pwForm.next} onChange={(e) => handlePwChange('next', e.target.value)} style={{}} className="pg-field" minLength={8} autoComplete="new-password" />
              </label>
              <label className="st-f">
                <span className="pg-label">Confirm new password</span>
                <PasswordField variant="plain" value={pwForm.confirm} onChange={(e) => handlePwChange('confirm', e.target.value)} style={{}} className="pg-field" minLength={8} autoComplete="new-password" />
              </label>
            </div>
            <button className="btn-primary pg-start-btn" onClick={handlePasswordSave}>Update password</button>
            {pwSaved && <p className="st-ok">Password updated.</p>}
          </div>

          {currentUser.role === 'admin' && <TwoFactorPanel />}
        </div>

        <aside className="dz-side st-side">
          <div className="dz-card">
            <div className="dz-label">Account ID</div>
            <div className="st-id">
              <span className="mono">{currentUser.uid}</span>
              <CopyButton value={currentUser.uid} label="Copy account ID" />
            </div>
            <p className="dz-muted st-hint">Have this ready when contacting support. It identifies your account precisely and can help you back in if you're ever locked out.</p>
          </div>

          <div className="dz-card">
            <div className="dz-card-head"><h3><Wallet size={15} className="st-ico" />Withdrawal wallet</h3></div>
            {currentUser.boundWallet ? (
              <>
                <p className="dz-muted st-hint">
                  Withdrawals are only ever sent here. This keeps a withdrawal safe even if someone else gets into your account, since they can't redirect it without support's help.
                </p>
                <div className="st-wallet">
                  <div className="icon-badge">
                    {(() => { const Icon = METHOD_ICONS[currentUser.boundWallet.method] || Wallet; return <Icon size={16} /> })()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong>
                      {METHOD_LABELS[currentUser.boundWallet.method] || currentUser.boundWallet.method}
                      {currentUser.boundWallet.chain ? ` · ${currentUser.boundWallet.chain}` : ''}
                    </strong>
                    <div className="st-addr">
                      <span>{currentUser.boundWallet.address}</span>
                      <CopyButton value={currentUser.boundWallet.address} label="Copy wallet address" />
                    </div>
                  </div>
                </div>
                {unlinkSent ? (
                  <p className="st-ok">Request sent. Support will follow up to verify it's really you before unlinking anything.</p>
                ) : (
                  <button className="dz-btn-o st-unlink" onClick={handleRequestUnlink}>
                    <ShieldAlert size={14} /> Request to unlink
                  </button>
                )}
                {walletError && <div className="form-error" style={{ marginTop: 10 }}>{walletError}</div>}
              </>
            ) : (
              <>
                <p className="dz-muted st-hint">
                  Bind one wallet address on one network before your first withdrawal. Every future withdrawal goes only there. This is a one-time setup; changing it later needs support's help, on purpose.
                </p>
                <div className="st-methods">
                  {Object.keys(METHOD_ICONS).map((m) => {
                    const Icon = METHOD_ICONS[m]
                    return (
                      <button
                        key={m}
                        type="button"
                        className={'pg-method' + (walletMethod === m ? ' on' : '')}
                        onClick={() => { setWalletMethod(m); setWalletChain(CRYPTO_CHAINS[m][0]) }}
                      >
                        <Icon size={15} /> {METHOD_LABELS[m]}
                      </button>
                    )
                  })}
                </div>
                <select className="pg-field" value={walletChain} onChange={(e) => setWalletChain(e.target.value)} style={{ marginBottom: 10 }}>
                  {CRYPTO_CHAINS[walletMethod].map((chain) => <option key={chain} value={chain}>{chain}</option>)}
                </select>
                <input className="pg-field" type="text" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="Wallet address" style={{ marginBottom: 10 }} />
                {walletError && <div className="form-error">{walletError}</div>}
                <button className="btn-primary pg-start-btn" onClick={handleBindWallet}>Bind wallet</button>
              </>
            )}
          </div>
        </aside>
      </div>
    </Layout>
  )
}
