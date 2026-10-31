import { otpRequiredFor } from '../utils/appControls.js'
import { checkCode } from '../utils/emailCodes.js'
import { sendOperationCode } from '../utils/accountEmails.js'

// Emailed one-time code for sensitive CLIENT actions, switched on per action by a super admin.
//   resolve: 'withdrawal' (fixed) or (req) => 'deposit' | null (decided per request)
// No code sent along -> one is emailed and the request is refused with otpRequired.
// The website then asks for the code and repeats the request with header X-Otp-Code.
export function requireOtp(resolve) {
  return async (req, res, next) => {
    try {
      const op = typeof resolve === 'function' ? resolve(req) : resolve
      if (!op || req.user?.role !== 'user' || !otpRequiredFor(op)) return next()
      if (!req.user.email_verified_at) {
        return res.status(403).json({ error: 'Verify your email address first (see the banner at the top), then try again. We email a confirmation code for this action.', verifyEmailRequired: true })
      }
      const typed = req.get('X-Otp-Code')
      if (!typed) {
        await sendOperationCode(req.user, op)
        return res.status(403).json({ otpRequired: true, operation: op, error: 'Enter the 6-digit code we emailed you.' })
      }
      if (!(await checkCode(req.user.id, 'op_' + op, typed))) {
        return res.status(403).json({ otpRequired: true, operation: op, wrongCode: true, error: 'That code is wrong or has expired.' })
      }
      next()
    } catch (err) { next(err) }
  }
}
