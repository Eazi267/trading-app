import { Link } from 'react-router-dom'
import {
  ArrowRight, ShieldCheck, Users, ClipboardList, TrendingUp,
  Bitcoin, DollarSign, LineChart as LineChartIcon, Layers, Lock,
  CheckCircle2, Building2, Mail, Phone, Sprout, Gem, Crown
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { TIERS } from '../config/tiers.js'
import { useSettings } from '../context/SettingsContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const BENEFITS = [
  {
    icon: ClipboardList,
    title: 'Every result is calculated automatically',
    body: 'Balances and session outcomes are derived from real price movement and a complete transaction record, giving every client a transparent, verifiable history.'
  },
  {
    icon: CheckCircle2,
    title: 'Every result is certified by a person',
    body: 'A session closing is only the first step — an account manager reviews and certifies the result before it ever touches your balance. Nothing posts automatically and unchecked.'
  },
  {
    icon: Users,
    title: 'Built for managing many accounts',
    body: 'One dashboard for every client you manage — position sizes, tiers, and history stay separated per account, never shared or mixed up.'
  },
  {
    icon: ShieldCheck,
    title: 'Capped upside, uncapped downside — always visible',
    body: "When a tier's payout cap reduces a result, it's shown right on the record. Nothing is hidden after the fact."
  },
  {
    icon: TrendingUp,
    title: 'Full audit trail on every action',
    body: 'Every trade, deposit, withdrawal, and session is logged with who executed it and when.'
  }
]

const INSTRUMENT_GROUPS = [
  {
    title: 'Crypto',
    icon: Bitcoin,
    symbols: ['BTC/USD', 'ETH/USD'],
    body: 'Track BTC and ETH with live-updating market pricing.'
  },
  {
    title: 'Forex',
    icon: DollarSign,
    symbols: ['EUR/USD', 'GBP/USD'],
    body: 'Major currency pairs, priced the same way as everything else on the platform.'
  }
]

export default function Home() {
  const { prices } = useApp()
  const { currentUser } = useAuth()
  const { settings, brand } = useSettings()

  return (
    <div className="home">
      <nav className="home-nav">
        <div className="home-nav-brand">
          <div className="home-nav-mark">
            {brand.logoImageDataUrl ? (
              <img src={brand.logoImageDataUrl} alt={brand.name} style={{ width: 18, height: 18, objectFit: 'contain' }} />
            ) : (
              <brand.LogoIcon size={18} />
            )}
          </div>
          {brand.name}
        </div>
        <div className="home-nav-links">
          <a href="#tiers">Tiers</a>
          <a href="#instruments">Instruments</a>
          <a href="#how-it-works">How it works</a>
        </div>
        <div className="home-nav-actions">
          {currentUser ? (
            <Link to="/dashboard" className="btn-primary" style={{ padding: '9px 16px', fontSize: 13.5 }}>
              Go to dashboard <ArrowRight size={15} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="home-nav-login">Log in</Link>
              <Link to="/signup" className="btn-primary" style={{ padding: '9px 16px', fontSize: 13.5 }}>
                Get started <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
      </nav>

      <header className="home-hero">
        <div className="home-hero-copy">
          <div className="home-hero-badge"><Lock size={12} /> Capped-risk trading tiers</div>
          <h1>Your portfolio, managed in the open.</h1>
          <p>
            {brand.tagline} Every balance, every session result, every payout traces back to a real transaction
            record and a human sign-off — not a number someone typed in.
          </p>
          <div className="home-hero-actions">
            <Link to="/signup" className="btn-primary" style={{ padding: '13px 22px', fontSize: 15 }}>
              Open an account <ArrowRight size={16} />
            </Link>
            <a href="#tiers" className="home-hero-secondary">See how tiers work</a>
          </div>
        </div>

        <div className="home-hero-ticker">
          <div className="home-hero-ticker-label">Live market pricing</div>
          {Object.entries(prices).map(([symbol, price]) => (
            <div key={symbol} className="home-hero-ticker-row">
              <span>{symbol}</span>
              <strong>{price.toFixed(price > 100 ? 2 : 4)}</strong>
            </div>
          ))}
        </div>
      </header>

      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px 28px',
        padding: '18px 24px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        fontSize: 12.5, color: 'var(--text-muted)'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={14} /> Deposits reviewed before they affect your balance</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> Session results certified by a manager, not auto-posted</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={14} /> Full audit log of every account action</span>
        {settings.companyEmail && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> {settings.companyEmail}</span>
        )}
        {settings.companyPhone && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} /> {settings.companyPhone}</span>
        )}
      </div>

      <section className="home-section">
        <div className="home-section-head">
          <h2>Why it feels different</h2>
          <p>No guaranteed returns, no invented numbers — just a transparent system.</p>
        </div>
        <div className="home-benefits-grid">
          {BENEFITS.map((b) => (
            <div className="home-benefit-card" key={b.title}>
              <div className="home-benefit-icon"><b.icon size={18} /></div>
              <h3>{b.title}</h3>
              <p>{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section" id="tiers">
        <div className="home-section-head">
          <h2>Choose a tier</h2>
          <p>Every tier caps the maximum payout on a gain. Losses are never capped — real risk stays real.</p>
        </div>
        <div className="tier-preview-grid" style={{ maxWidth: 920, margin: '0 auto' }}>
          {TIERS.map((tier, i) => {
            const TierIcon = [Sprout, TrendingUp, Gem][i] || Crown
            return (
              <div key={tier.id} className="tier-preview-card">
                <div className="tier-preview-head">
                  <div className="icon-badge"><TierIcon size={16} /></div>
                  <strong>{tier.name}</strong>
                </div>
                <p>{tier.description}</p>
                <div className="tier-preview-payout">{tier.maxPayoutMultiplier * 100}%</div>
                <div className="tier-preview-payout-label">Max payout of session amount</div>
                <div className="tier-preview-range">{formatMoney(tier.minDeposit)} – {formatMoney(tier.maxDeposit)}</div>
              </div>
            )
          })}
        </div>
        <p className="home-tiers-footnote">
          Larger accounts are set up individually — reach out after signing up and we'll configure it directly.
        </p>
      </section>

      <section className="home-section" id="instruments">
        <div className="home-section-head">
          <h2>Instruments</h2>
          <p>What every session is priced against.</p>
        </div>
        <div className="home-instruments-grid">
          {INSTRUMENT_GROUPS.map((group) => (
            <div className="home-instrument-card" key={group.title}>
              <div className="home-benefit-icon"><group.icon size={18} /></div>
              <h3>{group.title}</h3>
              <p>{group.body}</p>
              <div className="home-instrument-symbols">
                {group.symbols.map((s) => (
                  <span key={s} className="home-instrument-chip">{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section" id="how-it-works">
        <div className="home-section-head">
          <h2>How it works</h2>
        </div>
        <div className="home-steps">
          <div className="home-step">
            <div className="home-step-num">1</div>
            <div>
              <h3>Create an account</h3>
              <p>Sign up in a few seconds — no tier or deposit decisions needed yet.</p>
            </div>
          </div>
          <div className="home-step">
            <div className="home-step-num">2</div>
            <div>
              <h3>Deposit</h3>
              <p>Request a deposit; it's reviewed and approved before it affects your balance.</p>
            </div>
          </div>
          <div className="home-step">
            <div className="home-step-num">3</div>
            <div>
              <h3>Choose a session</h3>
              <p>Pick a tier and commit part of your available balance to a session.</p>
            </div>
          </div>
          <div className="home-step">
            <div className="home-step-num">4</div>
            <div>
              <div className="home-step-icon"><LineChartIcon size={16} /></div>
              <h3>Track results</h3>
              <p>Watch live P&L, then close the session — your balance updates automatically.</p>
            </div>
          </div>
        </div>
      </section>

      {settings.helpQA.length > 0 && (
        <section className="home-section" id="faq">
          <div className="home-section-head">
            <h2>Common questions</h2>
          </div>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {settings.helpQA.slice(0, 4).map((qa) => (
              <div key={qa.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 14.5, marginBottom: 6 }}>{qa.question}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{qa.answer}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: 20 }}>
            <Link to="/help" style={{ color: 'var(--accent-bright)', fontSize: 13.5 }}>See all help articles →</Link>
          </p>
        </section>
      )}

      <footer className="home-footer">
        <div className="home-footer-icon"><Layers size={22} /></div>
        <h2>Ready to get started?</h2>
        <Link to="/signup" className="btn-primary" style={{ padding: '13px 24px', fontSize: 15, margin: '0 auto' }}>
          Create your account <ArrowRight size={16} />
        </Link>
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 20, fontSize: 12.5, flexWrap: 'wrap' }}>
          <Link to="/about" style={{ color: 'var(--text-muted)' }}>About Us</Link>
          <Link to="/privacy" style={{ color: 'var(--text-muted)' }}>Privacy Policy</Link>
          <Link to="/help" style={{ color: 'var(--text-muted)' }}>Help</Link>
        </div>
        {settings.companyAddress && (
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Building2 size={12} /> {settings.companyAddress}
          </p>
        )}
      </footer>
    </div>
  )
}
