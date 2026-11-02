# Stage 13: Awaiting-certification funds count in the total, but locked

## What changed
- Total balance now = Available + Pending in sessions + Awaiting certification.
- A new striped "Awaiting certification" segment and legend item on the Balance page, with a short note that these funds are locked.
- The client Dashboard total and "In sessions" tile, and the admin client-detail "Total balance", use the same rule.
- Locked means: it is never counted as Available, so it cannot be withdrawn or committed to a new session. The server's withdrawal and session checks were not touched and still only use certified money.

## Files (same paths)
src/context/AppContext.jsx, src/pages/Balance.jsx, src/pages/ClientDashboard.jsx, src/pages/AdminUserDetail.jsx, src/styles/dash.css

## Check
Open Balance for a client with a closed session awaiting certification: the total includes it, Available does not.
