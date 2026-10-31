# Stage 10a — Admin Dashboard + Trading Console

Files changed:
- src/pages/AdminDashboardView.jsx  (new look: KPI strip, chart with range chips, "Needs attention", top clients, recent activity)
- src/pages/AdminTrading.jsx        (KPI strip, sort, ending-soon badge, "Select several" bulk open, risk summary, phone Trade sheet)
- src/styles/terminal.css, src/styles/dash.css (appended blocks)
- src/hooks/useMediaQuery.js        (new)

How to apply: unzip over your project (keep folder structure), then `npm run dev`.
Try it: Admin > Dashboard, then Admin > Trading Console > "Select several" > Select all, pick a symbol, set a % margin.
Bulk open places one position per selected session, sequentially, and every one is audit-logged separately. No real trades: simulated only.
