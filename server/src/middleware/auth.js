import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { hasPermission } from '../config/adminTiers.js'
import { requireAdmin2faOn } from '../utils/appControls.js'
import { readAuthCookie, CSRF_HEADER, CSRF_VALUE } from '../utils/authCookie.js'

// True when the house rule applies to this user and they haven't met it yet.
// Also used by publicUser() so the website knows to send them to Settings.
export function adminNeedsTwoFactor(user) {
  return requireAdmin2faOn() && user.role === 'admin' && !user.totp_enabled
}

// Verifies the Bearer token, loads the current user fresh from the DB
// (not just trusting the token payload) and attaches it as req.user.
// Loading fresh matters: a deactivated account's token would
// otherwise stay valid until it expires — this makes deactivation
// take effect immediately on the next request, not just at next login.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null
  const token = bearer || readAuthCookie(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated.' })

  // Cookie sessions are sent automatically by the browser, so state-changing
  // requests must also carry our custom header (CSRF protection). A Bearer
  // token is never sent automatically, so it needs no such check.
  if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get(CSRF_HEADER) !== CSRF_VALUE) {
    return res.status(403).json({ error: 'Blocked: missing security header.' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.sub])
    const user = rows[0]
    if (!user || user.deactivated_at) {
      return res.status(401).json({ error: 'Account not found or deactivated.' })
    }
    // Tokens issued before the last password change are no longer valid.
    if ((payload.v ?? 0) !== user.token_version) {
      return res.status(401).json({ error: 'Invalid or expired session.' })
    }
    // Optional house rule (REQUIRE_ADMIN_2FA=1): an admin without two-factor can
    // only reach the login/account routes needed to SET IT UP, nothing else.
    if (adminNeedsTwoFactor(user) && !String(req.baseUrl).startsWith('/api/auth')) {
      return res.status(403).json({ error: 'Two-factor login is required for admin accounts. Set it up in Settings first.', code: 'two_factor_setup_required' })
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
