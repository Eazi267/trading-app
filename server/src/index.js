import 'dotenv/config'
import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import authRouter from './routes/auth.js'
import twoFactorRouter from './routes/twoFactor.js'
import transactionsRouter from './routes/transactions.js'
import usersRouter from './routes/users.js'
import settingsRouter from './routes/settings.js'
import adminRouter from './routes/admin.js'
import supportRouter from './routes/support.js'
import feesRouter from './routes/fees.js'
import sessionsRouter from './routes/sessions.js'
import pricesRouter from './routes/prices.js'
import notificationsRouter from './routes/notifications.js'
import referralsRouter from './routes/referrals.js'
import kycRouter from './routes/kyc.js'
import auditRouter from './routes/audit.js'
import tradesRouter from './routes/trades.js'
import statementsRouter from './routes/statements.js'
import { startPriceEngine } from './services/priceEngine.js'
import { startAutoExpirySweep } from './jobs/autoExpiry.js'
import { refreshTierConfig, startTierSync } from './services/tierSync.js'

if (!process.env.JWT_SECRET) {
  // Fail loudly at boot, not silently at the first login — a missing
  // secret here would otherwise mean either a crash deep inside jwt
  // .sign() on the first request, or worse, running with a `undefined`
  // secret that's the same "undefined" on every deploy.
  console.error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}
const isProduction = process.env.NODE_ENV === 'production'
if (isProduction && process.env.JWT_SECRET.length < 32) {
  // A short secret can be guessed offline from any one token. Refuse to run live with one.
  console.error('JWT_SECRET is too short for production. Use at least 32 random characters (see README).')
  process.exit(1)
}
if (isProduction && !process.env.CORS_ORIGIN) {
  console.error('CORS_ORIGIN is not set. In production set it to your website address, e.g. https://yourdomain.com')
  process.exit(1)
}

const app = express()

// Behind a host's proxy (Railway etc.) the real visitor address arrives in a
// header; without this every visitor would look like the proxy and share ONE
// rate-limit bucket. Number of proxies in front of us: TRUST_PROXY, or 1 in
// production and 0 on your own computer.
app.set('trust proxy', process.env.TRUST_PROXY !== undefined ? Number(process.env.TRUST_PROXY) : (isProduction ? 1 : 0))
app.disable('x-powered-by')
// Standard security headers (no sniffing, no framing, HSTS, ...).
app.use(helmet())

app.use(cors({ origin: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean) }))
// 5mb (not the 100kb default): settings carry the logo/favicon as data URLs and user profiles carry avatars/KYC images.
app.use(express.json({ limit: '5mb' }))

app.get('/health', (req, res) => res.json({ ok: true }))

// Overall ceiling per visitor address — slows scraping and brute-force of any
// endpoint. Generous for a real person; /health and prices are exempt.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT) || 3000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/prices',
  message: { error: 'Too many requests. Please slow down and try again shortly.' }
}))

app.use('/api/auth/2fa', twoFactorRouter)
app.use('/api/auth', authRouter)
app.use('/api/transactions', transactionsRouter)
app.use('/api/users', usersRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/support', supportRouter)
app.use('/api/fees', feesRouter)
app.use('/api/sessions', sessionsRouter)
app.use('/api/prices', pricesRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/referrals', referralsRouter)
app.use('/api/kyc', kycRouter)
app.use('/api/audit', auditRouter)
app.use('/api/trades', tradesRouter)
app.use('/api/statements', statementsRouter)

// Kept deliberately plain and un-fancy — a real error-shape
// convention (error codes, field-level validation errors) is worth
// designing once there's more than one route file to see the
// pattern across, not invented speculatively here.
app.use((err, req, res, next) => {
  // Problems with the request itself (file too large, broken JSON) are the
  // sender's fault: tell them clearly instead of a vague 500.
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That upload is too large. Use a smaller file.' })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request was not valid JSON.' })
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

const port = process.env.PORT || 4000
app.listen(port, async () => {
  console.log(`Pulse API listening on :${port}`)
  // Load the admin-saved tiers BEFORE the auto-expiry sweep can settle
  // anything, so settlement always uses the real payout caps.
  await refreshTierConfig()
  startTierSync()
  startPriceEngine()
  startAutoExpirySweep()
})
