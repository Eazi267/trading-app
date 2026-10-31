import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Plus, ArrowDownToLine, ArrowUpFromLine, ListChecks, Settings2, Star, ChevronRight, RotateCcw, ClipboardCheck, LifeBuoy, TrendingUp, Megaphone, Users } from 'lucide-react'
import { useNavModel } from './navModel.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useSupport } from '../context/SupportContext.jsx'
import { hasPermission } from '../config/adminTiers.js'
import BottomSheet from './BottomSheet.jsx'
import { useFavoriteTabs, MAX_TABS, MIN_TABS, ADMIN_DEFAULT_TABS } from '../hooks/useFavorites.js'

// Short names for the tab labels (the full menu keeps the long names).
const SHORT = {
  '/dashboard': 'Home', '/markets': 'Markets', '/sessions': 'Invest', '/balance': 'Balance', '/analytics': 'Stats',
  '/transactions': 'Funds', '/transaction-history': 'History', '/referral': 'Refer', '/notifications': 'Alerts',
  '/support': 'Support', '/kyc': 'Verify', '/settings': 'Settings',
  // admin pages
  '/admin/users': 'Clients', '/admin/trading': 'Trade', '/admin/support': 'Inbox', '/admin/broadcast': 'Broadcast',
  '/admin/scenario': 'Scenario', '/admin/referral-campaigns': 'Referral', '/admin/business-settings': 'Business',
  '/admin/audit-log': 'Audit', '/admin/email-outbox': 'Outbox', '/admin/accounts': 'Admins', '/admin/generate-clients': 'Demo'
}

function TabLink({ page }) {
  const Icon = page.icon
  return (
    <NavLink to={page.to} end={page.end} aria-label={page.label} className={({ isActive }) => 'm-bar-tab' + (isActive ? ' active' : '')}>
      <Icon size={21} />
      <span>{SHORT[page.to] || page.label}</span>
    </NavLink>
  )
}

// Full-width bottom bar for phones (Bybit / Bitget style).
// Four favourite pages (editable) around a raised centre "+" button that opens
// quick actions. Clients get Deposit / Withdraw / Invest; admins get Review
// requests / Support inbox / Trading console / Broadcast / Clients, each shown
// only if their admin tier can open it, with live counts on the button.
export default function MobileDock() {
  const { isAdmin, sections } = useNavModel()
  const { currentUser } = useAuth()
  const { transactions } = useApp()
  const { unreadForAdminCount } = useSupport()
  const navigate = useNavigate()
  const pages = sections.flatMap((s) => s.links)
  const { paths, save, reset, isDefault } = useFavoriteTabs(currentUser?.id, pages, isAdmin ? ADMIN_DEFAULT_TABS : undefined)
  const [quickOpen, setQuickOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [typing, setTyping] = useState(false)

  // Hide the bar while a keyboard is up (typing in a form or the chat box).
  useEffect(() => {
    const isField = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
    const onIn = (e) => { if (isField(e.target)) setTyping(true) }
    const onOut = () => setTyping(false)
    window.addEventListener('focusin', onIn)
    window.addEventListener('focusout', onOut)
    return () => { window.removeEventListener('focusin', onIn); window.removeEventListener('focusout', onOut) }
  }, [])

  function go(to) {
    setQuickOpen(false)
    navigate(to)
  }

  function toggleTab(to) {
    if (paths.includes(to)) {
      if (paths.length > MIN_TABS) save(paths.filter((p) => p !== to))
    } else if (paths.length < MAX_TABS) {
      save([...paths, to])
    }
  }

  const can = (permission) => hasPermission(currentUser, permission)
  const pendingCount = isAdmin ? transactions.filter((t) => t.status === 'pending').length : 0
  const unread = isAdmin && can('support') ? unreadForAdminCount : 0
  const alertCount = (can('finance') ? pendingCount : 0) + unread

  const adminActions = [
    can('finance') && { to: '/transactions', icon: ClipboardCheck, gold: true, title: 'Review requests', sub: pendingCount > 0 ? `${pendingCount} waiting for you` : 'Nothing waiting', badge: pendingCount },
    can('support') && { to: '/admin/support', icon: LifeBuoy, title: 'Support inbox', sub: unread > 0 ? `${unread} unread` : 'All caught up', badge: unread },
    can('trade') && { to: '/admin/trading', icon: TrendingUp, title: 'Trading console', sub: 'Open positions for clients' },
    can('support') && { to: '/admin/broadcast', icon: Megaphone, title: 'Broadcast', sub: 'Message every client' },
    { to: '/admin/users', icon: Users, title: 'Clients', sub: 'Open an account' }
  ].filter(Boolean)

  const tabs = paths.map((to) => pages.find((p) => p.to === to)).filter(Boolean)
  const left = tabs.slice(0, Math.ceil(tabs.length / 2))
  const right = tabs.slice(Math.ceil(tabs.length / 2))

  return (
    <>
      <nav className={'m-bar' + (typing ? ' typing' : '')} aria-label="Main">
        {left.map((p) => <TabLink key={p.to} page={p} />)}
        <button type="button" className={'m-bar-plus' + (quickOpen ? ' open' : '')} onClick={() => setQuickOpen(true)} aria-label={isAdmin ? 'Quick actions: requests, support, trading' : 'Quick actions: deposit, withdraw, invest'}>
          <Plus size={26} strokeWidth={2.6} />
          {alertCount > 0 && <span className="m-plus-badge" aria-label={`${alertCount} need attention`}>{alertCount > 9 ? '9+' : alertCount}</span>}
        </button>
        {right.map((p) => <TabLink key={p.to} page={p} />)}
      </nav>

      <BottomSheet open={quickOpen} onClose={() => setQuickOpen(false)} title="Quick actions">
        {isAdmin ? adminActions.map((a) => {
          const Icon = a.icon
          return (
            <button key={a.to} type="button" className="m-qa" onClick={() => go(a.to)}>
              <span className={'m-qa-ico' + (a.gold ? ' gold' : '')}><Icon size={20} /></span>
              <span className="m-qa-text"><strong>{a.title}</strong><small>{a.sub}</small></span>
              {a.badge > 0 && <span className="m-qa-count">{a.badge}</span>}
              <ChevronRight size={16} />
            </button>
          )
        }) : (
          <>
        <button type="button" className="m-qa" onClick={() => go('/transactions?tab=deposit')}>
          <span className="m-qa-ico gold"><ArrowDownToLine size={20} /></span>
          <span className="m-qa-text"><strong>Deposit</strong><small>Add funds to your account</small></span>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="m-qa" onClick={() => go('/transactions?tab=withdraw')}>
          <span className="m-qa-ico"><ArrowUpFromLine size={20} /></span>
          <span className="m-qa-text"><strong>Withdraw</strong><small>Request a payout to your wallet</small></span>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="m-qa" onClick={() => go('/sessions')}>
          <span className="m-qa-ico"><ListChecks size={20} /></span>
          <span className="m-qa-text"><strong>Invest</strong><small>Start a new investment session</small></span>
          <ChevronRight size={16} />
        </button>
          </>
        )}
        <button type="button" className="m-qa-link" onClick={() => { setQuickOpen(false); setEditOpen(true) }}>
          <Settings2 size={15} /> Customize bottom tabs
        </button>
      </BottomSheet>

      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Customize bottom tabs">
        <p className="m-sheet-note">Pick {MIN_TABS} to {MAX_TABS} favourite pages. They appear in the bar in the order you tap them ({paths.length} of {MAX_TABS} chosen).</p>
        <div className="m-fav-list">
          {pages.map((p) => {
            const idx = paths.indexOf(p.to)
            const on = idx !== -1
            const Icon = p.icon
            const locked = (on && paths.length <= MIN_TABS) || (!on && paths.length >= MAX_TABS)
            return (
              <button key={p.to} type="button" className={'m-fav' + (on ? ' on' : '')} onClick={() => toggleTab(p.to)} disabled={locked} aria-pressed={on}>
                <span className="m-fav-ico"><Icon size={18} /></span>
                <span className="m-fav-name">{p.label}</span>
                {on ? <span className="m-fav-pos">{idx + 1}</span> : <Star size={16} className="m-fav-star" />}
              </button>
            )
          })}
        </div>
        <button type="button" className="m-qa-link" onClick={reset} disabled={isDefault}>
          <RotateCcw size={14} /> Reset to default
        </button>
      </BottomSheet>
    </>
  )
}
