# Stage 11: Admin phone experience

## What changed
- Admin phone bottom bar: Home, Clients, Trade, Funds (editable favourites).
- The "+" button now opens admin quick actions: Review requests, Support inbox, Trading console, Broadcast, Clients. Each shows only if your admin tier allows it.
- A live count badge on "+" (pending requests + unread support). Client bar is unchanged.

## Files (copy over your project, same paths)
- src/components/MobileDock.jsx
- src/hooks/useFavorites.js
- src/styles/nav.css

## How to apply
1. Unzip into your project root, letting it overwrite the 3 files.
2. In PowerShell: `npm run dev`
3. Open the site, resize the browser under 900px wide (or use the phone view in DevTools), and sign in as an admin.

## How to check
- Bottom bar shows Home / Clients / Trade / Funds with a gold "+" in the middle.
- Tap "+": the quick actions list opens; tap one to jump to that page.
- Tap "Customize bottom tabs": pick 2-4 pages. They are remembered per browser.

## Why
Admins on a phone need one-tap access to the things that wait on them (requests, support) without opening the menu.
