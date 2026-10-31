# Stage 10d — Referral Campaigns + Scenario Control (+1 server bug fix)

Files:
- src/pages/AdminReferralCampaigns.jsx, src/pages/AdminScenario.jsx, src/styles/dash.css
- server/src/routes/referrals.js   <-- SERVER change, restart/redeploy the server after applying

Apply: unzip over your project, restart the server (stop it, `npm run dev` / `node src/index.js` in /server), then `npm run dev` for the frontend.

What changed
- Referral Campaigns: "Live now" banner, campaign list with status + stats + Pause/Reactivate, new-campaign form in the side column.
- Scenario Control: live-scenarios list, session picker, symbol tabs, three status tiles, segmented controls for direction/strength/volatility/speed,
  presets + reset in the side column, all-sessions list with per-row fast-forward. Behaviour is unchanged.

Bug fixed on the way (server/src/routes/referrals.js)
The API sent campaign start/end dates as full timestamps ("2026-11-29T00:00:00.000Z"). The client adds "T23:59:59" to the end date,
which made an invalid date, so a running campaign could show "No campaign is live" (also on the client Referral page banner).
The API now returns plain "YYYY-MM-DD". Bonus payouts were never affected: they are decided in SQL on the server.
