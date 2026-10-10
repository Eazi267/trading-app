import 'dotenv/config'
import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
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
import { startPriceEngine } from './services/priceEngine.js'
import { startAutoExpirySweep } from './jobs/autoExpiry.js'

if (!process.env.JWT_SECRET) {
  // Fail loudly at boot, not silently at the first login — a missing
  // secret here would otherwise mean either a crash deep inside jwt
  // .sign() on the first request, or worse, running with a `undefined`
  // secret that's the same "undefined" on every deploy.
  console.error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

const app = express()

app.use(cors({ origin: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean) }))
// 5mb (not the 100kb default): settings carry the logo/favicon as data URLs and user profiles carry avatars/KYC images.
app.use(express.json({ limit: '5mb' }))

app.get('/health', (req, res) => res.json({ ok: true }))

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

// Kept deliberately plain and un-fancy — a real error-shape
// convention (error codes, field-level validation errors) is worth
// designing once there's more than one route file to see the
// pattern across, not invented speculatively here.
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`Pulse API listening on :${port}`)
  startPriceEngine()
  startAutoExpirySweep()
})
