// Run from your project root:  node patch-batch16.mjs
// Batch 16 (encrypted KYC images): edits src/pages/AdminUserDetail.jsx so the
// ID photos are loaded on demand instead of arriving inside the user record,
// and repairs a broken import in src/context/AppContext.jsx (see below).
// KycImage.jsx comes in the zip.
// All-or-nothing: if any expected text can't be found, NOTHING is changed.
// The changed file is first copied to <file>.bak. Safe to run twice.
import fs from 'fs'

const jobs = []
function job(file, steps) { jobs.push({ file, steps }) }

// ---- REPAIR: an editor Find-and-Replace had overwritten the function name
// `requestDepositVerification` with a wallet-address-like string (commits "gggg"
// and "SERVER"), which makes the site fail to build. Put the real name back.
job('src/context/AppContext.jsx', [
  { done: "import { requestDepositVerification } from '../services/blockchainVerification.js'",
    regex: /import \{ [A-Za-z0-9]+ \} from '\.\.\/services\/blockchainVerification\.js'/g, expect: 1,
    fn: () => "import { requestDepositVerification } from '../services/blockchainVerification.js'" },
  { done: '? requestDepositVerification({ method: details.depositMethod',
    regex: /\? [A-Za-z0-9]+\(\{ method: details\.depositMethod/g, expect: 1,
    fn: () => '? requestDepositVerification({ method: details.depositMethod' }
])

job('src/pages/AdminUserDetail.jsx', [
  { done: "import KycImage", find: "import { ArrowLeft, Send, Trash2,", put: "import KycImage from '../components/KycImage.jsx'\nimport { ArrowLeft, Send, Trash2," },
  { done: '<KycImage userId={targetUser.id} slot="front"',
    find: `<img src={targetUser.kyc.frontImageDataUrl} alt="Document front" style={{ width: 200, borderRadius: 8, border: '1px solid var(--border)' }} />`,
    put: `<KycImage userId={targetUser.id} slot="front" alt="Document front" style={{ width: 200, borderRadius: 8, border: '1px solid var(--border)' }} />` },
  { done: '{targetUser.kyc.hasBackImage && (', find: '{targetUser.kyc.backImageDataUrl && (', put: '{targetUser.kyc.hasBackImage && (' },
  { done: '<KycImage userId={targetUser.id} slot="back"',
    find: `<img src={targetUser.kyc.backImageDataUrl} alt="Document back" style={{ width: 200, borderRadius: 8, border: '1px solid var(--border)' }} />`,
    put: `<KycImage userId={targetUser.id} slot="back" alt="Document back" style={{ width: 200, borderRadius: 8, border: '1px solid var(--border)' }} />` },
  { done: '<KycImage userId={targetUser.id} slot="enhanced"',
    find: `<img src={targetUser.kycEnhanced.frontImageDataUrl} alt="Proof of address" style={{ width: 200, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14, display: 'block' }} />`,
    put: `<KycImage userId={targetUser.id} slot="enhanced" alt="Proof of address" style={{ width: 200, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14, display: 'block' }} />` }
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
