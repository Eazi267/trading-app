# Pulse — Demo Trading Dashboard (V1: no real money)

## What this is
A React-based trading dashboard with **simulated** prices (a random walk,
not connected to any real exchange). This is the foundation for your
forex/crypto site. Deposits/withdrawals and a real broker connection
(Deriv) come in later steps.

## First-time setup

1. Open this folder in VS Code (File → Open Folder → select `trading-app`)
2. Open a terminal in VS Code (Terminal → New Terminal)
3. Run:
   ```
   npm install
   ```
   This reads `package.json` and downloads every listed dependency into
   a `node_modules` folder. Takes a minute or two.
4. Run:
   ```
   npm run dev
   ```
   This starts Vite's dev server. It'll print a URL like
   `http://localhost:5173` — open that in your browser (or it may open
   automatically).
5. You should see the dashboard: a live-ish ticker row, stat cards, a
   price chart, and a portfolio table — all updating every 2 seconds
   with fake data.

## If something breaks
Copy the exact error message from the terminal and send it to me —
same debugging process we used for Ledger.

## File map (what to look at first)
- `src/App.jsx` — the whole dashboard lives here for now
- `src/index.css` — all styling, matches Ledger's black/red theme
- `package.json` — the dependency list