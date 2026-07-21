import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight, ShieldCheck, TrendingUp, Globe2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { BRAND } from '../config/brand.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    const user = login(email, password)
    if (user) {
      navigate('/dashboard')
    } else {
      setError(true)
    }
  }

  return (
    <div className="login-split">
      <div className="login-hero">
        <div className="login-hero-top">
          <div className="login-hero-mark"><BRAND.LogoIcon size={22} /></div>
          <div className="login-hero-brand">{BRAND.name}</div>
          <h2>Markets move fast. Your dashboard should too.</h2>
          <p>A clean, modern space to track prices, manage your portfolio, and stay on top of every account you oversee.</p>

          <div className="login-hero-features">
            <div className="login-hero-feature"><TrendingUp size={16} /> Live-updating market prices</div>
            <div className="login-hero-feature"><ShieldCheck size={16} /> Secure, role-based account access</div>
            <div className="login-hero-feature"><Globe2 size={16} /> Built for multi-account management</div>
          </div>
        </div>
        <div className="login-hero-foot">Built for account managers who value transparency.</div>
      </div>

      <div className="login-form-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Welcome back</h1>
          <p className="login-sub">Log in to your account</p>

          {error && <div className="form-error">That email and password combination wasn't found.</div>}

          <label>Email</label>
          <div className="field-input-wrap">
            <Mail size={16} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>

          <label>Password</label>
          <div className="field-input-wrap">
            <Lock size={16} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            Log in <ArrowRight size={16} />
          </button>

          <p className="demo-note">
            Demo trader: trader@pulse.app / trader123<br />
            Demo admin: admin@pulse.app / admin123<br /><br />
             New here? <a href="/signup" style={{ color: 'var(--accent-bright)' }}>Create an account</a>
          </p>
        </form>
      </div>
    </div>
  )
}