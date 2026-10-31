# Stage 8a – Investments + Balance pages

Needs Stage 7 applied first (it provides the shared dashboard styles).

Files (all REPLACE your copies):
- src/pages/Sessions.jsx   (Investments page)
- src/pages/Balance.jsx    (client Balance page; admin view unchanged)
- src/styles/dash.css      (the Stage 7 stylesheet plus the new page styles)

Steps (PowerShell, in your project folder)
1. Unzip into your project folder, choose Replace.
2. npm run dev, open Investments and Balance.

What changed
Investments: tier cards are selectable tiles; quick 25% / 50% / Max buttons; a live "Your commitment" summary
(tier, amount, length, gain ceiling) with warnings if the amount is outside the tier range or above your balance;
active and past investments sit in matching cards.
Balance: big total with a bar showing available vs committed to sessions; Deposit / Withdraw / Invest buttons;
awaiting-certification and fee cards appear only when they apply.
No logic changed: starting, cancelling and ending sessions, managed mode, VIP tiers, fee payment all work as before.
