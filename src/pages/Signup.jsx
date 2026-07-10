import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Mail, Lock, User, Gift, ArrowRight, ShieldCheck, TrendingUp, Globe2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { BRAND } from '../config/brand.js'

export default function Signup() {
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referralCodeUsed, setReferralCodeUsed] = useState(searchParams.get('ref') || '')
  const [error, setError] = useState('')
  const { signup } = useAuth()
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    const result = signup({ name, email, password, referralCodeUsed })
    if (result.error) setError(result.error)
    else navigate('/dashboard')
  }

  return (
    <div className="login-split">
      <div className="login-hero">
        <div className="login-hero-top">
          <div className="login-hero-mark"><BRAND.LogoIcon size={22} /></div>
          <div className="login-hero-brand">{BRAND.name}</div>
          <h2>Create your account and start practicing today.</h2>
          <p>Track live simulated prices, manage a demo portfolio, and learn the flow of trading — completely risk-free.</p>
          <div className="login-hero-features">
            <div className="login-hero-feature"><TrendingUp size={16} /> Live-updating simulated prices</div>
            <div className="login-hero-feature"><ShieldCheck size={16} /> No real funds — demo environment</div>
            <div className="login-hero-feature"><Globe2 size={16} /> Built to connect to a real broker later</div>
          </div>
        </div>
        <div className="login-hero-foot">Test environment — no real funds are moved here.</div>
      </div>

      <div className="login-form-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Create account</h1>
          <p className="login-sub">Join {BRAND.name} in a few seconds</p>

          {error && <div className="form-error">{error}</div>}

          <label>Full name</label>
          <div className="field-input-wrap">
            <User size={16} />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required />
          </div>

          <label>Email</label>
          <div className="field-input-wrap">
            <Mail size={16} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
          </div>

          <label>Password</label>
          <div className="field-input-wrap">
            <Lock size={16} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>

          <label>Referral code (optional)</label>
          <div className="field-input-wrap">
            <Gift size={16} />
            <input type="text" value={referralCodeUsed} onChange={(e) => setReferralCodeUsed(e.target.value)} placeholder="e.g. JAN4F2A" />
          </div>

          <button type="submit" className="btn-primary">
            Create account <ArrowRight size={16} />
          </button>

          <p className="demo-note">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
