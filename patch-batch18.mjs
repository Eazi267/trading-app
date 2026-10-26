// Run from your project root:  node patch-batch18.mjs
// Batch 18 (email verification + forgot password): edits 3 existing frontend
// files. The new pages (ForgotPassword, VerifyEmail) and EmailVerifyBanner come
// in the zip.
// All-or-nothing: if any expected text can't be found, NOTHING is changed.
// Each changed file is first copied to <file>.bak. Safe to run twice.
import fs from 'fs'

const jobs = []
function job(file, steps) { jobs.push({ file, steps }) }

job('src/App.jsx', [
  { done: "import ForgotPassword", find: "import Signup from './pages/Signup.jsx'\n", put: "import Signup from './pages/Signup.jsx'\nimport ForgotPassword from './pages/ForgotPassword.jsx'\nimport VerifyEmail from './pages/VerifyEmail.jsx'\n" },
  { done: 'path="/forgot-password"', find: '            <Route path="/signup" element={<Signup />} />\n',
    put: '            <Route path="/signup" element={<Signup />} />\n            <Route path="/forgot-password" element={<ForgotPassword />} />\n            <Route path="/verify-email" element={<ProtectedRoute><VerifyEmail /></ProtectedRoute>} />\n' }
])
job('src/pages/Login.jsx', [
  { done: 'href="/forgot-password"', find: "          {challenge && (\n",
    put: "          {!challenge && (\n            <p style={{ textAlign: 'right', fontSize: 13, margin: '6px 0 0' }}>\n              <a href=\"/forgot-password\" style={{ color: 'var(--accent-bright)' }}>Forgot password?</a>\n            </p>\n          )}\n\n          {challenge && (\n" }
])
job('src/components/Layout.jsx', [
  { done: "import EmailVerifyBanner", find: "import RippleEffect from './RippleEffect.jsx'\n", put: "import RippleEffect from './RippleEffect.jsx'\nimport EmailVerifyBanner from './EmailVerifyBanner.jsx'\n" },
  { done: '<EmailVerifyBanner />', find: '<div className="page-content fade-in-up" key={pageTitle}>{children}</div>', put: '<div className="page-content fade-in-up" key={pageTitle}><EmailVerifyBanner />{children}</div>' }
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
