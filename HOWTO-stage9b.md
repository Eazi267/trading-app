# Stage 9b – Bottom bar, quick actions, favourites, skeletons, pull to refresh

Needs Stage 9 (and earlier) applied first. Phones and tablets (900px and narrower) only; desktop is unchanged.

Files (all REPLACE your copies; NEW means the file is new)
- src/components/MobileDock.jsx   (rewritten: the bottom bar + two sheets)
- src/components/BottomSheet.jsx  (NEW)
- src/components/PageSkeleton.jsx (NEW)
- src/components/PullToRefresh.jsx (NEW)
- src/components/Layout.jsx
- src/hooks/useFavorites.js       (NEW)
- src/context/AppContext.jsx      (adds dataReady + refreshAll)
- src/pages/Markets.jsx, Balance.jsx, Sessions.jsx, TransactionHistory.jsx, Transactions.jsx, ClientDashboard.jsx, Analytics.jsx
- src/styles/nav.css, src/styles/mobile.css

Steps (PowerShell, in your project folder)
1. Unzip into your project folder, choose Replace.
2. npm run dev and open it on your phone (or Chrome F12 > phone icon).

What you get
- Full-width bottom bar with your 4 favourite pages and a raised gold + button in the middle.
- Tap +: Deposit, Withdraw and Invest from any page. Deposit and Withdraw open the Deposit/Withdraw page on the right tab.
- Tap + then "Customize bottom tabs": choose 2 to 4 favourite pages. They appear in the order you tap them.
  Default: Home, Markets, Invest, Balance. Your choice is remembered on that phone/browser.
- Markets: tap a star to favourite a market. Starred markets move to the top, and the Favourites tab shows only them.
- Loading skeletons: grey shimmer shapes while your balance, sessions and history load (real loading, not a timer).
- Pull to refresh: at the top of a page, pull down and release to refetch balances, sessions and trades.
  It ignores charts, carousels and the chat box so it never fights with them.
- The bar hides while the keyboard is open.
- Admin accounts keep a simple 5-tab bar for now (admin phone work comes later).

How it works (for learning)
- Favourite tabs and starred markets are saved in localStorage (small data stored inside the browser).
- BottomSheet is one reusable component, so any future "pick something" screen can slide up the same way.
- AppContext now says when the first data load finished (dataReady); pages show PageSkeleton until it is true.
