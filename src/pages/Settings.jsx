import { useState, useRef } from 'react'
import { Camera, Lock, Wallet, ShieldAlert, Bitcoin, Coins, Landmark } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSupport } from '../context/SupportContext.jsx'
import { CURRENCIES, COUNTRY_CURRENCY, COUNTRIES } from '../config/currencies.js'
import { CRYPTO_CHAINS, METHOD_LABELS } from '../config/paymentMethods.js'
import PasswordField from '../components/PasswordField.jsx'
import CopyButton from '../components/CopyButton.jsx'

const METHOD_ICONS = { usdt: Coins, btc: Bitcoin }

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: 14
}

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

  function handleRequestUnlink() {
    const w = currentUser.boundWallet
    createCase({
      subject: 'Unlink withdrawal wallet',
      category: 'account',
      body: `I'd like to unlink my withdrawal wallet (currently ${METHOD_LABELS[w.method] || w.method}${w.chain ? ` on ${w.chain}` : ''}, ${w.address}) so I can bind a different one. Please help me unlink it.`
    })
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

  return (
    <Layout pageTitle="Settings">
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Update your profile — changes are saved and reflected everywhere right away.</p>

      <div className="panel" style={{ maxWidth: 480, marginBottom: 16 }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Account ID</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600 }}>{currentUser.uid}</span>
              <CopyButton value={currentUser.uid} label="Copy account ID" />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'right', maxWidth: 220 }}>
            Have this ready when contacting support — it identifies your account precisely and can help you back in if you're ever locked out.
          </div>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 480, marginBottom: 16 }}>
        <div className="panel-head">
          <h3><Wallet size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Withdrawal wallet</h3>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          {currentUser.boundWallet ? (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                Withdrawals are only ever sent here — this is what keeps a withdrawal safe even if someone else
                gets into your account, since they can't redirect it to a different address without support's help.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', marginBottom: 12 }}>
                <div className="icon-badge">
                  {(() => { const Icon = METHOD_ICONS[currentUser.boundWallet.method] || Wallet; return <Icon size={16} /> })()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {METHOD_LABELS[currentUser.boundWallet.method] || currentUser.boundWallet.method}
                    {currentUser.boundWallet.chain ? ` · ${currentUser.boundWallet.chain}` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{currentUser.boundWallet.address}</span>
                    <CopyButton value={currentUser.boundWallet.address} label="Copy wallet address" />
                  </div>
                </div>
              </div>
              {unlinkSent ? (
                <p style={{ fontSize: 12.5, color: 'var(--success)' }}>Request sent — support will follow up to verify it's really you before unlinking anything.</p>
              ) : (
                <button className="tx-btn withdraw" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleRequestUnlink}>
                  <ShieldAlert size={14} /> Request to unlink
                </button>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                Bind one wallet address on one network before your first withdrawal — every future withdrawal goes
                only there. This is a one-time setup; changing it later needs support's help, on purpose.
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {Object.keys(METHOD_ICONS).map((m) => {
                  const Icon = METHOD_ICONS[m]
                  const isSelected = walletMethod === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setWalletMethod(m); setWalletChain(CRYPTO_CHAINS[m][0]) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                        borderRadius: 10, border: '1px solid ' + (isSelected ? 'var(--accent)' : 'var(--border)'),
                        background: isSelected ? 'var(--accent-bg)' : 'var(--bg)',
                        color: isSelected ? 'var(--accent-bright)' : 'var(--text)', cursor: 'pointer'
                      }}
                    >
                      <Icon size={15} /> {METHOD_LABELS[m]}
                    </button>
                  )
                })}
              </div>
              <select
                value={walletChain}
                onChange={(e) => setWalletChain(e.target.value)}
                style={{ ...inputStyle, marginBottom: 10 }}
              >
                {CRYPTO_CHAINS[walletMethod].map((chain) => <option key={chain} value={chain}>{chain}</option>)}
              </select>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Wallet address"
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              {walletError && <div className="form-error">{walletError}</div>}
              <button className="tx-btn deposit" style={{ padding: '9px 16px', fontSize: 13.5 }} onClick={handleBindWallet}>
                Bind wallet
              </button>
            </>
          )}
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 480 }}>
        <div className="panel-head">
          <h3>Profile</h3>
        </div>
        <div style={{ padding: '0 20px 20px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
            <div
              onClick={() => fileRef.current.click()}
              style={{
                width: 64, height: 64, borderRadius: '50%', cursor: 'pointer',
                background: form.avatar ? `url(${form.avatar}) center/cover` : 'linear-gradient(150deg, var(--accent-bright), var(--accent-dark))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', position: 'relative', fontSize: 18
              }}
            >
              {!form.avatar && form.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
              <div style={{
                position: 'absolute', bottom: -2, right: -2, background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: '50%', width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Camera size={12} />
              </div>
            </div>
            <input type="file" accept="image/*" ref={fileRef} onChange={handleAvatarPick} style={{ display: 'none' }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click the avatar to change your photo</div>
          </div>

          <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Display name</label>
          <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} style={inputStyle} />

          <label style={{ fontSize: 13, display: 'block', margin: '14px 0 6px' }}>Email</label>
          <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} style={inputStyle} />

          <label style={{ fontSize: 13, display: 'block', margin: '14px 0 6px' }}>Phone number</label>
          <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+234..." style={inputStyle} />

          <label style={{ fontSize: 13, display: 'block', margin: '14px 0 6px' }}>Country</label>
          <select value={form.country} onChange={(e) => handleChange('country', e.target.value)} style={inputStyle}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={{ fontSize: 13, display: 'block', margin: '14px 0 6px' }}>Display currency</label>
          <select value={form.preferredCurrency} onChange={(e) => handleChange('preferredCurrency', e.target.value)} style={inputStyle}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
          </select>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Your balance is always tracked in USD — this only controls the approximate equivalent shown next to
            deposit/withdrawal amounts.
          </p>

          <button className="btn-primary" style={{ marginTop: 18, width: '100%' }} onClick={handleSave}>
            Save changes
          </button>

          {saved && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>Saved.</p>}
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 480, marginTop: 16 }}>
        <div className="panel-head">
          <h3><Lock size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Change password</h3>
        </div>
        <div style={{ padding: '0 20px 20px' }}>

          {pwError && <div className="form-error" style={{ marginBottom: 14 }}>{pwError}</div>}

          <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Current password</label>
          <PasswordField variant="plain" value={pwForm.current} onChange={(e) => handlePwChange('current', e.target.value)} style={inputStyle} autoComplete="current-password" />

          <label style={{ fontSize: 13, display: 'block', margin: '14px 0 6px' }}>New password</label>
          <PasswordField variant="plain" value={pwForm.next} onChange={(e) => handlePwChange('next', e.target.value)} style={inputStyle} minLength={6} autoComplete="new-password" />

          <label style={{ fontSize: 13, display: 'block', margin: '14px 0 6px' }}>Confirm new password</label>
          <PasswordField variant="plain" value={pwForm.confirm} onChange={(e) => handlePwChange('confirm', e.target.value)} style={inputStyle} minLength={6} autoComplete="new-password" />

          <button className="btn-primary" style={{ marginTop: 18, width: '100%' }} onClick={handlePasswordSave}>
            Update password
          </button>

          {pwSaved && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>Password updated.</p>}
        </div>
      </div>
    </Layout>
  )
}