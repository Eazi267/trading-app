# Stage 9 – Mobile revamp, part 1 (phones only)

Needs Stages 7 to 8e applied first. Desktop looks exactly the same as before.

Files (all REPLACE your copies)
- src/styles/mobile.css     (NEW – the whole mobile design kit, phones <= 600px wide)
- src/styles/redesign.css   (now also imports mobile.css)
- src/components/Topbar.jsx (short "Live / Simulated" badge on phones)
- src/components/EmailVerifyBanner.jsx (compact banner on phones)
- src/pages/Markets.jsx     (says so when a price hasn't moved, instead of an empty chart)

Steps (PowerShell, in your project folder)
1. Unzip into your project folder, choose Replace.
2. npm run dev, open it on your phone (same Wi-Fi, use the "Network" address Vite prints) or
   press F12 in Chrome, then the phone icon, and pick an iPhone size.

What changed on phones
- Slim one-row header, no breadcrumb, one-line email reminder.
- Boxed tiles became flat sections with small uppercase headings and hairline dividers.
- One hero per screen, edge to edge (portfolio value, balance, profit, market price).
- Dashboard: balances side by side and round Deposit / Withdraw / Invest buttons.
- Investments: tiers are a swipe carousel; the Start session button stays above the menu dock.
- Lists (history, notifications, markets, investments) are plain rows instead of boxes.
- Pages fade and rise in; buttons press in when tapped; all of it turns off if the phone has "reduce motion".

How the kit works (for learning)
Everything sits inside @media (max-width: 600px), so it can never touch the desktop.
Rules start with .app-shell so they win over older styles without !important.
To adjust spacing, change --m-gutter (side margin) and --m-gap (space between sections) at the top.

Not done yet (next phase): bottom sheets for deposit/withdraw, pull to refresh, loading skeletons,
chart touch-crosshair, favourite markets, and the admin pages on phones.
