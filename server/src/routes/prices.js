import { Router } from 'express'
import { getCurrentPrices } from '../services/priceEngine.js'

const router = Router()

// Public, read-only — the current server-authoritative price
// snapshot. This is the ONLY place a price for session/position math
// comes from; no route anywhere accepts a price as request input.
router.get('/', (req, res) => {
  res.json({ prices: getCurrentPrices() })
})

export default router
