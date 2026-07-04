import { useState, useRef } from 'react'
import { Camera } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const COUNTRIES = ['Nigeria', 'United States', 'United Kingdom', 'Canada', 'South Africa', 'Ghana', 'Kenya', 'Other']

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: 14
}

export default function Settings() {
  const { currentUser, updateProfile } = useAuth()
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    name: currentUser.name || '',
    email: currentUser.email || '',
    phone: currentUser.phone || '',
    country: currentUser.country || 'Nigeria',
    avatar: currentUser.avatar || ''
  })
  const [saved, setSaved] = useState(false)

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  // Reads the picked image file and converts it to a base64 string
  // so it can live in localStorage (no server/file storage in this demo).
  function handleAvatarPick(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => handleChange('avatar', reader.result)
    reader.readAsDataURL(file)
  }

  function handleSave() {
    updateProfile(form)
    setSaved(true)
  }

  return (
    <Layout pageTitle="Settings">
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Update your profile — saved to this browser, persists across sessions.</p>

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

          <button className="btn-primary" style={{ marginTop: 18, width: '100%' }} onClick={handleSave}>
            Save changes
          </button>

          {saved && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>Saved.</p>}
        </div>
      </div>
    </Layout>
  )
}