# Stage 10b — Clients list + client detail

Files: src/pages/AdminUsers.jsx, src/pages/AdminUserDetail.jsx, src/styles/dash.css

Apply: unzip over your project, `npm run dev`, open Admin > Clients.

What changed
- Clients list: totals strip, search, sort (balance / name / newest), filter (All / Flagged / Has pending), flagged rows get a red edge.
- Client detail: new header (avatar, flag, tier) and 5 tabs: Overview, Trading, Money & fees, Account & KYC, Contact.
  All existing panels and logic are untouched, only regrouped. Hidden tabs stay mounted, so half-typed forms are not lost when you switch tabs.
  Permission rules (finance / support / trade) still decide which panels appear.
