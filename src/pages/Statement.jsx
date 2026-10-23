import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout.jsx'
import { Download, Printer, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { apiRequest } from '../api/client.js'
import { toCsv, downloadTextFile } from '../utils/csv.js'

// Account statement. All numbers come from GET /api/statements (computed on
// the server from approved transactions, so they always match the balance).
// This page only picks the dates, shows the result, and exports it:
//   - Download CSV: built here with the same injection-safe helper the audit
//     log uses.
//   - Print / Save as PDF: uses the browser's print dialog ("Save as PDF"
//     there). The @media print rules below hide the menu so only the
//     statement prints.

const money = (n) => Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const signedMoney = (n) => (n > 0 ? '+' : '') + money(n)
const dateOnly = (d) => d.toISOString().slice(0, 10)
const niceDate = (iso) => new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'

function presetRange(key) {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  if (key === 'this-month') return [dateOnly(new Date(Date.UTC(y, m, 1))), dateOnly(now)]
  if (key === 'last-month') return [dateOnly(new Date(Date.UTC(y, m - 1, 1))), dateOnly(new Date(Date.UTC(y, m, 0)))]
  if (key === 'last-90') return [dateOnly(new Date(now.getTime() - 89 * 86400000)), dateOnly(now)]
  return [dateOnly(new Date(Date.UTC(y, 0, 1))), dateOnly(now)] // this-year
}

const PRESETS = [
  ['this-month', 'This month'],
  ['last-month', 'Last month'],
  ['last-90', 'Last 90 days'],
  ['this-year', 'This year']
]

const printCss = `
@media print {
  .sidebar, .topbar, .sidebar-backdrop, .no-print { display: none !important; }
  .main { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  body, .app-shell { background: #fff !important; color: #000 !important; }
  .statement-sheet, .statement-sheet * { color: #000 !important; background: transparent !important; box-shadow: none !important; }
  .statement-sheet .stat-card { border: 1px solid #999 !important; }
  .statement-table th, .statement-table td { border-bottom: 1px solid #ccc !important; }
}
`

export default function Statement() {
  const { currentUser, users } = useAuth()
  const { brand } = useSettings()
  const isAdmin = currentUser?.role === 'admin'
  const clients = useMemo(() => (users || []).filter((u) => u.role !== 'admin'), [users])

  const [range, setRange] = useState(() => presetRange('this-month'))
  const [clientId, setClientId] = useState('')
  const [statement, setStatement] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Admins must pick a client; a client always sees their own.
  const targetId = isAdmin ? clientId : currentUser?.id

  useEffect(() => {
    if (!targetId) { setStatement(null); return }
    let cancelled = false
    setLoading(true)
    setError('')
    const query = `from=${range[0]}&to=${range[1]}` + (isAdmin ? `&userId=${targetId}` : '')
    apiRequest(`/api/statements?${query}`).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.error) { setStatement(null); setError(result.error); return }
      setStatement(result)
    })
    return () => { cancelled = true }
  }, [targetId, range, isAdmin])

  function exportCsv() {
    if (!statement) return
    const rows = statement.lines.map((l) => [niceDate(l.date), l.description, l.change.toFixed(2), l.balance.toFixed(2)])
    rows.unshift(['', 'Opening balance', '', statement.openingBalance.toFixed(2)])
    rows.push(['', 'Closing balance', '', statement.closingBalance.toFixed(2)])
    const safeName = statement.client.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client'
    downloadTextFile(`statement-${safeName}-${statement.period.from}-to-${statement.period.to}.csv`, toCsv(['Date (UTC)', 'Description', 'Amount (USD)', 'Balance (USD)'], rows))
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }

  return (
    <Layout pageTitle="Statement">
      <style>{printCss}</style>
      <div className="no-print">
        <h1 className="page-title">Account Statement</h1>
        <p className="page-sub">Every approved deposit, withdrawal, session result and bonus in the period, with a running balance. Amounts in USD, dates in UTC.</p>

        <div className="panel" style={{ padding: 16, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          {isAdmin && (
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Client
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={{ ...inputStyle, display: 'block', marginTop: 4, minWidth: 200 }}>
                <option value="">Choose a client…</option>
                {clients.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </label>
          )}
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            From
            <input type="date" value={range[0]} max={range[1]} onChange={(e) => e.target.value && setRange([e.target.value, range[1]])} style={{ ...inputStyle, display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            To
            <input type="date" value={range[1]} min={range[0]} onChange={(e) => e.target.value && setRange([range[0], e.target.value])} style={{ ...inputStyle, display: 'block', marginTop: 4 }} />
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESETS.map(([key, label]) => (
              <button key={key} type="button" className="tx-btn" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => setRange(presetRange(key))}>{label}</button>
            ))}
          </div>
        </div>

        {error && <div role="alert" style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: '#7f1d1d', color: '#fff', fontSize: 13 }}>{error}</div>}
        {isAdmin && !clientId && <div className="empty-state"><p>Choose a client to see their statement.</p></div>}
        {loading && <div className="empty-state"><p>Loading…</p></div>}
      </div>

      {statement && !loading && (
        <div className="statement-sheet">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{brand.name} · Account statement</div>
            <h2 style={{ margin: '2px 0' }}>{statement.client.name}</h2>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {statement.client.email} · ID {statement.client.uid} · {statement.period.from} to {statement.period.to}
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Opening balance</div><div className="stat-value">{money(statement.openingBalance)}</div></div>
            <div className="stat-card"><div className="stat-label">Deposits</div><div className="stat-value">{money(statement.totals.deposits)}</div></div>
            <div className="stat-card"><div className="stat-label">Withdrawals</div><div className="stat-value">{money(statement.totals.withdrawals)}</div></div>
            <div className="stat-card"><div className="stat-label">Session results</div><div className={'stat-value ' + (statement.totals.sessionResults >= 0 ? 'pnl-up' : 'pnl-down')}>{signedMoney(statement.totals.sessionResults)}</div></div>
            <div className="stat-card"><div className="stat-label">Bonuses</div><div className="stat-value">{money(statement.totals.bonuses)}</div></div>
            <div className="stat-card" style={{ borderColor: 'var(--accent)' }}><div className="stat-label">Closing balance</div><div className="stat-value">{money(statement.closingBalance)}</div></div>
          </div>

          <div className="panel" style={{ marginTop: 16, overflowX: 'auto' }}>
            {statement.lines.length === 0 ? (
              <div className="empty-state"><FileText size={22} /><p>No approved activity in this period.</p></div>
            ) : (
              <table className="statement-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 14px' }}>Date (UTC)</th>
                    <th style={{ padding: '10px 14px' }}>Description</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.lines.map((l) => (
                    <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{niceDate(l.date)}</td>
                      <td style={{ padding: '10px 14px' }}>{l.description}</td>
                      <td className={l.change >= 0 ? 'pnl-up' : 'pnl-down'} style={{ padding: '10px 14px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{signedMoney(l.change)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{money(l.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10 }}>
            Generated {niceDate(new Date().toISOString())}. Pending and rejected requests are not included. Fees do not change the main balance and are shown on your Fee Balance instead.
          </p>

          <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="tx-btn" onClick={exportCsv}><Download size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Download CSV</button>
            <button type="button" className="tx-btn" onClick={() => window.print()}><Printer size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Print / Save as PDF</button>
          </div>
        </div>
      )}
    </Layout>
  )
}
