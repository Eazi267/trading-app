import { Link } from 'react-router-dom'
import {
  ArrowRight, ShieldCheck, Users, ClipboardList, TrendingUp,
  CheckCircle2, Mail, Phone, Sprout, Gem, Crown, Layers
} from 'lucide-react'
import { useApp, REAL_SYMBOLS } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { TIERS } from '../config/tiers.js'
import { useSettings } from '../context/SettingsContext.jsx'
import { dedupeSeriesForSymbol } from '../utils/priceCharts.js'
import PublicFooter from '../components/PublicFooter.jsx'
import '../styles/home.css'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatPrice(price) {
  return price.toLocaleString(undefined, {
    minimumFractionDigits: price > 100 ? 2 : 4,
    maximumFractionDigits: price > 100 ? 2 : 4
  })
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

const STEPS = [
  { title: 'Create an account', body: 'Sign up in a few seconds — no tier or deposit decisions needed yet.' },
  { title: 'Deposit', body: "Request a deposit; it's reviewed and approved before it affects your balance." },
  { title: 'Choose a session', body: 'Pick a tier and commit part of your available balance to a session.' },
  { title: 'Track results', body: 'Watch live P&L, then close the session — your balance updates automatically.' }
]

// Display info per instrument. Prices themselves always come from the app.
const SYMBOL_INFO = {
  'BTC/USD': { name: 'Bitcoin', type: 'Crypto', short: 'BTC' },
  'ETH/USD': { name: 'Ethereum', type: 'Crypto', short: 'ETH' },
  'EUR/USD': { name: 'Euro / US Dollar', type: 'Forex', short: 'EU' },
  'GBP/USD': { name: 'Pound / US Dollar', type: 'Forex', short: 'GB' },
  'XAU/USD': { name: 'Gold', type: 'Metals', short: 'Au' },
  'XAG/USD': { name: 'Silver', type: 'Metals', short: 'Ag' }
}

// Draws the real recent BTC price history. If there isn't enough real
// data yet it says so instead of drawing a made-up line.
function PriceSpark({ history, symbol }) {
  const values = dedupeSeriesForSymbol(history, symbol).map((p) => p[symbol]).filter((v) => v != null)
  if (values.length < 3) {
    return <div className="hx-spark"><div className="hx-spark-empty">Collecting price data…</div></div>
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 400, 108 - ((v - min) / span) * 96])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('')
  return (
    <div className="hx-spark">
      <svg viewBox="0 0 400 120" preserveAspectRatio="none" aria-label={`${symbol} recent price history`}>
        <path d={`${line}L400,120L0,120Z`} fill="var(--accent)" opacity="0.14" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

function SourceChip({ source, feedError }) {
  if (source === 'simulated') return <span className="hx-chip sim">Simulated</span>
  if (feedError || source === 'delayed') return <span className="hx-chip warn">Feed delayed</span>
  return <span className="hx-chip live">Live feed</span>
}

export default function Home() {
  const { prices, history, priceFeedStatus, priceSources } = useApp()
  const { currentUser } = useAuth()
  const { settings, brand } = useSettings()

  const symbols = Object.keys(prices)
  const feedError = priceFeedStatus?.error
  const maxPayout = TIERS.length ? Math.max(...TIERS.map((t) => t.maxPayoutMultiplier)) * 100 : null
  const primaryHref = currentUser ? '/dashboard' : '/signup'
  const primaryLabel = currentUser ? 'Go to dashboard' : 'Open an account'

  return (
    <div className="hx">
      <nav className="hx-nav">
        <div className="hx-brand">
          <div className="hx-mark">
            {brand.logoImageDataUrl ? (
              <img src={brand.logoImageDataUrl} alt={brand.name} style={{ width: 18, height: 18, objectFit: 'contain' }} />
            ) : (
              <brand.LogoIcon size={18} />
            )}
          </div>
          {brand.name}
        </div>
        <div className="hx-links">
          <a href="#markets">Markets</a>
          <a href="#tiers">Tiers</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/about">About</Link>
        </div>
        <div className="hx-spacer" />
        {currentUser ? (
          <Link to="/dashboard" className="btn-primary" style={{ padding: '9px 16px', fontSize: 13.5 }}>
            Go to dashboard <ArrowRight size={15} />
          </Link>
        ) : (
          <>
            <Link to="/login" className="hx-login">Log in</Link>
            <Link to="/signup" className="btn-primary" style={{ padding: '9px 16px', fontSize: 13.5 }}>
              Sign up <ArrowRight size={15} />
            </Link>
          </>
        )}
      </nav>

      <div className="hx-wrap">
        <header className="hx-hero">
          <div>
            <span className="hx-badge">Capped-risk trading tiers</span>
            <h1>Your portfolio, managed <em>in the open.</em></h1>
            <p className="hx-lead">
              {brand.tagline} Every balance, every session result, every payout traces back to a real transaction
              record and a human sign-off — not a number someone typed in.
            </p>
            <div className="hx-cta">
              <Link to={primaryHref} className="btn-primary" style={{ padding: '14px 24px', fontSize: 15 }}>
                {primaryLabel} <ArrowRight size={16} />
              </Link>
              <a href="#tiers" className="hx-ghost">See how tiers work</a>
            </div>
          </div>

          <div className="hx-card hx-live">
            <div className="hx-live-head">
              <strong>Market pricing</strong>
              <SourceChip source={priceSources["BTC/USD"]} feedError={feedError} />
            </div>
            <PriceSpark history={history} symbol="BTC/USD" />
            <div className="hx-spark-cap">BTC/USD · recent price history from this session</div>
            {symbols.map((symbol) => (
              <div key={symbol} className="hx-row">
                <span>{symbol}<SourceChip source={priceSources[symbol]} feedError={feedError} /></span>
                <b>{formatPrice(prices[symbol])}</b>
              </div>
            ))}
          </div>
        </header>

        <div className="hx-band">
          <div><b>{symbols.length}</b><span>Instruments</span></div>
          <div><b>{TIERS.length}</b><span>Session tiers</span></div>
          <div><b>{maxPayout ? `${maxPayout}%` : '—'}</b><span>Highest payout cap</span></div>
          <div><b>100%</b><span>Of actions logged</span></div>
        </div>
      </div>

      <div className="hx-wrap">
        <section className="hx-sec" id="tiers">
          <div className="hx-sec-head">
            <h2>Choose a tier</h2>
            <p>Every tier caps the maximum payout on a gain. Losses are never capped — real risk stays real.</p>
          </div>
          <div className="hx-tiers">
            {TIERS.map((tier, i) => {
              const TierIcon = [Sprout, TrendingUp, Gem][i] || Crown
              return (
                <div key={tier.id} className="hx-card hx-tier">
                  <div className="hx-tier-top">
                    <div className="hx-tier-ic"><TierIcon size={18} /></div>
                    <h3>{tier.name}</h3>
                  </div>
                  <p>{tier.description}</p>
                  <div className="hx-kv"><span>Session amount</span><b>{formatMoney(tier.minDeposit)} – {formatMoney(tier.maxDeposit)}</b></div>
                  {tier.durationRange && (
                    <div className="hx-kv"><span>Duration</span><b>{tier.durationRange.min}–{tier.durationRange.max} days</b></div>
                  )}
                  <div className="hx-kv"><span>Max payout on a gain</span><b>{tier.maxPayoutMultiplier * 100}%</b></div>
                  <div className="hx-kv"><span>Loss cap</span><b>None</b></div>
                  <Link to={primaryHref} className="btn-primary" style={{ padding: '12px', fontSize: 14 }}>
                    {currentUser ? 'Open dashboard' : 'Get started'} <ArrowRight size={15} />
                  </Link>
                </div>
              )
            })}
          </div>
          <p className="hx-note">
            Larger accounts are set up individually — reach out after signing up and we'll configure it directly.
          </p>
        </section>

        <section className="hx-sec" id="markets">
          <div className="hx-sec-head">
            <h2>Instruments</h2>
            <p>What every session is priced against. Each price is labelled with where it comes from.</p>
          </div>
          <div className="hx-card hx-table">
            <table>
              <thead>
                <tr><th>Instrument</th><th>Type</th><th>Source</th><th className="num">Price</th></tr>
              </thead>
              <tbody>
                {symbols.map((symbol) => {
                  const info = SYMBOL_INFO[symbol] || { name: symbol, type: '—', short: symbol.slice(0, 2) }
                  return (
                    <tr key={symbol}>
                      <td><div className="hx-sym"><i>{info.short}</i><div>{symbol}<small>{info.name}</small></div></div></td>
                      <td>{info.type}</td>
                      <td><SourceChip source={priceSources[symbol]} feedError={feedError} /></td>
                      <td className="num"><b>{formatPrice(prices[symbol])}</b></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="hx-sec" id="features">
          <div className="hx-sec-head">
            <h2>Why it feels different</h2>
            <p>No guaranteed returns, no invented numbers — just a transparent system.</p>
          </div>
          <div className="hx-feats">
            {BENEFITS.map((b) => (
              <div className="hx-card hx-feat" key={b.title}>
                <div className="hx-feat-ic"><b.icon size={20} /></div>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="hx-sec" id="how-it-works">
          <div className="hx-sec-head"><h2>How it works</h2></div>
          <div className="hx-steps">
            {STEPS.map((s, i) => (
              <div className="hx-card hx-step" key={s.title}>
                <div className="hx-step-n">{i + 1}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {settings.helpQA.length > 0 && (
          <section className="hx-sec" id="faq">
            <div className="hx-sec-head"><h2>Common questions</h2></div>
            <div className="hx-faq">
              {settings.helpQA.slice(0, 6).map((qa) => (
                <details key={qa.id}>
                  <summary>{qa.question}</summary>
                  <p>{qa.answer}</p>
                </details>
              ))}
            </div>
            <p style={{ marginTop: 18 }}>
              <Link to="/help" style={{ color: 'var(--accent-bright)', fontSize: 13.5, fontWeight: 600 }}>See all help articles →</Link>
            </p>
          </section>
        )}
      </div>

      <div className="hx-trust" style={{ marginTop: 64 }}>
        <span><ShieldCheck size={14} /> Deposits reviewed before they affect your balance</span>
        <span><CheckCircle2 size={14} /> Session results certified by a manager, not auto-posted</span>
        <span><Layers size={14} /> Full audit log of every account action</span>
        {settings.companyEmail && <span><Mail size={14} /> {settings.companyEmail}</span>}
        {settings.companyPhone && <span><Phone size={14} /> {settings.companyPhone}</span>}
      </div>

      <PublicFooter />
    </div>
  )
}
