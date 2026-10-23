// Run from your project root:  node patch-batch13.mjs
// Batch 13 (reversals + statements): edits 7 existing frontend files.
// All-or-nothing: if any expected text can't be found, NOTHING is changed.
// Each changed file is first copied to <file>.bak. Safe to run twice.
import fs from 'fs'

const jobs = []
function job(file, steps) { jobs.push({ file, steps }) }

// ---- balance maths: a reversal adds or removes money per details.direction
job('src/context/AppContext.jsx', [
  { done: "t.type === 'reversal'", find: "        if (t.type === 'signup_bonus') return sum + t.amount\n        return sum\n",
    put: "        if (t.type === 'signup_bonus') return sum + t.amount\n        if (t.type === 'reversal') return sum + (t.details?.direction === 'debit' ? -t.amount : t.amount)\n        return sum\n" }
])
job('src/utils/adminAnalytics.js', [
  { done: "t.type === 'reversal'", find: "      if (t.type === 'signup_bonus') return sum + t.amount\n      return sum\n",
    put: "      if (t.type === 'signup_bonus') return sum + t.amount\n      if (t.type === 'reversal') return sum + (t.details?.direction === 'debit' ? -t.amount : t.amount)\n      return sum\n" }
])
job('src/utils/analytics.js', [
  { done: "t.type === 'reversal'", regex: /^( *)else if \(t\.type === 'signup_bonus'\) running \+= t\.amount\n/gm, expect: 2,
    fn: (m, indent) => m + indent + "else if (t.type === 'reversal') running += t.details?.direction === 'debit' ? -t.amount : t.amount\n" }
])
job('src/pages/TransactionHistory.jsx', [
  { done: 'RotateCcw', find: "Receipt, Gift, Percent } from 'lucide-react'", put: "Receipt, Gift, Percent, RotateCcw } from 'lucide-react'" },
  { done: 'RotateCcw size', find: "  if (type === 'fee_discount') return <Percent size={17} />\n", put: "  if (type === 'fee_discount') return <Percent size={17} />\n  if (type === 'reversal') return <RotateCcw size={17} />\n" },
  { done: "t.type === 'reversal'", find: "|| t.type === 'referral_bonus' || t.type === 'signup_bonus'\n", put: "|| t.type === 'referral_bonus' || t.type === 'signup_bonus' || (t.type === 'reversal' && t.details?.direction !== 'debit')\n" }
])

// ---- admin "Reverse this deposit/withdrawal" button in the detail modal
job('src/components/TransactionDetailModal.jsx', [
  { done: 'hasPermission', find: "import { METHOD_LABELS } from '../config/paymentMethods.js'\n",
    put: "import { METHOD_LABELS } from '../config/paymentMethods.js'\nimport { apiRequest } from '../api/client.js'\nimport { hasPermission } from '../config/adminTiers.js'\n" },
  { done: 'refreshTransactions', find: "  const { appealTransaction, submitDepositProof } = useApp()", put: "  const { appealTransaction, submitDepositProof, transactions, refreshTransactions } = useApp()" },
  { done: 'setReversing', find: "  const [submittingProof, setSubmittingProof] = useState(false)\n",
    put: "  const [submittingProof, setSubmittingProof] = useState(false)\n  const [reversing, setReversing] = useState(false)\n  const [reverseReason, setReverseReason] = useState('')\n  const [reverseError, setReverseError] = useState('')\n  const [reverseBusy, setReverseBusy] = useState(false)\n" },
  { done: 'handleReverse', find: "  async function handleSubmitProof() {", put: `  // Admin: cancel the effect of a mistaken APPROVED deposit/withdrawal by
  // adding an offsetting reversal entry (the original is never edited).
  const alreadyReversed = (transactions || []).some((x) => x.type === 'reversal' && String(x.details?.reversesTransactionId) === String(t.id))
  const canReverse = isAdmin && hasPermission(currentUser, 'finance') && t.status === 'approved' && (t.type === 'deposit' || t.type === 'withdrawal') && !alreadyReversed

  async function handleReverse() {
    setReverseBusy(true)
    const result = await apiRequest(\`/api/transactions/\${t.id}/reverse\`, { method: 'POST', body: { reason: reverseReason } })
    setReverseBusy(false)
    if (result.error) return setReverseError(result.error)
    await refreshTransactions()
    setReversing(false)
    setReverseReason('')
    onClose()
  }

  async function handleSubmitProof() {` },
  { done: 'alreadyReversed && (', find: `              {t.appealed && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Appealed</span>
                  <span>{formatDateTime(t.appealedAt)}</span>
                </div>
              )}
            </div>
`, put: `              {t.appealed && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Appealed</span>
                  <span>{formatDateTime(t.appealedAt)}</span>
                </div>
              )}
              {alreadyReversed && (
                <div style={{ color: 'var(--text-muted)' }}>This transaction has been reversed.</div>
              )}
            </div>
            {canReverse && !reversing && (
              <button type="button" className="tx-btn" style={{ marginTop: 10, padding: '7px 12px', fontSize: 12.5 }} onClick={() => setReversing(true)}>
                Reverse this {t.type}…
              </button>
            )}
            {canReverse && reversing && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {t.type === 'deposit'
                    ? "This takes the deposited money back out of the client's balance (refused if they no longer have it available)."
                    : "This returns the withdrawn money to the client's balance."}{' '}
                  The original stays in the history; an offsetting entry is added and the client is notified.
                </div>
                <textarea rows={2} value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="Reason (required, 5–500 characters)" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, resize: 'vertical' }} />
                {reverseError && <div role="alert" style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 6 }}>{reverseError}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" className="tx-btn" disabled={reverseBusy} onClick={handleReverse}>{reverseBusy ? 'Reversing…' : 'Confirm reversal'}</button>
                  <button type="button" className="tx-btn" disabled={reverseBusy} onClick={() => { setReversing(false); setReverseError('') }}>Cancel</button>
                </div>
              </div>
            )}
` }
])

// ---- Statements page: route + sidebar links
job('src/App.jsx', [
  { done: "import Statement from", find: "import TransactionHistory from './pages/TransactionHistory.jsx'\n", put: "import TransactionHistory from './pages/TransactionHistory.jsx'\nimport Statement from './pages/Statement.jsx'\n" },
  { done: 'path="/statement"', find: '            <Route path="/transaction-history" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />\n',
    put: '            <Route path="/transaction-history" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />\n            <Route path="/statement" element={<ProtectedRoute><Statement /></ProtectedRoute>} />\n' }
])
job('src/components/Sidebar.jsx', [
  { done: 'FileText', find: "TrendingUp, UserCog, LifeBuoy }", put: "TrendingUp, UserCog, LifeBuoy, FileText }" },
  { done: "icon: History },\n        { to: '/statement'",
    find: "        { to: '/transaction-history', label: 'Transaction History', icon: History }\n",
    put: "        { to: '/transaction-history', label: 'Transaction History', icon: History },\n        { to: '/statement', label: 'Statements', icon: FileText }\n" },
  { done: "icon: ArrowLeftRight },\n        { to: '/statement'",
    find: "        { to: '/transactions', label: 'Deposits & Withdrawals', icon: ArrowLeftRight }\n      ]\n    }] : []),",
    put: "        { to: '/transactions', label: 'Deposits & Withdrawals', icon: ArrowLeftRight },\n        { to: '/statement', label: 'Statements', icon: FileText }\n      ]\n    }] : []),",
  }
])

// ---------------- runner ----------------
const results = []
for (const { file, steps } of jobs) {
  if (!fs.existsSync(file)) { console.error(`Can't find ${file}. Run this from your project root. No changes were made.`); process.exit(1) }
  const raw = fs.readFileSync(file, 'utf8')
  const nl = raw.includes('\r\n') ? '\r\n' : '\n'
  let s = raw.replace(/\r\n/g, '\n')
  let changed = false
  for (const step of steps) {
    if (s.includes(step.done)) continue // already applied
    if (step.regex) {
      const count = (s.match(step.regex) || []).length
      if (count !== step.expect) { console.error(`${file}: expected ${step.expect} matches of ${step.regex}, found ${count}. No changes were made.`); process.exit(1) }
      s = s.replace(step.regex, step.fn)
    } else {
      if (!s.includes(step.find)) { console.error(`${file}: couldn't find:\n${step.find.slice(0, 160)}\nNo changes were made.`); process.exit(1) }
      s = s.replace(step.find, step.put)
    }
    changed = true
  }
  results.push({ file, raw, out: s.replace(/\n/g, nl), changed })
}
for (const r of results) {
  if (!r.changed) { console.log(`ok (already patched)  ${r.file}`); continue }
  fs.writeFileSync(r.file + '.bak', r.raw)
  fs.writeFileSync(r.file, r.out)
  console.log(`patched               ${r.file}`)
}
console.log('Done. Delete the .bak files once everything works.')
