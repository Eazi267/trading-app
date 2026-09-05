// Real blockchain network names for each crypto method — used as a
// secondary "which chain" selector once a client picks a crypto
// method on deposit or withdrawal. Metadata only, same as the method
// itself: this never generates or displays a receiving address (see
// SettingsContext's depositMethods comment for why), it just records
// which network the client says they're using, for the admin's own
// reconciliation and for whichever real verification provider gets
// connected later (see src/services/blockchainVerification.js).
export const CRYPTO_CHAINS = {
  usdt: ['TRC20 (Tron)', 'ERC20 (Ethereum)', 'BEP20 (BSC)', 'Polygon', 'Solana', 'Arbitrum One', 'Avalanche C-Chain'],
  btc: ['Bitcoin Network', 'Lightning Network']
}

export const METHOD_LABELS = { usdt: 'USDT', btc: 'BTC', bank: 'Bank' }
