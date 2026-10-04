# Pulse API — Backend (Batches 1–3: Auth + Transactions + Settings/Admin)

## What this is
A real Express + PostgreSQL backend, starting with authentication —
the foundation everything else (transactions, sessions, admin actions)
will build on in later batches. This is a separate Node project from
the frontend (its own `package.json`), living in this `server/`
folder alongside `src/`.

**Tested end-to-end against a real local Postgres instance before
delivery** — signup, duplicate-email rejection, correct login, wrong
password, `/me` with and without a token, and short-password
rejection all verified working, not just read through.

## Why plain `pg`, not Prisma
Started with Prisma, hit a wall: its engine binaries are fetched from
`binaries.prisma.sh` at `generate`/`migrate` time, and that host isn't
reachable from the sandbox this was built in — so it couldn't be
build-verified. Rather than ship ORM code untested, switched to plain
`pg` with hand-written SQL migrations, which needed no binary
download and could be run for real. If you'd rather use Prisma (or
another ORM) on your own machine where the binary host *is*
reachable, the SQL in `sql/001_init.sql` is a straightforward map to
a Prisma schema — just ask and I'll write one.

## First-time setup

1. You'll need a real Postgres database. Two options:
   - **Local**: install Postgres, then `createdb pulse`
   - **Railway** (matches the deployment target from earlier
     planning): add a PostgreSQL plugin to your Railway project, copy
     the `DATABASE_URL` it gives you
2. `cd server`
3. `cp .env.example .env`, then fill in:
   - `DATABASE_URL` — your local or Railway connection string
   - `JWT_SECRET` — generate one with:
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
4. `npm install`
5. `npm run migrate` — creates the tables (safe to re-run; it tracks
   what's already applied and skips it)
6. `npm run dev` — starts the API on `http://localhost:4000` (or
   whatever `PORT` you set), auto-restarting on file changes

## Endpoints

**Batch 1 — Auth**
- `GET /health` — no auth, just confirms the server + DB are up
- `POST /api/auth/signup` — `{ name, email, password, country?, referredBy? }`
- `POST /api/auth/login` — `{ email, password }` (rate-limited: 10 attempts / 15 min per IP)
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`

**Batch 2 — Transactions** (all require `Authorization: Bearer <token>`)
- `POST /api/transactions` — `{ type: 'deposit'|'withdrawal'|'fee_payment', amount, method?, chain? }`
- `GET /api/transactions/mine` — the caller's own transactions
- `POST /api/transactions/:id/proof` — `{ screenshots: [...] }` — client self-report, only on their own pending deposit/fee_payment
- `GET /api/transactions/pending` — admin only (`finance` permission)
- `POST /api/transactions/:id/approve` — admin only (`finance` permission)
- `POST /api/transactions/:id/reject` — admin only (`finance` permission), `{ reason? }`
- `GET /api/users/me/balance` — live-calculated from approved transactions, never stored anywhere

**Batch 3 — Settings + Admin management** (all except `GET /api/settings` require `Authorization: Bearer <token>`)
- `GET /api/settings` — public, no auth (deposit instructions, crypto reference info, tiers — nothing sensitive)
- `PUT /api/settings` — admin only (`manageSettings` permission), shallow merge like the frontend's `updateSettings()`
- `POST /api/admin/users` — admin only (`manageAdmins`), `{ name, email, password, adminTier }` — **replaces the manual SQL promotion step**, creates a real admin account
- `POST /api/admin/users/:id/deactivate` — admin only (`manageAdmins`) — can't deactivate yourself
- `POST /api/admin/users/:id/reactivate` — admin only (`manageAdmins`)

Tested end-to-end for real: settings blocked for a non-admin (403),
super_admin updates settings and a shallow merge leaves unrelated
keys untouched, super_admin creates a finance_admin through the real
endpoint, a regular user is blocked from doing the same (403), a
deactivated user is rejected at login AND their existing token stops
working immediately (not just at next login), self-deactivation is
blocked, reactivation restores login — every action shows up
correctly in `audit_log`.

**Batch 4 — Transaction correction + appeal** (deposit/withdrawal only — see below)
- `POST /api/transactions/:id/correct` — admin only (`finance`), `{ actualAmount, screenshots?, note? }`
- `POST /api/transactions/:id/appeal` — owner only, `{ note? }` — records the appeal and audit-logs it, but does **not** yet open a linked support case (that needs Support Cases, a separate unbuilt batch)

Deliberately **not** available for `fee_payment` — that correction needs
fee-pool allocation recomputed too (see `sql/004_transaction_corrections.sql`),
which doesn't exist yet. The endpoint returns a clear 400 explaining
why rather than silently applying a correction with stale fee
allocations.

Tested end-to-end for real: admin corrects a $500 deposit request down
to the $420 actually received, client appeals it, appealing twice is
blocked (400), a different client can't appeal someone else's
transaction (403), a fee_payment correction attempt is explicitly
rejected with the reason why, and — the one that actually matters —
approving the corrected transaction credits the client's balance with
the corrected $420, not the original $500 request.

**Batch 5 — Support Cases** (all require `Authorization: Bearer <token>`)
- `POST /api/support/cases` — client, `{ subject?, category, body, relatedTransactionId? }`
- `GET /api/support/cases/mine` — client's own cases
- `GET /api/support/cases/:id` — case + full message thread (owner or any admin)
- `POST /api/support/cases/:id/messages` — reply, either side — a new message auto-reopens a resolved case
- `GET /api/support/cases` — admin inbox (`support` permission), optional `?status=open|resolved` filter
- `POST /api/support/cases/:id/status` — admin only (`support`), `{ status: 'open'|'resolved' }`

**This also completes Batch 4's `/appeal` endpoint** — it now creates
a real linked case (with the exact same auto-generated message text
as the frontend's `appealTransaction()`) instead of the placeholder
warning Batch 4 shipped with.

Tested end-to-end for real: case created and visible to its owner and
support admins only (a different client gets 403), admin reply shows
up, admin resolves it, client's follow-up message auto-reopens it, a
plain client is blocked from resolving a case (403, no `support`
permission), and the full correct→appeal flow creates a real case
with `category: 'appeal'`, the right subject, and the right
auto-generated body text.

**Batch 6 — Fee-balance pooling** (all require `Authorization: Bearer <token>`)
- `POST /api/fees` — admin only (`finance`), `{ targetUserId, amount, note?, discountAmount?, durationHours?, linkedSessionId? }` — charges a fee, recorded and approved immediately (unlike a deposit, this is the admin's own action, not something reviewed)
- `POST /api/fees/:id/discount` — admin only (`finance`), time-limited discount on an outstanding fee
- `GET /api/fees/outstanding` — the caller's outstanding fees (admins can pass `?userId=`)
- `POST /api/fees/pay` — client pays any amount toward their pooled Fee Balance; allocation against outstanding fees (oldest first) is computed and **locked in at submission time**, not recalculated at approval
- Approving a `fee_payment` (existing `/api/transactions/:id/approve`) now applies the locked-in allocation to each fee's `amount_paid`, flips fully-paid fees to `'paid'`, and — if the payment overpaid — creates a real separate `deposit` transaction for the genuine excess

The trickiest part of this system is a real bug the frontend already
hit and fixed once: a fee paid in full while a discount was active
must **stay** paid even after the discount's time window expires —
otherwise the math would re-price it against the full undiscounted
amount and it'd silently look owed again. `utils/fees.js`'s
`feeOwedAmount()` checks `fee_status === 'paid'` first, unconditionally,
before any discount math runs.

**Also found a real bug while testing this batch**, worth knowing
about: charging a fee crashed the *entire server process*, not just
that one request — a missing `note` column threw inside an async
route handler, and without anything catching async errors, an
unhandled rejection took the whole process down. Fixed two ways: the
missing `note` column (migration 007), and — the actually important
fix — added `express-async-errors` so any future error in any route
becomes a normal 500 response instead of crashing the server. This
should have been in place from Batch 1; it wasn't, and this is
what surfaced it.

Tested end-to-end for real, fresh database: a client blocked from
charging fees (403, no crash), a $100 fee charged, a $30/1hr discount
correctly brings it to $70 owed, client pays exactly $70, fee flips to
`paid`, outstanding list goes empty, **the bug-prevention check** —
forcing the discount to look expired via direct SQL and confirming
the paid fee does NOT reappear as owed — a second $50 fee overpaid
with $80 correctly allocates $50 and spills $30 into a real deposit
that shows up in the live balance calculation, and `fee_payment` is
confirmed impossible to create through the generic transaction
endpoint (locked to the dedicated allocation-aware route only).

**Batch 7 — Trading Sessions + Positions** (the big one)

Before writing any of this, a real blocker got flagged and resolved
first: `positionEquity()` needs a *current price*, and until now
there was no price source on the server at all — only the browser's
own simulated/CoinGecko-fetched prices. Letting a client submit a
price for their own P&L would be a client controlling their own
trading result. Resolved by building a real server-authoritative
price engine (`services/priceEngine.js`) — genuine CoinGecko polling
for BTC/ETH server-side, the same random-walk simulation as the
frontend for EUR/GBP/Gold/Silver. **No route anywhere accepts a price
as request input** — `GET /api/prices` is the only way to read one.

- `POST /api/sessions` — start a session, checked against real
  available balance (`utils/balance.js`, shared with the balance
  endpoint so there's one calculation, not two)
- `GET /api/sessions/mine` / `GET /api/sessions/:id` — includes live
  mark-to-market value for active sessions
- `POST /api/sessions/:id/leverage` / `.../duration` — admin only (`trade`)
- `POST /api/sessions/:id/positions` — admin only (`trade`), opens a
  position against the session's own cash, entry price always from
  the server price engine
- `POST /api/sessions/:id/positions/:id/close` — admin only (`trade`)
- `POST /api/sessions/:id/close` — admin anytime, or the owning
  client only once the timer has actually run out
- **Auto-expiry sweep** (`jobs/autoExpiry.js`) — polls every 5s and
  force-settles any active session whose timer ran out, whether or
  not anyone has the app open. Shares one `settleSession()` function
  with the manual close route — not two copies of settlement math
  that could drift.

Tier payout caps work as designed: a session's real (`rawPnl`) result
gets capped at `amount * (tier.maxPayoutMultiplier - 1)` — only the
**upside**, never a loss — and whatever's capped away becomes a
separate `capped_profit_release` transaction pending its own admin
review, not silently discarded or silently paid in full.

**Two real bugs found while testing this, not caught by review:**
1. Charging into the auto-expiry sweep for the first time threw
   `amount > 0 constraint violation` — session_settlement is a
   *signed* result (can be $0 on a breakeven session, negative on a
   loss), and Migration 2's blanket positivity check didn't know
   that. Fixed in Migration 9: positivity is still enforced at the
   database level for deposit/withdrawal/fee/fee_payment, but
   session_settlement and capped_profit_release can be any value.
2. The sweep job's own `try/catch` meant this failure logged an error
   and moved on instead of crashing — confirms the Batch 6
   `express-async-errors` fix is doing its job as a genuine safety
   net, not just for that one bug it was added for.

Tested end-to-end for real, including the auto-expiry job actually
firing (not just reading the code): full lifecycle from funded
deposit → session start → balance correctly shows funds as pending →
a client blocked from opening their own position (403, admin-only) →
trading admin opens a position at the real server price → tier cap
correctly splits a huge profit into a capped payout + pending excess
→ a session forced to look expired via direct SQL gets picked up and
closed by the background sweep within its 5s interval, not by any
request triggering it → an active, not-yet-expired session correctly
refuses to be closed by its own client (400) → a forced heavy loss
correctly leaves the session's cash negative with no auto-liquidation
(matches the frontend's explicit design decision) → **and, after the
Migration 9 fix**, both a $0 breakeven settlement and a -$120 losing
settlement record cleanly with a completely clean server log.

**Batch 8 — Notifications + Referral Campaigns**

- `GET /api/notifications/mine`, `GET /api/notifications/mine/unread-count`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`
- `POST /api/notifications/broadcast` — admin only (`support`), `{ userIds: [...] }` or `{ all: true }`
- Retrofitted real `notify()` calls into every existing route where a real event already happens: deposit/withdrawal approved, fee payment approved, session settlement certified, capped-profit released, trade opened/closed, session settled — not a notifications table that exists but nothing ever populates
- `POST /api/referrals/campaigns` (+ `GET`, `PATCH`, `.../active`) — admin only (`manageSettings`)
- Referral bonus payout wired into the **existing** deposit-approval flow — pays out automatically the instant a referred user's first-ever deposit is approved, no separate step

**Three real bugs found while testing this batch, all from actually running it against a live database, not from review:**
1. `referral_bonus` needed a `details` JSONB column that didn't exist — added in the same migration before it could even be tested.
2. Migration 9's constraint fix (from Batch 7) used an *allowlist* of which types must be positive — `referral_bonus` wasn't on it, so it was silently blocked the same way session settlements were before. Migration 12 flips this to a *denylist* of the two signed types instead, so any transaction type added later defaults to "must be positive" automatically rather than needing someone to remember to update a list.
3. The real one that would've mattered most: the referral bonus transaction recorded correctly (it showed up right in campaign stats), but `utils/balance.js`'s SUM never included `referral_bonus` at all — a referrer would see their bonus in the campaign admin panel while their own actual balance silently stayed unchanged. Fixed, and re-verified with a full run confirming the balance genuinely updates now.

Tested end-to-end for real: a deposit approved *before* any campaign existed correctly pays no bonus, a second deposit from an *already-referred* user correctly pays no second bonus (first-deposit-only), a *fresh* referred user's first deposit during an active campaign pays out correctly with a real notification, a second distinct referred user under the same referrer pays a second bonus (per-referred-user, not a one-time cap), a withdrawal approval never triggers a bonus, unread counts and mark-all-read work, broadcast reaches every client, and a trading_admin (no `support` permission) is correctly blocked from broadcasting (403).

**Batch 9 — User Profile, KYC, Wallet, Admin User-Management** (the scope-gap fix)

This batch exists because wiring the frontend surfaced a real problem: AuthContext.jsx is 654 lines and only ~15% of it (auth) had a backend home. Every admin page reads from AuthContext's *local* user roster — wiring auth alone would have meant a real, authenticated user was invisible to every admin panel. Fixed by building the rest of what AuthContext does:

- `PATCH /api/users/me` — self-editable fields only (name, phone, avatar, country, preferredCurrency) — role/tier/verification are never in that list, so a client can't PATCH their way into anything, no matter what they send
- `POST /api/auth/change-password`, `POST /api/users/me/wallet` (bind-once, admin/support-only to unbind)
- `GET /api/admin/users` (+ `?includeDemo=`, `?flagged=`), `GET /api/admin/users/:id` — **the actual fix**
- `POST /api/admin/users/:id/tier` / `.../vip` / `.../flag` / `.../admin-tier` / `.../kyc-required` / `.../wallet/unbind`
- `POST /api/admin/demo-clients` / `DELETE /api/admin/demo-clients` — tagged `is_demo_generated`, cascade-deletes only ever touch demo-tagged rows, real accounts are structurally unreachable by this route
- `POST /api/kyc` (+ `/:userId/review`), `POST /api/kyc/enhanced` (+ `/:userId/review`) — enhanced requires basic already verified, matching the frontend's own gate

Also pulled `publicUser()` (previously duplicated between `auth.js` and `admin.js`) into a shared `utils/publicUser.js` before it grew ~10 more fields — the same duplication-drift risk flagged elsewhere in this project.

Tested end-to-end for real: the client now shows up in the admin roster (the core fix), a role-injection attempt via profile update was silently ignored while the legitimate field still updated, password change immediately works for login, wallet bind-then-double-bind-blocked-then-admin-unbind, tier/VIP/flag assignment, the full KYC reject→resubmit→approve cycle, enhanced KYC correctly blocked for a client without basic verification, demo-client generation/tagging/listing and a cascade-delete that removed only the 3 demo accounts while the real client survived untouched, and a trading_admin correctly blocked (403) from generating demo clients (no `manageAdmins`).

**Batch 10 — Admin transaction listing + frontend-compat fixes** (made while wiring the frontend)
- `GET /api/transactions` — admin only (any tier, role check not permission-gated — viewing platform totals isn't a money-moving action), optional `?userId=` filter. Added because the admin dashboard's platform-wide totals and a client detail page's full history need "everyone's transactions" or "one client's complete history", which neither `/mine` nor `/pending` covers.
- `POST /api/transactions` and `POST /api/fees/pay` now accept and store `note` (the client's own payment reference — a tx hash or bank reference), trimmed and capped at 500 chars. Found because the frontend sent it and the backend silently dropped it.
- Every transaction listing now joins in `userName`, `reviewedByAdminName`, and `executedByAdminName` (single shared `TX_SELECT` query), and `publicTx()` emits compatibility aliases for the frontend's original field names (`depositMethod`, `withdrawalMethod`, `depositChain`, `depositReference`, `sessionId`, `campaignId`, `referredUserName`, …). Done in one place so dozens of screens don't silently render blanks; new code should prefer the generic names (`method`, `chain`, `linkedSessionId`, `details`).
- `publicTx()` now includes the fee, fee-payment and referral fields it was missing.

**Batch 11 — Finished the Managed-mode deferral + session testing tools**
- `POST /api/sessions` now actually checks `investmentMode` from the real settings table (Batch 3) — previously this always went straight to `'active'`, flagged as deferred rather than silently dropped. Finished now: a client self-starting a session under Managed mode gets `'awaiting_start'` (funds held as pending, nothing active yet); an admin starting one on a client's behalf always goes straight to `'active'` regardless of the setting, since the admin IS the human sign-off Managed mode exists to require.
- `POST /api/sessions/:id/begin` — admin only (`trade`) — starts the clock on an awaiting-start session
- `POST /api/sessions/:id/cancel` — owner or admin — cancels one still awaiting start; nothing was ever debited (only reserved), so cancelling just frees the pending amount back up, no refund transaction needed
- `POST /api/sessions/:id/fast-forward` — admin only (`trade`), `{ hours }` — pulls a session's real `expires_at` closer for testing, so you don't have to wait out real 2-14 day tier durations; the existing 5-second auto-expiry sweep picks it up and settles it for real against whatever the live price feed actually did
- `GET /api/sessions` — admin, everyone's sessions or one client's with `?userId=`, same "mine vs everyone" split as `GET /api/transactions`

Tested end-to-end for real: Managed mode turned on, client self-start correctly lands on `awaiting_start`, a client blocked (403) from beginning their own session, admin-begin correctly starts a real clock, fast-forward + a real wait for the 5-second sweep correctly force-settled the session, Direct mode confirmed unaffected (still goes straight to active), and the admin listing works with its `?userId=` filter while a plain client is correctly blocked (403).

## What's deliberately different from the frontend's AuthContext.jsx
- Real bcrypt password hashing, not plaintext in a JS array
- No UID-as-password login shortcut — that's a real vulnerability
  once this is a real backend (see the comment at the top of
  `sql/001_init.sql` for the full reasoning)
- Server-side permission enforcement (`middleware/auth.js`'s
  `requireRole`/`requirePermission`) — this is what actually closes
  the devtools-bypass gap flagged earlier, since a client can edit
  their own JS but not this

## What's NOT built yet
Per-session scenario control (admin demo/testing tool — deliberately
not ported), investment tiers are not yet settings-driven (static
`config/tiers.js` copy). Backend feature scope is otherwise complete
against what AppContext.jsx AND AuthContext.jsx do. The frontend
still isn't wired to call any of this — it still runs entirely on
localStorage. That's the next phase of work.

## If something breaks
Same process as always — copy the exact error and send it over.
