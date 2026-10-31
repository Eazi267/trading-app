# Stage 8b – Deposit / Withdraw + Transaction History

Needs Stage 7 and 8a applied first.

Files (all REPLACE your copies):
- src/pages/Transactions.jsx        (client form redesigned; the admin approvals view is unchanged)
- src/pages/TransactionHistory.jsx
- src/styles/dash.css               (cumulative: Stage 7 + 8a + 8b styles)

Steps (PowerShell, in your project folder)
1. Unzip into your project folder, choose Replace.
2. npm run dev, open Deposit / Withdraw and Transaction History.

What changed
Deposit / Withdraw: pill Deposit | Withdraw switch, a large amount field, bigger method tiles, a balance + pending card
and a 4-step "How it works" panel; recent requests sit in a card below. All rules are unchanged (limits, KYC gates,
bound wallet, fee-payment mode, admin review).
Transaction History: totals for deposited / withdrawn / session results (approved records only) and filter chips
(All, Deposits, Withdrawals, Session results, Fees, Bonuses & other).
