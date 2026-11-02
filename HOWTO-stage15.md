# Stage 15 – Bybit-style phone home + leftovers

## What changed
- Phone home (≤600px): balance card with eye-toggle + Deposit button, round quick-action row,
  one notice card, market rows with coloured change pills. Desktop is unchanged.
- Bottom bar is now a rounded floating bar with a filled active icon.
- Admin Balance Overview: Total AUM now includes awaiting-certification funds (locked tile).
- Support cases show the new transaction ref (e.g. PM-D-261101-00040).
- Login page on phones: form in a card, roomier button.

## Install (PowerShell, from your project folder)
1. Unzip pulse-redesign-stage15.zip over the project (replace files).
2. In `server`, restart the server (Ctrl+C, `npm run dev`). No new migration this stage.
3. Restart the site (`npm run dev`) and open it on your phone.

## Why
Phone users want balance + the next action immediately. Everything shown uses the same data
as the desktop dashboard; no new numbers are invented.
