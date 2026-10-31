# Stage 10g — Deposits & Withdrawals (admin), Analytics, Balance, Generate Clients (+ 1 bug fix)

Files:
- src/pages/Transactions.jsx  (only the ADMIN view inside it was changed; the client deposit/withdraw page is untouched)
- src/pages/AdminAnalyticsView.jsx, src/pages/AdminBalanceView.jsx, src/pages/AdminGenerateClients.jsx
- src/styles/dash.css

Apply: unzip over your project, `npm run dev`. No server change this time.

What changed
- Deposits & Withdrawals (admin): totals strip, pending list with approve / reject / "Correct amount", recently resolved list (click a row for details), chart in the side column.
  Everything the old view did is kept: "Awaiting review" badge, client proof thumbnails, fee spill-over text, correction errors, locked-excess "Add fee".
- Admin Analytics + Balance: wide tables became rows that fit a phone; charts restyled.
- Generate Demo Clients: new layout and a clear "Demo data only" notice.

Bugs fixed on the way (both in AdminGenerateClients.jsx)
1. Clicking Generate crashed the whole page (blank screen). The accounts WERE created, but the demo-activity step now refuses (activity comes from the real backend)
   and the page then tried to print totals that don't exist. It now says plainly that the demo clients were created empty.
2. "Remove all generated clients" never appeared, so demo accounts could not be removed from this page: the shared client list hides demo accounts on purpose.
   The page now asks the server for its own demo count.

Note: src/pages/AdminRequests.jsx is not used anywhere in the app (the live queue is the admin view inside Transactions.jsx). It is safe to delete.
