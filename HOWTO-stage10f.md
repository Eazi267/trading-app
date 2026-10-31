# Stage 10f — Audit Log, Email Outbox, Admin Accounts (+ 2 bug fixes)

Files:
- src/pages/AdminAuditLog.jsx, src/pages/AdminEmailOutbox.jsx, src/pages/AdminAccounts.jsx, src/styles/dash.css
- server/src/routes/admin.js   <-- SERVER change, restart the server after applying

Apply: unzip over your project, restart the server (in /server), then `npm run dev` for the frontend.

What changed
- Audit Log: totals strip (entries loaded, last 24h, people who acted), search + action / client / sort filters, refresh, CSV export, detail chips. Same 7-day "older history" fold.
- Email Outbox: clear "Simulated, nothing was delivered" notice with counts, search, cleaner rows.
- Admin Accounts: account list on the left, new-admin form + "what each tier can do" on the right. Security switches unchanged.

Bugs fixed on the way
1. The "All admin accounts" list was always EMPTY. The server's user list only ever returns clients, and this page filtered it for admins.
   Added GET /api/admin/admins (needs the manageAdmins permission, like the rest of this page); the page now uses it and reloads after every change.
2. A deactivated admin could never show as "Deactivated" (the page looked for a field the API doesn't send). It now reads deactivatedAt.
