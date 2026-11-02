# Testing on your phone (LAN address or VS Code port forwarding)

## Why login said "Can't reach the server"
The site was told to call the API at `localhost:4000`. On a phone, "localhost" is the phone, not your PC.

## The fix (2 files)
- `src/api/client.js`: when the page is opened from any address other than localhost, API calls go to the page's own address (`/api/...`).
- `vite.config.js`: the dev server passes `/api` on to your API on this computer (default http://localhost:4000).
Result: you only need to expose ONE port (5173). No CORS or cookie problems, because the browser only talks to one address.

## How to use
1. Copy the 2 files over your project (same paths).
2. Terminal 1: `cd server` then `npm run dev` (API on port 4000).
3. Terminal 2: STOP the site (Ctrl+C) and start it again with `npm run dev` (Vite only reads its config on start).
4. On the phone open either:
   - the Network address Vite prints, e.g. `http://192.168.0.151:5173` (phone on the same WiFi), or
   - your forwarded address (VS Code > Ports > port 5173; set Visibility to Public if the phone isn't signed in to your account).
5. You don't need to forward port 4000 any more.

## If it still fails
- Windows firewall may block port 5173 for LAN: allow Node.js when Windows asks.
- Check the API: open `http://<same address>/health` on the phone. You should see {"ok":true}.
- Your API on another port? Start the site with `$env:VITE_PROXY_TARGET="http://localhost:4010"; npm run dev` (PowerShell).
