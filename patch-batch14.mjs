// Run from your project root:  node patch-batch14.mjs
// Batch 14 (security hardening): edits 6 existing frontend files.
// Afterwards also run:  npm install dompurify
// All-or-nothing: if any expected text can't be found, NOTHING is changed.
// Each changed file is first copied to <file>.bak. Safe to run twice.
import fs from 'fs'

const jobs = []
function job(file, steps) { jobs.push({ file, steps }) }

// ---- password change: keep THIS browser signed in with the fresh token
job('src/context/AuthContext.jsx', [
  { done: 'if (result.token) setToken(result.token)',
    find: "body: { currentPassword, newPassword } })\n    if (result.error) return { error: result.error }\n    return { ok: true }\n",
    put: "body: { currentPassword, newPassword } })\n    if (result.error) return { error: result.error }\n    // The server signs you out everywhere else when the password changes and\n    // returns a fresh token so THIS browser stays signed in.\n    if (result.token) setToken(result.token)\n    return { ok: true }\n" }
])
// ---- password minimum is now 8 characters (the server enforces it)
job('src/pages/AdminAccounts.jsx', [
  { done: 'At least 8 characters', find: 'placeholder="At least 6 characters"', put: 'placeholder="At least 8 characters"' }
])
job('src/pages/Settings.jsx', [
  { done: 'minLength={8}', regex: /minLength=\{6\}/g, expect: 2, fn: () => 'minLength={8}' }
])
job('src/pages/Signup.jsx', [
  { done: 'minLength={8}', regex: /minLength=\{6\}/g, expect: 1, fn: () => 'minLength={8}' }
])
// ---- admin-written HTML is cleaned before it is shown (stops stored XSS)
job('src/pages/AboutUs.jsx', [
  { done: "import DOMPurify", find: "import PublicNav from", put: "import DOMPurify from 'dompurify'\nimport PublicNav from" },
  { done: 'DOMPurify.sanitize', find: '__html: settings.aboutUsHtml }', put: '__html: DOMPurify.sanitize(settings.aboutUsHtml) }' }
])
job('src/pages/PrivacyPolicy.jsx', [
  { done: "import DOMPurify", find: "import PublicNav from", put: "import DOMPurify from 'dompurify'\nimport PublicNav from" },
  { done: 'DOMPurify.sanitize', find: '__html: settings.privacyPolicyHtml }', put: '__html: DOMPurify.sanitize(settings.privacyPolicyHtml) }' }
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
console.log('Done. Now run: npm install dompurify   (then delete the .bak files once everything works)')
