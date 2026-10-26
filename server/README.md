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

**Batch 14 — Audit log reading + append-only guarantee** (migration `014_audit_append_only.sql`)
- `GET /api/audit` — admin only (any admin tier), newest first. Optional `?action=`, `?targetUserId=`, `?limit=` (default 500, max 1000). Returns `{ entries, hasMore }`. There is deliberately **no** write endpoint: entries are created only by the server, inside the routes that change things (`utils/auditLog.js`), so a browser can't forge or skip one.
- Migration 014 adds database triggers so `UPDATE`, `DELETE` and `TRUNCATE` on `audit_log` fail with `audit_log is append-only`. Inserting new entries is unaffected. To clear TEST data in a dev database only: `ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only;` (and re-enable afterwards).

Tested for real against a live Postgres: admin read, action and client filters, `limit`/`hasMore`, bad input (400), client (403) and no token (401); UPDATE/DELETE/TRUNCATE all refused with rows intact, while new entries still insert. The frontend page was also driven in a real headless browser (login, view, filter, CSV export, non-admin redirected).

## Settings-driven investment tiers (Batch 7)

Tier rules (min/max deposit, leverage and duration ranges, payout multiplier) are
edited in **Business Settings → Investment tiers** and are now enforced by the server.

- Saved tiers live in `settings.data.tiers` / `vipTiers`; `Infinity` is stored as `"__INFINITY__"`.
- `PUT /api/settings` validates tiers (`config/tiers.js → normalizeTierLists`) and applies them to the running server immediately. Bad edits get a 400 and change nothing.
- You can't delete a tier while sessions that are `active` or `awaiting_start` still use it.
- `services/tierSync.js` re-reads the saved tiers every 30s (`TIER_REFRESH_MS` to change) so a direct DB edit or a second server instance catches up.
- The frontend batches rapid edits into one save (~0.7s after you stop typing), so typing a number doesn't create an audit entry per keystroke.
- No migration needed. Just restart the backend.

## Trade history on the server (Batch 9)

- Migration `015_position_trade_history.sql` adds `opened_by_id`, `closed_by_id`, `exit_price`, `pnl` to `positions`. Run `npm run migrate`.
- `GET /api/trades` rebuilds the "orders" history (one open event + one close event per position) from the real positions table. Clients get their own; admins get everyone's, or one client's with `?userId=`.
- Manual closes record who closed and at what price; settlements record each position's own exit price and result (labelled "Session settlement").
- Positions closed before the migration have no stored exit price/P&L; they show without a result and are left out of win-rate stats rather than guessed.
- Old browser-only trade history (localStorage `pulse_orders`) is no longer used.

## Signup bonus on the server (Batch 10)

- Migrations `016` (adds the `signup_bonus` transaction type) and `017` (unique index: one signup bonus per user, enforced by the database). Run `npm run migrate`.
- `utils/signupBonus.js → grantSignupBonus(user)` runs inside `POST /api/auth/signup`. If the bonus is enabled and the amount is valid, the new client gets one approved `signup_bonus` transaction, an audit entry (`signup_bonus_granted`) and a notification. Admin and demo accounts never get one. A bonus failure never blocks signup.
- Only NEW signups are granted automatically. Turning the bonus on does NOT back-pay existing clients (that would move real money to everyone at once with one toggle). Credit existing clients individually if you want them to have it.
- `PUT /api/settings` validates `signupBonusEnabled` (true/false) and `signupBonusAmount` (0 – 100,000).
- The old browser-side grant (which created phantom transactions) is removed.

## Server-side withdrawal & deposit rules (Batch 11)

`POST /api/transactions` now enforces (in `utils/transactionRules.js`) what the Deposit/Withdraw page used to enforce only in the browser:

- Min/max amounts (settings `depositMin/Max`, `withdrawalMin/Max`) for deposits and withdrawals.
- Method must be enabled in settings (`depositMethods` / `withdrawalMethods`).
- Withdrawals: KYC verified when KYC is enabled or required for that client; no outstanding fee; bank needs enhanced verification; crypto needs a bound wallet of the same method, and the stored chain always comes from the bound wallet (the request can't override it).
- Withdrawals can't exceed the client's available balance minus withdrawals already pending (money in running sessions is excluded). Check + insert run under a per-user lock, so two simultaneous requests can't both pass.
- Approving a withdrawal re-checks the balance, so a withdrawal can't be approved after the client has committed the money elsewhere.

Corrections (`/:id/correct`) already re-check the balance for withdrawals. Reversing an already-approved transaction is covered in Batch 13.

## Correction hardening (Batch 12)

`POST /api/transactions/:id/correct` now also: refuses a corrected withdrawal that the client's balance can't cover (after their other pending withdrawals); allows at most 10 screenshots of ~2 MB each; and limits the note to 1000 characters. (Approval already re-checks the balance — Batch 11 — so this is the early, friendlier version of the same protection.)

## Reversals and statements (Batch 13)

**Reversing entries.** An approved deposit or withdrawal is never edited or deleted. `POST /api/transactions/:id/reverse` (finance permission, written reason of 5–500 characters) adds an offsetting `reversal` transaction instead: reversing a withdrawal puts the money back, reversing a deposit takes it out. Approved immediately, audited (`transaction_reversed`), and the client is notified.
- A deposit can only be reversed if the client still has that much available (not tied up in a session or already withdrawn).
- Each transaction can be reversed once. The unique index in migration 019 enforces this even if two admins click at the same instant.
- Not automatic: a referral bonus the original deposit may have triggered. Handle that separately.
- Migrations `018` (adds the `reversal` type) and `019` (one reversal per transaction). Run `npm run migrate`.

**Statements.** `GET /api/statements?from=YYYY-MM-DD&to=YYYY-MM-DD[&userId=N]` returns opening balance, every approved balance-moving entry (deposits, withdrawals, session results, released profit, bonuses, reversals) with a running balance, totals, and closing balance, all computed from the same records as the live balance. Clients get their own; admins can pass `userId`. Dates are UTC, the range is capped at two years. The new Statements page downloads CSV or prints / saves as PDF.

Note: the admin client page still shows a delete (bin) button on transactions. The server has no delete endpoint on purpose; use Reverse instead.

## Security hardening (Batch 14)

- **Access control fix (critical).** `GET /api/admin/users` and `GET /api/admin/users/:id` were open to ANY logged-in client, exposing every client's email, phone, KYC images and wallet. They now require the admin role. `POST /api/admin/users/:id/flag` is admin-only, except that a client may flag their own account (the large-deposit flow).
- **Passwords.** Minimum 8 characters, maximum 72 bytes (bcrypt's limit), no common passwords, no single repeated character, must not contain the email name or equal the person's name. Applied on signup, change-password and admin-created accounts (`utils/passwordPolicy.js`).
- **Sign-out everywhere on password change.** Migration `020` adds `users.token_version`. Tokens carry it; changing the password bumps it, so every old token (including a stolen copy) stops working. The change-password response returns a fresh token so the current browser stays signed in. Existing sessions stay valid until their owner changes password.
- **Rate limits.** Login 10 per 15 min per IP; signup 20 per hour per IP (`SIGNUP_RATE_LIMIT`); whole API 3000 per 15 min per IP (`API_RATE_LIMIT`; prices are exempt). In-memory, so they reset on restart and are per server instance.
- **Headers.** `helmet` (no sniffing, no framing, HSTS, ...); `X-Powered-By` removed.
- **Behind a proxy.** `TRUST_PROXY` (default 1 in production, 0 locally) so rate limits see the real visitor address, not the host's proxy.
- **Refuses unsafe production boots.** With `NODE_ENV=production` the server exits if `JWT_SECRET` is under 32 characters or `CORS_ORIGIN` is empty.
- **Frontend.** Admin-written About Us / Privacy HTML is cleaned with DOMPurify before display (`npm install dompurify` in the project root).

Run `npm run migrate` (applies 020), then restart.

Not done yet: admin two-factor login, password reset and email verification, moving the JWT out of localStorage (cookie), encrypted / private storage for KYC images, shared (database-backed) rate limiting for multi-instance hosting.

## Admin two-factor login (Batch 15)

Admins can turn on authenticator-app login (Settings → Two-factor login). Works with Google Authenticator, Authy, Microsoft Authenticator, 1Password etc. Clients don't use it.
- **Login becomes two steps.** `POST /api/auth/login` returns `{ twoFactorRequired, challenge }` (a 5-minute ticket that is useless as a session) instead of a token; `POST /api/auth/login/2fa { challenge, code }` returns the real token. Separate rate limit (10 per 15 min per IP).
- **Setup** (`POST /api/auth/2fa/setup` then `/enable`): you add the key to your app and prove it works with a code; only then is it switched on. 8 one-time recovery codes are shown once; only their hashes are stored.
- **Turn off** (`POST /api/auth/2fa/disable`) needs your password AND a current code or recovery code.
- **Safety details:** standard 6-digit / 30-second TOTP (tested against the RFC 6238 vectors); a code can never be used twice; the secret is stored AES-256-GCM encrypted; every on / off / recovery-code login is audited.
- **Lost phone and lost recovery codes:** from the server folder run `node reset2fa.js admin@example.com` (turns it off and signs that admin out everywhere). Only someone with server access can do this.
- **Key note:** secrets are encrypted with `TOTP_ENCRYPTION_KEY` (or `JWT_SECRET` if unset). Set `TOTP_ENCRYPTION_KEY` separately in production so rotating `JWT_SECRET` later doesn't lock admins out. If the key changes, run `reset2fa.js` for each admin and set 2FA up again.
- Run `npm run migrate` (applies 021).

Also in Batch 15: the dead delete (bin) button on admin client transactions is gone (use Reverse in the transaction's View window).

Not done yet: forcing every admin to enable 2FA, a QR code (you type the key instead), password reset and email verification.

## Encrypted KYC images (Batch 16)

ID and proof-of-address photos used to sit as plain text inside `users.kyc`, and rode along in every login, `/me` and admin client list. Now:
- **Encrypted at rest.** Images live in a separate `kyc_files` table (migration 022), AES-256-GCM encrypted (`utils/fileCrypto.js`). A leaked database dump alone shows only scrambled bytes.
- **Never in the user record.** `users.kyc` keeps only status and flags (`hasFrontImage`, `hasBackImage`). Logins, `/me` and client lists are small again and carry no photos.
- **Fetched on demand:** `GET /api/kyc/:userId/image/:slot` (`front`, `back`, `enhanced`). Allowed for the owner or an admin with the finance permission; everyone else gets 403. Every admin view is audited (`kyc_image_viewed`).
- **Upload checks:** JPG / PNG / WebP / GIF / HEIC / BMP / PDF only (no SVG, which can hide scripts), 3.5 MB per file. Oversize requests now return a clear 413 instead of a vague 500.
- **Moving old photos:** after `npm run migrate`, run `node encryptKycImages.js` once. It moves any inline images into the encrypted table and is safe to re-run. Until you run it, old images still display (fallback).
- **Key:** `KYC_ENCRYPTION_KEY` (or `JWT_SECRET` if unset). Set a separate one in production and BACK IT UP. If it is lost or changed, existing images cannot be opened and clients must re-upload.

Still true: images are inside the database, so database backups hold encrypted copies. Moving to private object storage (S3 etc.) is the next step if volume grows.

## Login in an HttpOnly cookie (Batch 17)

The login session used to be a token kept in the browser's localStorage, readable by any script on the page, so a single injected script could steal it. Now:
- **HttpOnly cookie** (`pulse_session`, 7 days). Page scripts cannot read it. Set by `login`, `signup`, `login/2fa` and `change-password`; cleared by the new `POST /api/auth/logout`. Secure (HTTPS-only) in production.
- **The website no longer receives the token.** It identifies itself with an `X-Requested-With: pulse` header and the response body then omits `token`. Scripts, tests and other clients (no header) still get the token and can send it as `Authorization: Bearer ...` exactly as before.
- **CSRF protection.** A browser attaches cookies even to requests a hostile site triggers, so a cookie-authenticated request that changes data (anything except GET) must carry `X-Requested-With: pulse`, otherwise 403. Bearer requests are not affected. CORS now allows credentials only for the origins in `CORS_ORIGIN`.
- **Old sessions:** the previous localStorage token is deleted on first load; everyone logs in once more.
- Frontend change: only `src/api/client.js` (everything already went through it).

### Which setup to use

| Setup | What to set |
|---|---|
| Local development (site on :5173, API on :4000) | nothing, works as is |
| **One address, no domain needed** (the server also serves the site) | build the site with `VITE_API_URL=same-origin`, run the server with `SERVE_FRONTEND=1` and `CORS_ORIGIN` = the site's own URL |
| Site and API on subdomains of one domain (app.example.com + api.example.com) | `CORS_ORIGIN=https://app.example.com`; the default `COOKIE_SAMESITE=lax` works |
| Site and API on unrelated domains | `COOKIE_SAMESITE=none` (HTTPS required). Not recommended: Safari and Chrome increasingly block cookies in this case |

`SERVE_FRONTEND=1` serves the Vite `dist` folder (run `npm run build` in the project root first): hashed assets cached for a year, every other page URL falls back to `index.html` so React routes and refreshes work.

Not done yet: forcing every admin to use two-factor; password reset and email verification.

## Email codes: verification and forgotten password (Batch 18)

Emailed 6-digit one-time codes, built as a general mechanism (`utils/emailCodes.js`) so more uses (for example confirming a withdrawal) can be added later.

- **Verify email.** A code is emailed at signup. `POST /api/auth/verify-email/send` (logged in) sends another; `POST /api/auth/verify-email/confirm { code }` confirms. The website shows a banner until verified, and a Verify Email page.
- **Forgot password.** `POST /api/auth/password-reset/request { email }` and `POST /api/auth/password-reset/confirm { email, code, newPassword }`. The first call always gives the same reply whether or not the email has an account (no way to discover who is registered). Resetting signs the person out everywhere (`token_version`), marks the email verified, and emails a "your password was changed" notice. Admins with two-factor still need their code to log in afterwards.
- **How codes are protected.** Only a keyed hash is stored. A code lasts 15 minutes, works once, and dies after 5 wrong guesses. A new code replaces any older one. At most 1 code a minute and 5 an hour per person, plus per-address rate limits. A too-weak new password is refused WITHOUT using up the code.
- **Optional enforcement.** `REQUIRE_VERIFIED_EMAIL=1` blocks deposit and withdrawal requests until the email is verified. Off by default (existing users are all unverified, so turn it on once email delivery works).
- Migration `023` adds `users.email_verified_at` and the `email_codes` table. Run `npm run migrate`.

### Sending the emails

Set these on the server:

| Variable | Meaning |
|---|---|
| `EMAIL_PROVIDER` | `resend` to really send; `console` prints emails in the server log (default when not in production, for testing only) |
| `RESEND_API_KEY` | API key from your Resend account |
| `EMAIL_FROM` | e.g. `Pulse <noreply@yourdomain.com>`; the domain must be verified with the provider (DNS records) |

- **No domain yet:** keep `console` mode while building and testing. In production without a provider nothing is sent and nothing is logged (a log would reveal the codes); the server prints one warning at start. With `REQUIRE_VERIFIED_EMAIL=1` and no provider the server refuses to start in production, because nobody could verify.
- **A failing mail provider never breaks signup or reset**; the error is only logged.
- The brand name in emails comes from the website's own Settings (editable), falling back to `APP_NAME`.

Not done yet: forcing every admin to use two-factor; confirming withdrawals by emailed code (the mechanism is ready).
