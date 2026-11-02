# Stage 14: phone polish + new ID system + fixes

## 1. Phone layout (Bybit-style)
- The header and its dropdowns (notifications, profile menu) are now solid and always on top. They used to hide under the verify notice and page content, which is also why "Log out" could not be tapped.
- The floating settings button is gone on phones (it covered buttons). Open it from your avatar menu > Appearance.
- Every section is a white card with a border and soft shadow on a tinted page (light theme especially), instead of flat text on cream.
- Investment tiers are compact tiles you swipe; details of the selected tier appear underneath.
- Landing page: brand never wraps, Log in / Sign up are compact.

## 2. New IDs
Account:      PM-C-2611-0042   PM = your company letters (Business Settings > Site logo and icon > ID letters)
                               C = client, A = admin/staff
                               2611 = joined Nov 2026 (YYMM)
                               0042 = the 42nd account of that kind (never reused; clients and admins count separately)
Transaction:  PM-D-261101-00040  D deposit, W withdrawal, F fee, P fee payment, S session result,
                               R held-profit release, B referral bonus, G signup bonus, V reversal
                               261101 = 1 Nov 2026, 00040 = running number
- On first start the server gives every existing account and transaction the new ID (oldest first). Letters come from your business name until you set them.
- Changing the letters later only affects NEW accounts and transactions.

## 3. Fixes
- Generate Demo Clients: shows "Generating..." at once, reports any error on screen, and is much faster (one shared password hash instead of one per client, which was slow on a slower computer).
- Server no longer stops if the database restarts or the connection blips (it logs it and carries on).
- Dev proxy: while the API restarts (node --watch restarts it when you copy files), the site shows "The server is restarting... try again" instead of a bare 500.

## How to apply
1. Unzip over your project (same paths).
2. In `server`: `npm run migrate`  (adds migration 026; widens the ID column).
3. Restart the server (it fills in the new IDs and logs "IDs: gave N account(s)...") and restart the site (npm run dev).
