// Authenticator-app codes (TOTP, RFC 6238) using only Node's built-in crypto,
// so no new library is needed. Works with Google Authenticator, Authy,
// Microsoft Authenticator, 1Password, etc.
import crypto from 'crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30

export function base32Encode(buf) {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(str) {
  let bits = 0, value = 0
  const out = []
  for (const ch of str.replace(/=+$/, '').toUpperCase()) {
    const idx = B32.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

export function generateSecret() {
  return base32Encode(crypto.randomBytes(20)) // 160-bit, the standard size
}

function hotp(secretBase32, counter) {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', base32Decode(secretBase32)).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const num = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(num % 1_000_000).padStart(6, '0')
}

// Returns the matching 30-second step number, or null. Accepts one step either
// side to forgive small clock differences between phone and server.
export function verifyTotp(secretBase32, code, now = Date.now()) {
  const clean = String(code || '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return null
  const step = Math.floor(now / 1000 / STEP_SECONDS)
  for (const s of [step, step - 1, step + 1]) {
    const expected = Buffer.from(hotp(secretBase32, s))
    if (crypto.timingSafeEqual(expected, Buffer.from(clean))) return s
  }
  return null
}

export function otpauthUri(secret, accountEmail, issuer = 'Pulse') {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`
}

// ---- the secret is encrypted before it goes into the database, so a leaked
// database dump alone can't be used to generate codes. Key comes from
// TOTP_ENCRYPTION_KEY (preferred) or falls back to JWT_SECRET.
// NOTE: if that key changes, existing 2FA secrets can no longer be read
// (admins would need `node reset2fa.js email` and to set 2FA up again).
function key() {
  return crypto.createHash('sha256').update(process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET).digest()
}
export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}
export function decryptSecret(stored) {
  const [iv, tag, enc] = stored.split('.').map((s) => Buffer.from(s, 'base64'))
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}

// ---- one-time recovery codes (for a lost phone)
export function generateRecoveryCodes(n = 8) {
  return Array.from({ length: n }, () => {
    const h = crypto.randomBytes(5).toString('hex')
    return `${h.slice(0, 5)}-${h.slice(5)}`
  })
}
export function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(String(code).toLowerCase().replace(/[^a-f0-9]/g, '')).digest('hex')
}
