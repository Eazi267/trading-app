// ---------------------------------------------------------
// Single switch for the whole app. Change this one line to
// flip between the cosmetic demo and (later) the real Deriv
// broker connection. Nothing else in the app should hardcode
// 'demo' or 'live' — always import and check this constant.
// ---------------------------------------------------------

export const TRADING_MODE = 'demo' // 'demo' | 'live'

export const isDemoMode = TRADING_MODE === 'demo'
export const isLiveMode = TRADING_MODE === 'live'