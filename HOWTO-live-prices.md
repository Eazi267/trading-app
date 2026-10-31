# Live forex + metals prices

Why: EUR/USD, GBP/USD, gold and silver were a random walk, and those prices feed real session P&L.
Calling them "derived" would be misleading, so they now come from a real feed (Twelve Data).
Labels follow the data: Live feed / Feed delayed / Simulated. Without a key everything still works and says "Simulated".

Steps
1. Make a free account at https://twelvedata.com and copy your API key (Dashboard > API keys).
2. Unzip pulse-live-prices.zip into your project folder, choose Replace.
3. Open server/.env and add two lines:
     TWELVEDATA_API_KEY=your_key_here
     FX_POLL_SECONDS=600
   (Free plan: 800 credits/day, 4 pairs per refresh, so 600 = every 10 minutes. A paid plan can use 15.)
4. Restart the server (Ctrl+C, then npm start in /server). Reload the site.
5. Check: open http://localhost:4000/api/prices - "sources" should show "live" for EUR/GBP/XAU/XAG.

Behaviour
- Between refreshes the last real price is HELD, not jiggled. If the feed goes quiet for 3 refreshes the label becomes "Feed delayed".
- A bad value from the provider is ignored; that pair keeps its previous label and price.
- Topbar says "Some prices simulated" whenever any pair is not live.
- Crypto (BTC/ETH) still uses CoinGecko.
