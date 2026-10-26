import { pool } from '../db.js'
import { sendMailSafe } from './mailer.js'
import { canIssue, issueCode } from './emailCodes.js'

async function brandName() {
  try {
    const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
    return rows[0]?.data?.brandName || process.env.APP_NAME || 'Pulse'
  } catch { return process.env.APP_NAME || 'Pulse' }
}

// Emails a verification code. Returns false if throttled (too many recently).
export async function sendVerificationCode(user) {
  if (!(await canIssue(user.id, 'verify_email'))) return false
  const code = await issueCode(user.id, 'verify_email')
  const brand = await brandName()
  await sendMailSafe({
    to: user.email,
    subject: `${brand}: your verification code is ${code}`,
    text: `Hi ${user.name},\n\nYour ${brand} email verification code is:\n\n    ${code}\n\nIt expires in 15 minutes. If you didn't create an account, ignore this email.\n`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Your ${escapeHtml(brand)} email verification code is:</p><p style="font-size:26px;letter-spacing:4px"><strong>${code}</strong></p><p>It expires in 15 minutes. If you didn't create an account, ignore this email.</p>`
  })
  return true
}

export async function sendPasswordResetCode(user) {
  if (!(await canIssue(user.id, 'password_reset'))) return false
  const code = await issueCode(user.id, 'password_reset')
  const brand = await brandName()
  await sendMailSafe({
    to: user.email,
    subject: `${brand}: your password reset code is ${code}`,
    text: `Hi ${user.name},\n\nUse this code to reset your ${brand} password:\n\n    ${code}\n\nIt expires in 15 minutes. If you didn't ask for this, ignore this email: your password has not been changed.\n`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Use this code to reset your ${escapeHtml(brand)} password:</p><p style="font-size:26px;letter-spacing:4px"><strong>${code}</strong></p><p>It expires in 15 minutes. If you didn't ask for this, ignore this email: your password has not been changed.</p>`
  })
  return true
}

export async function sendPasswordChangedNotice(user) {
  const brand = await brandName()
  await sendMailSafe({
    to: user.email,
    subject: `${brand}: your password was changed`,
    text: `Hi ${user.name},\n\nYour ${brand} password was just changed and all your other sessions were signed out. If this wasn't you, contact support immediately.\n`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Your ${escapeHtml(brand)} password was just changed and all your other sessions were signed out. If this wasn't you, contact support immediately.</p>`
  })
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
