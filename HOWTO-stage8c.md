# Stage 8c – Markets + Analytics

Needs Stages 7, 8a and 8b applied first.

Files (all REPLACE your copies):
- src/pages/Markets.jsx
- src/pages/Analytics.jsx   (client view redesigned; admin analytics unchanged)
- src/styles/dash.css       (cumulative stylesheet: Stages 7 + 8a + 8b + 8c)

Steps (PowerShell, in your project folder)
1. Unzip into your project folder, choose Replace.
2. npm run dev, open Markets and Analytics.

What changed
Markets: one big price with its Live / Delayed / Simulated tag, session change, recent range, Line | Candles switch,
and an "All markets" list (price + change for every pair) that replaces the row of buttons.
Analytics: total profit as the headline with ROI, Today / Week / Month, an honest account-growth chart (flat line and a
"not enough history" note when there is little data), a win-rate ring with trade stats, donut charts and the activity chart.
All numbers still come from the same calculation functions as before.
