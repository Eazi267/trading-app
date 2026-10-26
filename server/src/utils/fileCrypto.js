import crypto from 'crypto'

// AES-256-GCM encryption for uploaded documents (KYC images). The database
// only ever holds the scrambled bytes: iv(12) + authTag(16) + ciphertext.
// Key comes from KYC_ENCRYPTION_KEY (preferred) or falls back to JWT_SECRET.
// If that key is ever changed, existing images can no longer be opened.
function key() {
  const secret = process.env.KYC_ENCRYPTION_KEY || process.env.JWT_SECRET
  return crypto.createHash('sha256').update('kyc-files-v1:' + secret).digest()
}

export function encryptBuffer(plain) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), enc])
}

export function decryptBuffer(blob) {
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(blob.subarray(28)), d.final()])
}
