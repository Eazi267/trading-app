// One-time (safe to re-run): moves KYC images that were stored inline inside
// users.kyc / users.kyc_enhanced into the encrypted kyc_files table and removes
// them from the user record. Run once after `npm run migrate`:
//   node encryptKycImages.js
import { pool } from './src/db.js'
import { parseDataUrl, saveKycFile } from './src/utils/kycFiles.js'

let moved = 0, skipped = 0
const { rows } = await pool.query("SELECT * FROM users WHERE kyc::text LIKE '%ImageDataUrl%' OR kyc_enhanced::text LIKE '%ImageDataUrl%'")
for (const u of rows) {
  for (const [col, slots] of [['kyc', [['frontImageDataUrl', 'front', 'hasFrontImage'], ['backImageDataUrl', 'back', 'hasBackImage']]], ['kyc_enhanced', [['frontImageDataUrl', 'enhanced', 'hasFrontImage']]]]) {
    const obj = u[col]
    if (!obj) continue
    const next = { ...obj }
    for (const [field, slot, flag] of slots) {
      if (!obj[field]) { if (field in obj) delete next[field]; continue }
      const parsed = parseDataUrl(obj[field].replace(/^(data:image\/jpg)/, 'data:image/jpeg'))
      // An unreadable legacy image is kept inline (not lost) and reported.
      if (parsed.error) { console.log(`skip user ${u.id} ${slot}: ${parsed.error}`); skipped++; continue }
      await saveKycFile(pool, u.id, slot, parsed)
      delete next[field]
      next[flag] = true
      moved++
    }
    await pool.query(`UPDATE users SET ${col} = $1 WHERE id = $2`, [JSON.stringify(next), u.id])
  }
}
console.log(`Done: ${moved} image(s) encrypted, ${skipped} skipped.`)
await pool.end()
