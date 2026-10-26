// Run from your project root:  node patch-batch20.mjs
// Batch 20 (admin switches + "Email this client"): edits 2 existing frontend files.
// The new components (AdminSecurityControls, ClientEmailPanel) come in the zip.
// All-or-nothing: if any expected text can't be found, NOTHING is changed.
// Each changed file is first copied to <file>.bak. Safe to run twice.
import fs from 'fs'

const jobs = []
function job(file, steps) { jobs.push({ file, steps }) }

job('src/pages/AdminAccounts.jsx', [
  { done: 'import AdminSecurityControls', find: "export default function AdminAccounts() {", put: "import AdminSecurityControls from '../components/AdminSecurityControls.jsx'\n\nexport default function AdminAccounts() {" },
  { done: '<AdminSecurityControls />', find: '      <div className="glass-card fade-in-up-1" style={{ marginBottom: 20 }}>\n        <div className="panel-head">\n          <h3><UserPlus',
    put: '      <AdminSecurityControls />\n\n      <div className="glass-card fade-in-up-1" style={{ marginBottom: 20 }}>\n        <div className="panel-head">\n          <h3><UserPlus' }
])
job('src/pages/AdminUserDetail.jsx', [
  { done: 'import ClientEmailPanel', find: "import KycImage from '../components/KycImage.jsx'\n", put: "import KycImage from '../components/KycImage.jsx'\nimport ClientEmailPanel from '../components/ClientEmailPanel.jsx'\n" },
  { done: '<ClientEmailPanel', find: '      <CollapsiblePanel title="Deposit / withdrawal history"',
    put: '      <ClientEmailPanel userId={targetUser.id} email={targetUser.email} transactions={userTransactions.filter((t) => t.type === \'deposit\' || t.type === \'withdrawal\')} />\n\n      <CollapsiblePanel title="Deposit / withdrawal history"' }
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
