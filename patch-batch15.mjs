// Run from your project root:  node patch-batch15.mjs
// Batch 15 (admin two-factor login + removing the dead delete button):
// edits 4 existing frontend files. TwoFactorPanel.jsx comes in the zip.
// All-or-nothing: if any expected text can't be found, NOTHING is changed.
// Each changed file is first copied to <file>.bak. Safe to run twice.
import fs from 'fs'

const jobs = []
function job(file, steps) { jobs.push({ file, steps }) }

// ---- login: a two-factor account first gets a "challenge", then sends the code
job('src/context/AuthContext.jsx', [
  { done: 'result.twoFactorRequired',
    find: "auth: false })\n    if (result.error) return { error: result.error }\n    setToken(result.token)\n    setCurrentUser(result.user)\n    if (result.user.role === 'admin') refreshUsers()\n    return { user: result.user }\n  }\n",
    put: "auth: false })\n    if (result.error) return { error: result.error }\n    if (result.twoFactorRequired) return { twoFactor: { challenge: result.challenge } }\n    setToken(result.token)\n    setCurrentUser(result.user)\n    if (result.user.role === 'admin') refreshUsers()\n    return { user: result.user }\n  }\n\n  // Second step for accounts with two-factor on: the 6-digit code (or a recovery code).\n  async function completeTwoFactor(challenge, code) {\n    const result = await apiRequest('/api/auth/login/2fa', { method: 'POST', body: { challenge, code }, auth: false })\n    if (result.error) return { error: result.error }\n    setToken(result.token)\n    setCurrentUser(result.user)\n    if (result.user.role === 'admin') refreshUsers()\n    return { user: result.user }\n  }\n" },
  { done: 'login, completeTwoFactor, signup', find: '      login, signup, logout,', put: '      login, completeTwoFactor, signup, logout,' }
])
job('src/pages/Login.jsx', [
  { done: 'setChallenge', find: "  const [error, setError] = useState('')\n  const { login } = useAuth()\n",
    put: "  const [error, setError] = useState('')\n  const [challenge, setChallenge] = useState(null)\n  const [code, setCode] = useState('')\n  const { login, completeTwoFactor } = useAuth()\n" },
  { done: 'completeTwoFactor(challenge, code)', find: "    const result = await login(email, password)\n    if (result.user) {\n",
    put: "    if (challenge) {\n      const second = await completeTwoFactor(challenge, code)\n      if (second.user) navigate('/dashboard')\n      else setError(second.error)\n      return\n    }\n    const result = await login(email, password)\n    if (result.twoFactor) { setChallenge(result.twoFactor.challenge); return }\n    if (result.user) {\n" },
  { done: 'one-time-code', find: '          <button type="submit" className="btn-primary">\n            Log in',
    put: '          {challenge && (\n            <>\n              <label>6-digit code from your authenticator app</label>\n              <div className="field-input-wrap">\n                <ShieldCheck size={16} />\n                <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456 (or a recovery code)" autoFocus required />\n              </div>\n            </>\n          )}\n\n          <button type="submit" className="btn-primary">\n            Log in' }
])
// ---- Settings page: admins get the Two-factor card above "Change password"
job('src/pages/Settings.jsx', [
  { done: "import TwoFactorPanel", find: "import CopyButton from '../components/CopyButton.jsx'\n", put: "import CopyButton from '../components/CopyButton.jsx'\nimport TwoFactorPanel from '../components/TwoFactorPanel.jsx'\n" },
  { done: '<TwoFactorPanel />', find: '      <div className="panel" style={{ maxWidth: 480, marginTop: 16 }}>\n        <div className="panel-head">\n          <h3><Lock size={15}',
    put: "      {currentUser.role === 'admin' && <TwoFactorPanel />}\n\n      <div className=\"panel\" style={{ maxWidth: 480, marginTop: 16 }}>\n        <div className=\"panel-head\">\n          <h3><Lock size={15}" }
])
// ---- the bin button did nothing (the server never deletes money records): removed
job('src/pages/AdminUserDetail.jsx', [
  { done: 'Delete removed on purpose', find: "                    <button\n                      className=\"tx-btn\"\n                      style={{ padding: '6px 10px', fontSize: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--danger)' }}\n                      onClick={() => { setDeletingTxId(t.id); setDeleteReason(''); setDeleteError('') }}\n                      aria-label=\"Delete transaction\"\n                    >\n                      <Trash2 size={13} />\n                    </button>\n", put: "                    {/* Delete removed on purpose: money records are never deleted. Use Reverse in the transaction's View window. */}\n" }
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
