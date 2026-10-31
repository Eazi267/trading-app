# Stage 7 – New navigation + client Dashboard

Needs the earlier packages already applied: Stage 5 (PortfolioPerformance.jsx) and live-prices (AppContext priceSources).

What's inside
- src/components/navModel.jsx      (new: one place that decides who sees which menu items)
- src/components/Sidebar.jsx       (REPLACES: now the slim icon rail, widens on hover)
- src/components/Topbar.jsx        (REPLACES: sticky bar with the pill menu in the middle)
- src/components/MobileDock.jsx    (new: floating bottom dock on phones)
- src/components/Layout.jsx        (REPLACES: adds the dock)
- src/components/PerformanceHero.jsx (new: big chart with 1W / 1M / ALL)
- src/pages/ClientDashboard.jsx    (new: the redesigned client page)
- src/pages/Dashboard.jsx          (REPLACES: admins -> admin dashboard, clients -> new page)
- src/styles/nav.css, src/styles/dash.css (new)
- patch-stage7.mjs                 (registers the two stylesheets in redesign.css; safe to run twice)

Steps (PowerShell, in your project folder)
1. Unzip the zip into your project folder, choose "Replace" if asked.
2. Run:  node patch-stage7.mjs      -> "redesign.css patched"
3. Run:  npm run dev   (and your server as usual) and open the Dashboard.

What you get
- Desktop: slim icon rail that stays put and widens on hover, plus a floating pill menu at the top. The top bar is sticky.
- Phone: floating dock (Home, Invest, Balance, Analytics, More). It hides when you scroll down and returns when you scroll up. "More" opens the full menu.
- Admins get the same shell: pill = Dashboard, Clients, Trading Console (if allowed), Markets, Analytics.
- Client Dashboard: greeting, portfolio value with chart, balances, Deposit/Withdraw/Invest, stats, positions, activity, price strip.

Notes
- The old full-width live BTC chart is no longer on the Dashboard (it lives on Markets).
- Activity shows a losing session payout as a red minus amount.
- If you edited Sidebar/Topbar/Layout/Dashboard yourself, send me those files first.
