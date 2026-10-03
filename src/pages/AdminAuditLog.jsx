import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Trash2, UserCog, Receipt, Percent, Gift, Star, Flag, Users2, Search, Zap, Clock, ArrowUpRight, ArrowDownRight, ChevronDown, History, Camera } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAudit } from '../context/AuditContext.jsx'

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Same underscore-to-Title-Case convention as formatType() in
// Transactions.jsx/TransactionHistory.jsx — kept local rather than
// imported since audit actions and transaction types are different
// vocabularies that just happen to follow the same naming style.
function formatAction(action) {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Renders an entry's `details` object as short "key: value" chips.
// Deliberately generic — every action logs a different shape, and
// this page shouldn't need a new case added every time a new action
// starts logging. The one exception is `deletedTransaction`, which
// is a full transaction object and too noisy to show inline; it's
// summarized instead of dumped.
function DetailChips({ details }) {
  if (!details || Object.keys(details).length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {Object.entries(details).map(([key, value]) => {
        if (value === null || value === undefined || value === '') return null
        const display =
          key === 'deletedTransaction'
            ? `${value.type} · $${value.amount}`
            : Array.isArray(value)
              ? value.join(', ')
              : String(value)
        return (
          <span
            key={key}
            style={{
              fontSize: 11.5, padding: '2px 8px', borderRadius: 999,
              background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)'
            }}
          >
            {formatAction(key)}: {display}
          </span>
        )
      })}
    </div>
  )
}

const ACTION_ICONS = {
  transaction_deleted: Trash2,
  profile_updated: UserCog,
  fee_charged: Receipt,
  fee_discount_applied: Percent,
  tier_changed: Star,
  vip_unlocked: Star,
  vip_revoked: Star,
  flagged_for_review: Flag,
  demo_clients_generated: Users2,
  demo_clients_removed: Users2,
  session_leverage_changed: Zap,
  session_duration_changed: Clock,
  session_position_opened: ArrowUpRight,
  session_position_closed: ArrowDownRight,
  deposit_proof_submitted: Camera
}
function iconFor(action) {
  if (action.startsWith('referral_campaign')) return Gift
  return ACTION_ICONS[action] || ClipboardList
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Comparator per sort mode. 'newest'/'oldest' sort the timestamp;
// 'client'/'action' group alphabetically and use timestamp (newest
// first) as the tiebreaker within a group, so entries for the same
// client or action still read chronologically once grouped.
const SORTERS = {
  newest: (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
  oldest: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  client: (a, b) =>
    (a.targetUserName || '').localeCompare(b.targetUserName || '') ||
    new Date(b.timestamp) - new Date(a.timestamp),
  action: (a, b) =>
    formatAction(a.action).localeCompare(formatAction(b.action)) ||
    new Date(b.timestamp) - new Date(a.timestamp)
}

export default function AdminAuditLog() {
  const { auditLog } = useAudit()
  const [actionFilter, setActionFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [search, setSearch] = useState('')
  const [showOlder, setShowOlder] = useState(false)

  // Built from whatever actions/clients actually appear in the log,
  // so these lists never go stale as new logAudit() call sites (or
  // new clients) get added elsewhere — no hardcoded list to maintain.
  const actionTypes = useMemo(
    () => Array.from(new Set(auditLog.map((e) => e.action))).sort(),
    [auditLog]
  )
  const clientNames = useMemo(
    () => Array.from(new Set(auditLog.filter((e) => e.targetUserName).map((e) => e.targetUserName))).sort(),
    [auditLog]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return auditLog
      .filter((e) => {
        if (actionFilter !== 'all' && e.action !== actionFilter) return false
        if (clientFilter !== 'all' && e.targetUserName !== clientFilter) return false
        if (!q) return true
        return (
          e.actorName?.toLowerCase().includes(q) ||
          e.targetUserName?.toLowerCase().includes(q) ||
          formatAction(e.action).toLowerCase().includes(q)
        )
      })
      .sort(SORTERS[sortBy])
  }, [auditLog, actionFilter, clientFilter, sortBy, search])

  // Entries over a week old collapse behind "Show older history" —
  // long-lived clients/actions can accumulate hundreds of entries,
  // and the last 7 days is what an admin actually needs on load.
  // Split (not truncated) so nothing is ever lost, just deferred.
  const cutoff = Date.now() - WEEK_MS
  const recent = filtered.filter((e) => new Date(e.timestamp).getTime() >= cutoff)
  const older = filtered.filter((e) => new Date(e.timestamp).getTime() < cutoff)

  return (
    <Layout pageTitle="Audit Log">
      <h1 className="page-title">Audit Log</h1>
      <p className="page-sub">
        Every state-changing action taken on this platform — who did it, to which client, and when.
        Read-only: nothing here can be edited or removed.
      </p>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by admin, client, or action…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          >
            <option value="all">All actions</option>
            {actionTypes.map((a) => (
              <option key={a} value={a}>{formatAction(a)}</option>
            ))}
          </select>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          >
            <option value="all">All clients</option>
            {clientNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          >
            <option value="newest">Sort: Newest first</option>
            <option value="oldest">Sort: Oldest first</option>
            <option value="client">Sort: Client name</option>
            <option value="action">Sort: Action type</option>
          </select>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3><ClipboardList size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</h3>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
            No audit entries match this filter.
          </div>
        ) : (
          <>
            <div style={{ padding: 16 }} className={sortBy === 'newest' || sortBy === 'oldest' ? 'stagger-in' : ''}>
              {recent.map((e) => (
                <AuditEntryRow key={e.id} entry={e} />
              ))}
              {recent.length === 0 && older.length > 0 && (
                <div style={{ padding: '12px 4px', color: 'var(--text-muted)', fontSize: 13 }}>
                  Nothing in the last 7 days for this filter.
                </div>
              )}
            </div>
            {older.length > 0 && (
              <div style={{ padding: '0 16px 16px' }}>
                <button
                  type="button"
                  className="tx-btn"
                  onClick={() => setShowOlder((v) => !v)}
                  style={{ width: '100%', justifyContent: 'center', padding: '9px 10px', fontSize: 12.5 }}
                >
                  <History size={13} />
                  {showOlder ? 'Hide' : 'Show'} older history ({older.length} entr{older.length === 1 ? 'y' : 'ies'} over a week old)
                  <ChevronDown size={12} style={{ transform: showOlder ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s var(--ease)' }} />
                </button>
                {showOlder && (
                  <div style={{ paddingTop: 12 }}>
                    {older.map((e) => (
                      <AuditEntryRow key={e.id} entry={e} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

function AuditEntryRow({ entry: e }) {
  const Icon = iconFor(e.action)
  return (
    <div className="entity-card">
      <div className="icon-badge"><Icon size={17} /></div>
      <div className="entity-card-body">
        <div className="entity-card-title">{formatAction(e.action)}</div>
        <div className="entity-card-meta">
          <span>{formatDate(e.timestamp)}</span>
          <span>By {e.actorName}</span>
          {e.targetUserName && (
            <span>Client: <Link to={`/admin/users/${e.targetUserId}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{e.targetUserName}</Link></span>
          )}
        </div>
        <DetailChips details={e.details} />
      </div>
    </div>
  )
}
