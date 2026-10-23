import { pool } from '../db.js'
import { outstandingFees } from './fees.js'
import { getAvailableBalance } from './balance.js'

// Server-side copy of the rules the Deposit/Withdraw page enforces in the
// browser (AppContext.addTransaction + Transactions.jsx). The browser
// checks are only convenience: anyone can call the API directly, so these
// are the ones that actually protect money.
//
// Defaults mirror SettingsContext's DEFAULT_SETTINGS, so a database whose
// settings were never saved behaves exactly like the app does.
const DEFAULTS = {
  depositMin: 10,
  depositMax: 100000,
  withdrawalMin: 10,
  withdrawalMax: 100000,
  depositMethods: { usdt: true, btc: true, bank: true },
  withdrawalMethods: { usdt: true, btc: true, bank: false },
  kycEnabled: false
}

export async function loadRuleSettings() {
  const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
  const data = rows[0]?.data || {}
  return { ...DEFAULTS, ...data }
}

// Returns { error } or { method, chain } (the values to STORE — for a crypto
// withdrawal the chain always comes from the client's bound wallet, never
// from the request, so a request can't redirect it).
//
// `pendingWithdrawals` = money already requested but not yet reviewed, so
// two quick requests can't each pass the balance check on their own.
export async function checkTransactionRequest(user, { type, amount, method, chain }, settings, pendingWithdrawals = 0) {
  const min = Number(type === 'deposit' ? settings.depositMin : settings.withdrawalMin)
  const max = Number(type === 'deposit' ? settings.depositMax : settings.withdrawalMax)
  const fmt = (n) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (min > 0 && amount < min) return { error: `Minimum ${type} is ${fmt(min)}.` }
  if (max > 0 && amount > max) return { error: `Maximum ${type} is ${fmt(max)}.` }

  if (type === 'deposit') {
    if (!method || settings.depositMethods?.[method] !== true) return { error: 'Choose a deposit method.' }
    return { method, chain: chain || null }
  }

  // ---- withdrawal ----
  if ((settings.kycEnabled || user.kyc_required) && user.kyc?.status !== 'verified') {
    return { error: 'Identity verification is required before you can withdraw. Submit your document on the Verification page.' }
  }
  if ((await outstandingFees(user.id)).length > 0) {
    return { error: 'You have an outstanding fee. Clear it from your Fee Balance before withdrawing.' }
  }
  if (!method || settings.withdrawalMethods?.[method] !== true) return { error: 'Choose a withdrawal method.' }

  let storedChain = null
  if (method === 'bank') {
    if (user.kyc_enhanced?.status !== 'verified') {
      return { error: 'Bank withdrawal requires enhanced verification. Submit it on the Verification page.' }
    }
  } else if (method === 'usdt' || method === 'btc') {
    const wallet = user.bound_wallet
    if (!wallet) return { error: 'Bind a withdrawal wallet in Settings before your first crypto withdrawal.' }
    if (wallet.method !== method) return { error: `Your bound wallet is for ${wallet.method.toUpperCase()}. Withdraw with that method, or use bank.` }
    storedChain = wallet.chain || null
  } else {
    return { error: 'Choose a withdrawal method.' }
  }

  const { available } = await getAvailableBalance(user.id)
  const free = available - pendingWithdrawals
  if (amount > free + 1e-9) {
    return { error: `You can withdraw up to $${Math.max(0, free).toFixed(2)} right now (money in running sessions and pending withdrawals is excluded).` }
  }
  return { method, chain: storedChain }
}
