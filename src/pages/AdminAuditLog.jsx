import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Trash2, UserCog, Receipt, Percent, Gift, Star, Flag, Users2, Search, Zap, Clock, ArrowUpRight, ArrowDownRight, ChevronDown, History, Camera, Settings, LifeBuoy, ShieldCheck, Wallet, Play, RefreshCw, Download } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAudit } from '../context/AuditContext.jsx'
import { toCsv, downloadTextFile } from '../utils/csv.js'

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
    <span className="cl-tags">
      {Object.entries(details).map(([key, value]) => {
        if (value === null || value === undefined || value === '') return null
        const display =
          key === 'deletedTransaction'
            ? `${value.type} · $${value.amount}`
            : Array.isArray(value)
              ? value.join(', ')
              : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value)
        return <span key={key} className="dz-chip au-chip">{formatAction(key)}: {display}</span>
      })}
    </span>
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
// Actions recorded by the server follow a prefix convention, so a
// prefix match covers new actions without editing this list each time.
function iconFor(action) {
  if (ACTION_ICONS[action]) return ACTION_ICONS[action]
  if (action.startsWith('referral_campaign')) return Gift
  if (action.startsWith('support_')) return LifeBuoy
  if (action.startsWith('kyc_')) return ShieldCheck
  if (action.startsWith('wallet_')) return Wallet
  if (action.startsWith('session_')) return Play
  if (action.startsWith('admin_') || action.startsWith('user_')) return UserCog
  if (action === 'settings_updated') return Settings
  return ClipboardList
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
  const { fetchAuditLog } = useAudit()
  const [auditLog, setAuditLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [actionFilter, setActionFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [search, setSearch] = useState('')
  const [showOlder, setShowOlder] = useState(false)

  // The log lives on the server. Load the latest 1,000 entries on open,
  // re-check every 30s while this page is open, and on demand via the
  // Refresh button. (Filtering/searching below runs over what's loaded.)
  const load = useCallback(async () => {
    const result = await fetchAuditLog({ limit: 1000 })
    if (result.error) {
      setLoadError(result.error)
    } else {
      setLoadError('')
      setAuditLog(result.entries)
      setHasMore(result.hasMore)
    }
    setLoading(false)
  }, [fetchAuditLog])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

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

  // Exports exactly what's on screen (current filters + sort).
  function handleExport() {
    const csv = toCsv(
      ['Time (UTC)', 'Action', 'Done by', 'Client', 'Details'],
      filtered.map((e) => [
        new Date(e.timestamp).toISOString(),
        e.action,
        e.actorName,
        e.targetUserName || '',
        e.details && Object.keys(e.details).length ? JSON.stringify(e.details) : ''
      ])
    )
    downloadTextFile(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  // Entries over a week old collapse behind "Show older history" —
  // long-lived clients/actions can accumulate hundreds of entries,
  // and the last 7 days is what an admin actually needs on load.
  // Split (not truncated) so nothing is ever lost, just deferred.
  const cutoff = Date.now() - WEEK_MS
  const recent = filtered.filter((e) => new Date(e.timestamp).getTime() >= cutoff)
  const older = filtered.filter((e) => new Date(e.timestamp).getTime() < cutoff)

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const last24 = auditLog.filter((e) => new Date(e.timestamp).getTime() >= dayAgo).length
  const actors = new Set(auditLog.map((e) => e.actorName)).size

  return (
    <Layout pageTitle="Audit Log">
      <header className="dz-head">
        <h1 className="dz-title">Audit Log</h1>
        <div className="dz-muted">Every state-changing action on this platform: who did it, to which client, and when. Read-only. Entries are written by the server and the database refuses to change or delete them.</div>
      </header>

      {loadError && <div className="form-error" style={{ marginBottom: 16 }}>{loadError}</div>}

      <div className="ad-kpis ad-kpis-3">
        <div className="ad-kpi"><span className="ad-kpi-ico"><ClipboardList size={18} /></span><span className="ad-kpi-label">Entries loaded</span><b className="ad-kpi-value">{auditLog.length}</b></div>
        <div className="ad-kpi"><span className="ad-kpi-ico"><Clock size={18} /></span><span className="ad-kpi-label">Last 24 hours</span><b className="ad-kpi-value">{last24}</b></div>
        <div className="ad-kpi"><span className="ad-kpi-ico"><UserCog size={18} /></span><span className="ad-kpi-label">People who acted</span><b className="ad-kpi-value">{actors}</b></div>
      </div>

      <div className="dz-card">
        <div className="cl-tools">
          <label className="cl-search">
            <Search size={15} />
            <input type="text" placeholder="Search by admin, client, or action…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="cl-sort">
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} aria-label="Filter by action">
              <option value="all">All actions</option>
              {actionTypes.map((a) => <option key={a} value={a}>{formatAction(a)}</option>)}
            </select>
          </label>
          <label className="cl-sort">
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} aria-label="Filter by client">
              <option value="all">All clients</option>
              {clientNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="cl-sort">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="client">Client name</option>
              <option value="action">Action type</option>
            </select>
          </label>
        </div>

        <div className="dz-card-head">
          <h3>{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</h3>
          <span className="sc-actions">
            <button type="button" className="dz-btn-o" onClick={load}><RefreshCw size={12} /> Refresh</button>
            <button type="button" className="dz-btn-o" onClick={handleExport} disabled={filtered.length === 0}><Download size={12} /> Export CSV</button>
          </span>
        </div>
        {hasMore && <p className="dz-muted st-hint" style={{ marginTop: 0 }}>Showing the latest 1,000 entries. Older history exists in the database.</p>}

        {loading && auditLog.length === 0 ? (
          <div className="dz-empty">Loading the audit log…</div>
        ) : filtered.length === 0 ? (
          <div className="dz-empty">No audit entries match this filter.</div>
        ) : (
          <>
            <div className="rf-list">
              {recent.map((e) => <AuditEntryRow key={e.id} entry={e} />)}
              {recent.length === 0 && older.length > 0 && <div className="dz-empty">Nothing in the last 7 days for this filter.</div>}
            </div>
            {older.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button type="button" className="dz-btn-o au-older" onClick={() => setShowOlder((v) => !v)}>
                  <History size={13} />
                  {showOlder ? 'Hide' : 'Show'} older history ({older.length} entr{older.length === 1 ? 'y' : 'ies'} over a week old)
                  <ChevronDown size={12} style={{ transform: showOlder ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s var(--ease)' }} />
                </button>
                {showOlder && <div className="rf-list" style={{ marginTop: 8 }}>{older.map((e) => <AuditEntryRow key={e.id} entry={e} />)}</div>}
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
    <div className="rf-item au-row">
      <span className="rf-av"><Icon size={15} /></span>
      <span className="rf-who">
        <strong>{formatAction(e.action)}</strong>
        <span className="dz-muted">
          {formatDate(e.timestamp)} · By {e.actorName}
          {e.targetUserName && <> · Client: <Link to={`/admin/users/${e.targetUserId}`} className="ad-link" style={{ color: 'var(--accent-bright)' }}>{e.targetUserName}</Link></>}
        </span>
        <DetailChips details={e.details} />
      </span>
    </div>
  )
}
