// Minimum bar for a password. Not about complexity rules (those mostly make
// people pick "Password1!") but about refusing the passwords attackers try
// first: too short, or one of the most common in the world.
const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123',
  'qwertyuiop', 'iloveyou', 'admin123', 'welcome1', 'welcome123', 'letmein123', 'abc12345',
  'abcd1234', '11111111', '00000000', 'passw0rd', 'changeme', 'trustno1', 'whatever1',
  'monkey123', 'dragon123', 'football1', 'baseball1', 'superman1', 'sunshine1', 'princess1'
])

// bcrypt only reads the first 72 bytes, so longer passwords would silently
// be cut off; cap it and say so.
export function checkPassword(password, { email = '', name = '' } = {}) {
  if (typeof password !== 'string') return 'Password is required.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be 72 characters or fewer.'
  const lower = password.toLowerCase()
  if (COMMON.has(lower)) return 'That password is too common. Choose something harder to guess.'
  if (/^(.)\1+$/.test(password)) return 'Password cannot be a single repeated character.'
  const local = String(email).split('@')[0].toLowerCase()
  if (local.length >= 4 && lower.includes(local)) return 'Password cannot contain your email name.'
  if (name && name.trim().length >= 4 && lower === name.trim().toLowerCase()) return 'Password cannot be your name.'
  return null
}
