import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowDownToLine, ArrowUpFromLine, ListChecks, TrendingUp, TrendingDown } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSkeleton } from '../hooks/useSkeleton.js'
import { getTradeStats, getProfitBreakdown, getActiveTradeCount, getClosedPositions } from '../utils/analytics.js'
import { getTier } from '../config/tiers.js'
import { resolveDisplayCurrency, formatCurrency } from '../config/currencies.js'
import PerformanceHero from '../components/PerformanceHero.jsx'

const money = (n) => Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const when = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const TX_LABEL = {
  deposit: 'Deposit', withdrawal: 'Withdrawal', session_settlement: 'Session payout',
  capped_profit_release: 'Profit release', referral_bonus: 'Referral bonus',
  signup_bonus: 'Sign-up bonus', reversal: 'Reversal', fee: 'Fee'
}
// +1 adds to the balance, -1 takes from it, 0 is balance-neutral (fees).
function txSign(t) {
  if (t.type === 'withdrawal') return -1
  if (t.type === 'fee') return 0
  if (t.type === 'reversal') return t.details?.direction === 'debit' ? -1 : 1
  return 1
}

export default function ClientDashboard() {
  const loading = useSkeleton(500)
  const { dataReady: _dataReady } = useApp()
  const { prices, orders, transactions, sessions, priceSources, getBalanceBreakdown, getSessionsForUser } = useApp()
  const { currentUser } = useAuth()
  const { settings } = useSettings()
  const [tab, setTab] = useState('tx')

  const { total, available } = getBalanceBreakdown(currentUser.id)
  const inSessions = Math.max(0, total - available)
  const displayCurrency = resolveDisplayCurrency(currentUser, settings.currencyCode)
  const mySessions = getSessionsForUser(currentUser.id)
  const activeSessions = mySessions.filter((s) => s.status === 'active')

  const stats = getTradeStats(orders, currentUser.id)
  const profit = getProfitBreakdown(transactions, currentUser.id)
  const activeTrades = getActiveTradeCount(sessions, currentUser.id)
  const recentTrades = getClosedPositions(orders, currentUser.id).slice(0, 6)
  const openPositions = activeSessions.flatMap((s) => s.positions.map((p) => ({ ...p, tierName: getTier(s.tierId)?.name })))
  const recentTx = transactions
    .filter((t) => t.userId === currentUser.id && (t.status === 'approved' || t.status === 'pending'))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6)

  const firstName = (currentUser.name || '').split(' ')[0] || 'there'

  return (
    <div className="dz">
      <header className="dz-head">
        <div>
          <div className="dz-muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="dz-title">{greeting()}, {firstName}</h1>
        </div>
      </header>

      {mySessions.length === 0 && (
        <div className="dz-card dz-cta">
          <div>
            <strong>Set up your first investment</strong>
            <div className="dz-muted">{available > 0 ? 'Choose a tier and commit part of your balance to start.' : 'Deposit first, then choose a tier to start investing.'}</div>
          </div>
          <Link to={available > 0 ? '/sessions' : '/transactions'} className="btn-primary dz-btn">{available > 0 ? 'Choose an investment' : 'Deposit funds'} <ArrowRight size={14} /></Link>
        </div>
      )}

      {loading || !_dataReady ? (
        <div className="dz-grid">
          <div className="dz-card dz-hero"><div className="skeleton" style={{ height: 300 }} /></div>
          <div className="dz-side"><div className="dz-card"><div className="skeleton" style={{ height: 110 }} /></div><div className="dz-card"><div className="skeleton" style={{ height: 80 }} /></div></div>
        </div>
      ) : (
        <div className="dz-grid fade-in-up">
          <div className="dz-main">
            <PerformanceHero
              transactions={transactions} userId={currentUser.id} total={total}
              equivalent={displayCurrency.code !== 'USD' ? `≈ ${formatCurrency(total, displayCurrency.code)}` : undefined}
            />
          </div>

          <aside className="dz-side">
            <div className="dz-card">
              <div className="dz-label">Available to invest</div>
              <div className="dz-num mono">{money(available)}</div>
              <div className="dz-label" style={{ marginTop: 14 }}>In sessions</div>
              <div className="dz-num mono">{money(inSessions)}</div>
            </div>
            <div className="dz-card">
              <div className="dz-actions">
                <Link to="/transactions" className="btn-primary dz-btn"><ArrowDownToLine size={15} /> Deposit</Link>
                <Link to="/transactions" className="dz-btn dz-btn-o"><ArrowUpFromLine size={15} /> Withdraw</Link>
                <Link to="/sessions" className="dz-btn dz-btn-o"><ListChecks size={15} /> Invest</Link>
              </div>
              <div className="dz-muted" style={{ fontSize: 11.5, marginTop: 10 }}>Deposits and withdrawals are reviewed before they change your balance.</div>
            </div>
        <div className="dz-card dz-stats">
          <div><span className="dz-label">Today’s profit</span><strong className={'mono ' + (profit.today > 0 ? 'pnl-up' : profit.today < 0 ? 'pnl-down' : '')}>{profit.today > 0 ? '+' : ''}{money(profit.today)}</strong></div>
          <div><span className="dz-label">Settled P&amp;L, all time</span><strong className={'mono ' + (profit.allTime > 0 ? 'pnl-up' : profit.allTime < 0 ? 'pnl-down' : '')}>{profit.allTime > 0 ? '+' : ''}{money(profit.allTime)}</strong></div>
          <div><span className="dz-label">Win rate</span><strong className="mono">{stats.totalTrades === 0 ? '—' : stats.winRate.toFixed(1) + '%'}</strong><em>{stats.totalTrades === 0 ? 'No closed trades yet' : `${stats.winningTrades}/${stats.totalTrades} trades`}</em></div>
          <div><span className="dz-label">Active trades</span><strong className="mono">{activeTrades}</strong></div>
        </div>
          </aside>
        </div>
      )}

      <div className="dz-row">
        <div className="dz-card">
          <div className="dz-card-head"><h3>Open positions</h3><Link to="/sessions">Manage <ArrowRight size={12} /></Link></div>
          {openPositions.length === 0 ? (
            <div className="dz-empty">No open positions right now.</div>
          ) : openPositions.map((p) => {
            const cur = prices[p.symbol]
            const pnl = p.marginAmount * p.leverage * ((cur - p.entryPrice) / p.entryPrice)
            return (
              <div className="dz-line" key={p.id}>
                <div><strong>{p.symbol}</strong> <span className="dz-muted">{p.leverage}x · {p.tierName}</span></div>
                <span className={'mono ' + (pnl >= 0 ? 'pnl-up' : 'pnl-down')}>{pnl >= 0 ? '+' : ''}{money(pnl)}</span>
              </div>
            )
          })}
        </div>

        <div className="dz-card">
          <div className="dz-card-head">
            <div className="dz-tabs">
              <button type="button" className={tab === 'tx' ? 'on' : ''} onClick={() => setTab('tx')}>Activity</button>
              <button type="button" className={tab === 'trades' ? 'on' : ''} onClick={() => setTab('trades')}>Closed trades</button>
            </div>
            <Link to={tab === 'tx' ? '/transaction-history' : '/analytics'}>All <ArrowRight size={12} /></Link>
          </div>
          {tab === 'tx' ? (
            recentTx.length === 0 ? <div className="dz-empty">No activity yet.</div> : recentTx.map((t) => {
              // A session payout can be a loss, so the effect on the balance
              // comes from sign x amount, never from the type alone.
              const effect = txSign(t) * Number(t.amount)
              const isResult = t.type === 'session_settlement' || t.type === 'capped_profit_release'
              return (
                <div className="dz-line" key={t.id}>
                  <div><strong>{TX_LABEL[t.type] || t.type}</strong>{t.status === 'pending' && <span className="dz-chip" style={{ marginLeft: 8 }}>Pending</span>}<div className="dz-muted">{when(t.date)}</div></div>
                  <span className={'mono ' + (isResult ? (effect >= 0 ? 'pnl-up' : 'pnl-down') : '')}>{effect > 0 ? '+' : effect < 0 ? '−' : ''}{money(Math.abs(effect || t.amount))}</span>
                </div>
              )
            })
          ) : (
            recentTrades.length === 0 ? <div className="dz-empty">No closed trades yet — they’ll show up here once a position closes.</div> : recentTrades.map((t) => (
              <div className="dz-line" key={t.id}>
                <div className="dz-trade">{t.pnl >= 0 ? <TrendingUp size={15} className="pnl-up" /> : <TrendingDown size={15} className="pnl-down" />}<div><strong>{t.symbol}</strong><div className="dz-muted">{money(t.marginAmount)} · {t.leverage}x · {when(t.date)}</div></div></div>
                <span className={'mono ' + (t.pnl >= 0 ? 'pnl-up' : 'pnl-down')}>{t.pnl >= 0 ? '+' : ''}{money(t.pnl)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="dz-ticks">
        {Object.entries(prices).map(([symbol, price]) => {
          const src = priceSources?.[symbol]
          return (
            <Link to="/markets" className="dz-tick" key={symbol}>
              <span className="dz-label">{symbol} <i className={'dz-src ' + (src || 'simulated')}>· {src === 'live' ? 'Live' : src === 'delayed' ? 'Delayed' : 'Simulated'}</i></span>
              <strong className="mono">{price.toFixed(price > 100 ? 2 : 4)}</strong>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
