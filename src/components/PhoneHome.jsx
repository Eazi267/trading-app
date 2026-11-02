import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, ListChecks, ShieldCheck, Gift, History, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useApp, REAL_SYMBOLS } from '../context/AppContext.jsx'
import { dedupeSeriesForSymbol } from '../utils/priceCharts.js'

const money = (n) => Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const SRC = { live: 'Live', delayed: 'Delayed', simulated: 'Simulated' }

// Phone-only home (Bybit style). Hidden on wide screens by CSS (.ph-home).
// Shows: balance + Deposit, round quick actions, one notice card, market rows.
// Every number comes from the same data as the desktop dashboard.
export default function PhoneHome({ total, available, inSessions, todayProfit, needsVerify, kycOn, hasSessions }) {
  const { prices, history, priceSources } = useApp()
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('pulse_hide_balance') === '1' } catch { return false }
  })
  function toggleHidden() {
    const next = !hidden
    setHidden(next)
    try { localStorage.setItem('pulse_hide_balance', next ? '1' : '0') } catch { /* private mode */ }
  }
  const show = (n) => (hidden ? '••••••' : money(n))

  const rows = Object.keys(prices).map((sym) => {
    const first = dedupeSeriesForSymbol(history, sym)[0]?.[sym]
    const src = priceSources?.[sym] || (REAL_SYMBOLS.includes(sym) ? 'live' : 'simulated')
    return { sym, price: prices[sym], src, change: first ? Math.round(((prices[sym] - first) / first) * 10000) / 100 : 0 }
  })

  const actions = [
    { to: '/transactions?tab=deposit', icon: ArrowDownToLine, label: 'Deposit' },
    { to: '/transactions?tab=withdraw', icon: ArrowUpFromLine, label: 'Withdraw' },
    { to: '/sessions', icon: ListChecks, label: 'Invest' },
    { to: '/referral', icon: Gift, label: 'Refer' },
    kycOn ? { to: '/kyc', icon: ShieldCheck, label: 'Verify' } : { to: '/transaction-history', icon: History, label: 'History' }
  ]

  // One notice at a time, most useful first.
  const notice = needsVerify
    ? { icon: ShieldCheck, to: '/kyc', title: 'Verify your identity', text: 'Finish verification to unlock withdrawals.' }
    : !hasSessions
      ? { icon: ListChecks, to: available > 0 ? '/sessions' : '/transactions?tab=deposit', title: 'Start your first investment', text: available > 0 ? 'Choose a tier and commit part of your balance.' : 'Deposit first, then choose a tier.' }
      : { icon: Gift, to: '/referral', title: 'Invite friends', text: 'Share your referral link and earn a bonus.' }

  return (
    <div className="ph-home">
      <section className="ph-bal">
        <div className="ph-bal-top">
          <span>Total balance</span>
          <button type="button" className="ph-eye" onClick={toggleHidden} aria-label={hidden ? 'Show balance' : 'Hide balance'}>
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="ph-bal-num mono">{show(total)}</div>
        <div className="ph-bal-sub">
          Today <b className={todayProfit > 0 ? 'pnl-up' : todayProfit < 0 ? 'pnl-down' : ''}>{hidden ? '••••' : `${todayProfit > 0 ? '+' : ''}${money(todayProfit)}`}</b>
        </div>
        <div className="ph-bal-split">
          <div><span>Available</span><b className="mono">{show(available)}</b></div>
          <div><span>In sessions</span><b className="mono">{show(inSessions)}</b></div>
        </div>
        <Link to="/transactions?tab=deposit" className="ph-deposit"><ArrowDownToLine size={16} /> Deposit</Link>
      </section>

      <nav className="ph-actions" aria-label="Quick actions">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <Link key={a.label} to={a.to} className="ph-act">
              <span className="ph-act-ico"><Icon size={20} /></span>
              <span>{a.label}</span>
            </Link>
          )
        })}
      </nav>

      <Link to={notice.to} className="ph-notice">
        <span className="ph-notice-ico"><notice.icon size={18} /></span>
        <span className="ph-notice-text"><strong>{notice.title}</strong><small>{notice.text}</small></span>
        <ChevronRight size={16} />
      </Link>

      <section className="ph-markets">
        <div className="ph-markets-head"><h3>Markets</h3><Link to="/markets">See all <ChevronRight size={13} /></Link></div>
        {rows.map((r) => (
          <Link to="/markets" key={r.sym} className="ph-mrow">
            <span className="ph-coin">{r.sym.replace(/[^A-Za-z]/g, '').slice(0, 1)}</span>
            <span className="ph-mname"><strong>{r.sym}</strong><small>{SRC[r.src] || 'Simulated'}</small></span>
            <span className="ph-mprice mono">{r.price.toFixed(r.price > 100 ? 2 : 4)}</span>
            <span className={'ph-pill ' + (r.change > 0 ? 'up' : r.change < 0 ? 'down' : 'flat')}>{r.change > 0 ? '+' : ''}{r.change.toFixed(2)}%</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
