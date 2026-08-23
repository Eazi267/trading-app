// The single chokepoint for "did this crypto deposit actually
// arrive on-chain?" — every deposit that requests automatic
// verification calls this one function, never a provider SDK
// directly. Today it always returns 'unavailable', because real
// verification needs THREE things this project doesn't have yet:
//
//   1. A backend to hold a provider's API key (same constraint as
//      email sending — a key can't live safely in browser JS).
//   2. A real, uniquely-generated receiving address per deposit —
//      typically from a custodial crypto payment processor (Coinbase
//      Commerce, NOWPayments, BitPay) that generates the address and
//      calls your backend back once payment confirms. This app
//      deliberately never generates or displays a receiving address
//      (see SettingsContext's depositMethods comment) — showing one
//      without a real processor behind it would BE the fake-crediting
//      pattern this project has avoided from day one.
//   3. A webhook endpoint the processor can call to report
//      confirmations, which only a real backend can expose.
//
// When all three exist, only the inside of this function changes to
// call the real provider — every call site elsewhere in the app
// (right now, just AppContext's addTransaction) stays exactly as is.
export function requestDepositVerification({ method, chain, amount }) {
  return {
    status: 'unavailable',
    reason: 'No blockchain verification provider is connected. This deposit will be reviewed manually.'
  }
}
