import { Link } from 'react-router-dom'
import {
  ArrowRight, ShieldCheck, Users, ClipboardList, TrendingUp,
  Bitcoin, DollarSign, LineChart as LineChartIcon, Layers, Lock
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { TIERS } from '../config/tiers.js'
import { BRAND } from '../config/brand.js'

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

  return (
    <div className="home">
      <nav className="home-nav">
        <div className="home-nav-brand">
          <div className="home-nav-mark"><BRAND.LogoIcon size={18} /></div>
          {BRAND.name}
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
          <h1>Account management, built to be trusted.</h1>
          <p>
            {BRAND.tagline} Every balance, every session result, every payout is calculated from real market
            movement, giving you a transparent record you can trust.
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
          {TIERS.map((tier) => (
            <div key={tier.id} className="tier-preview-card" style={{ padding: '20px 18px' }}>
              <div className="tier-preview-head" style={{ fontSize: 15, marginBottom: 8 }}>
                <strong>{tier.name}</strong>
              </div>
              <p style={{ fontSize: 13 }}>{tier.description}</p>
              <div className="tier-preview-range" style={{ fontSize: 13.5 }}>
                {formatMoney(tier.minDeposit)} – {formatMoney(tier.maxDeposit)}
              </div>
              <div className="tier-preview-cap">Max payout: {tier.maxPayoutMultiplier * 100}% of session amount</div>
            </div>
          ))}
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

      <footer className="home-footer">
        <div className="home-footer-icon"><Layers size={22} /></div>
        <h2>Ready to get started?</h2>
        <Link to="/signup" className="btn-primary" style={{ padding: '13px 24px', fontSize: 15, margin: '0 auto' }}>
          Create your account <ArrowRight size={16} />
        </Link>
      </footer>
    </div>
  )
}
