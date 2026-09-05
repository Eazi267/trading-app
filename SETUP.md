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

## Demo logins
No longer shown on the login screen (removed for a cleaner, more genuine-looking
UI when presenting to prospective clients). Keep these handy for your own testing:
- Client: `trader@pulse.app` / `trader123`
- Admin: `admin@pulse.app` / `admin123`

## Testing on your actual phone

`npm run dev` now binds to your whole network (not just this computer),
so your phone can reach it directly, live, with hot-reload — you edit
code, save, and the phone screen updates in under a second, same as
the browser on your laptop.

1. Make sure your phone and computer are on the **same WiFi network**
   (this won't work over mobile data, or if your computer's on a
   different network like a work VPN)
2. Run `npm run dev` as usual. Look at the terminal output — alongside
   `Local: http://localhost:5173/` there's now also a line like:
   ```
   Network: http://192.168.1.42:5173/
   ```
3. Type that `Network` address into your phone's browser (Safari on
   iPhone, Chrome on Android). That's it — you're looking at the live
   site running on your computer.
4. Leave both windows open side by side. Edit a file, save it, and
   watch the phone update automatically.

**If the phone can't connect:** it's almost always a firewall
blocking the connection, not a code problem. On Windows, the first
time you run `npm run dev` you may get a popup asking to allow Node.js
through the firewall on private networks — click Allow. On Mac,
System Settings → Network → Firewall may need a similar exception for
node. If it still doesn't work, temporarily disable the firewall to
confirm that's the cause, then re-enable it and add a proper
exception rather than leaving it off.

**Quick alternative with no phone required:** in Chrome or Firefox on
your computer, open DevTools (F12), click the device toolbar icon (or
Ctrl/Cmd+Shift+M), and pick a phone preset from the dropdown at the
top. This is faster for quick iteration since there's no network step,
but it's a simulation — always do a final check on a real phone before
considering something done, since real mobile browsers have quirks
(safe-area insets, actual touch behavior, real keyboard overlays) that
DevTools can't fully replicate.

Copy the exact error message from the terminal and send it to me —
same debugging process we used for Ledger.

## File map (what to look at first)
- `src/App.jsx` — the whole dashboard lives here for now
- `src/index.css` — all styling, matches Ledger's black/red theme
- `package.json` — the dependency list