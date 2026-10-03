import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { hasPermission } from '../config/adminTiers.js'

// Verifies the Bearer token, loads the current user fresh from the DB
// (not just trusting the token payload) and attaches it as req.user.
// Loading fresh matters: a deactivated account's token would
// otherwise stay valid until it expires — this makes deactivation
// take effect immediately on the next request, not just at next login.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated.' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.sub])
    const user = rows[0]
    if (!user || user.deactivated_at) {
      return res.status(401).json({ error: 'Account not found or deactivated.' })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' })
  }
}

// Mirrors ProtectedRoute.jsx's requireRole prop — same permission
// model, enforced server-side this time. This is the actual fix for
// the client-side-only bypass flagged earlier: a client can still
// edit their own JS, but they can no longer edit this.
export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ error: 'Not authorized.' })
    next()
  }
}

// Mirrors ProtectedRoute.jsx's requirePermission prop, checked
// against the same adminTiers.js permission table (see that file's
// header comment on why it's duplicated rather than shared). Note
// req.user here is the raw DB row (snake_case, e.g. admin_tier), so
// hasPermission's `user.adminTier` lookup needs the same field —
// handled by camelCase-mapping in publicUser()/here consistently,
// see routes/auth.js.
export function requirePermission(permission) {
  return (req, res, next) => {
    const camelUser = { ...req.user, adminTier: req.user.admin_tier }
    if (!hasPermission(camelUser, permission)) return res.status(403).json({ error: 'Not authorized.' })
    next()
  }
}
