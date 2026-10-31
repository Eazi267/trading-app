# Stage 5 – Dashboard performance chart

What's inside
- src/components/PortfolioPerformance.jsx  (new: the chart panel)
- src/styles/dashboard.css                 (new: panel styling)
- src/utils/analytics.js                   (REPLACES: fixes getBalanceHistory, which returned empty values)
- patch-stage5.mjs                         (adds the panel to Dashboard.jsx; safe to run twice)

Steps (PowerShell, in your project folder)
1. Unzip the zip into your project folder, choose "Replace" if asked.
2. Run:  node patch-stage5.mjs      -> should print "Dashboard.jsx patched"
3. Run:  npm run dev   and open the Dashboard.

Why: the chart is drawn only from approved transactions (deposits, withdrawals, session payouts, bonuses).
With fewer than 2 changes it shows "Not enough history yet" and a dashed flat line at your current balance.
Side effect: the Analytics page "Account growth" chart works again (same util bug).
