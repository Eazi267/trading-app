// Run from your project root:  node patch-batch19.mjs
// Batch 19 (require two-factor for admins + steadier sessions): edits
// src/components/ProtectedRoute.jsx (admins without two-factor go to Settings) and
// src/context/AuthContext.jsx (a network hiccup no longer logs you out).
// TwoFactorPanel.jsx and src/api/client.js (both updated) come in the zip.
// All-or-nothing: if any expected text can't be found, NOTHING is changed.
// The changed file is first copied to <file>.bak. Safe to run twice.
import fs from 'fs'

const jobs = []
function job(file, steps) { jobs.push({ file, steps }) }

// ---- a network hiccup while restoring the session must not log you out
job('src/context/AuthContext.jsx', [
  { done: 'result.status === 401',
    find: "      } else {\n        setToken(null)\n      }\n      setLoading(false)",
    put: "      } else if (result.status === 401) {\n        // Only a real \"you are not logged in\" answer ends the session. A network\n        // blip must not log you out (or delete the cookie).\n        setToken(null)\n      }\n      setLoading(false)" }
])

job('src/components/ProtectedRoute.jsx', [
  { done: 'useLocation', find: "import { Navigate } from 'react-router-dom'", put: "import { Navigate, useLocation } from 'react-router-dom'" },
  { done: 'const location = useLocation()', find: "  const { currentUser, loading } = useAuth()\n", put: "  const { currentUser, loading } = useAuth()\n  const location = useLocation()\n" },
  { done: 'twoFactorSetupRequired', find: "  if (requireRole && currentUser.role !== requireRole) {",
    put: "  // House rule (server setting REQUIRE_ADMIN_2FA): admins without two-factor may only use Settings until they set it up.\n  if (currentUser.twoFactorSetupRequired && location.pathname !== '/settings') {\n    return <Navigate to=\"/settings\" replace />\n  }\n\n  if (requireRole && currentUser.role !== requireRole) {" }
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
