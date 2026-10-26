import { encryptBuffer, decryptBuffer } from './fileCrypto.js'

const MAX_BYTES = 3.5 * 1024 * 1024 // per image, after decoding
// No SVG on purpose: it can carry scripts.
const DATA_URL = /^data:((?:image\/(?:jpeg|png|webp|gif|heic|heif|bmp))|application\/pdf);base64,([A-Za-z0-9+/=\s]+)$/

// Turns "data:image/png;base64,...." into { mime, buffer }, or { error }.
export function parseDataUrl(dataUrl) {
  const m = DATA_URL.exec(String(dataUrl || ''))
  if (!m) return { error: 'Upload a JPG, PNG, WebP or PDF file.' }
  const buffer = Buffer.from(m[2], 'base64')
  if (!buffer.length) return { error: 'That file is empty.' }
  if (buffer.length > MAX_BYTES) return { error: 'That file is too large (3.5 MB maximum). Use a smaller photo.' }
  return { mime: m[1], buffer }
}

// `db` is a pool or a transaction client.
export async function saveKycFile(db, userId, slot, { mime, buffer }) {
  await db.query(
    `INSERT INTO kyc_files (user_id, slot, mime, data) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, slot) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, created_at = now()`,
    [userId, slot, mime, encryptBuffer(buffer)]
  )
}

export async function deleteKycFile(db, userId, slot) {
  await db.query('DELETE FROM kyc_files WHERE user_id = $1 AND slot = $2', [userId, slot])
}

// Returns a data URL, or null when there is no such image.
// Falls back to a legacy inline image (from before Batch 16) if one still exists.
export async function loadKycDataUrl(db, userRow, slot) {
  const { rows } = await db.query('SELECT mime, data FROM kyc_files WHERE user_id = $1 AND slot = $2', [userRow.id, slot])
  if (rows[0]) {
    return `data:${rows[0].mime};base64,${decryptBuffer(rows[0].data).toString('base64')}`
  }
  const legacy = slot === 'enhanced' ? userRow.kyc_enhanced?.frontImageDataUrl
    : slot === 'back' ? userRow.kyc?.backImageDataUrl
    : userRow.kyc?.frontImageDataUrl
  return legacy || null
}
