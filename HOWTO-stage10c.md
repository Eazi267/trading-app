# Stage 10c — Support Inbox + Broadcast

Files: src/pages/AdminSupportInbox.jsx, src/pages/AdminBroadcast.jsx, src/styles/dash.css

Apply: unzip over your project, `npm run dev`, open Admin > Support Inbox and Admin > Broadcast.

- Inbox: Unread / Open / Resolved strip, search, Open/Resolved/All filter, "Open client" link.
  On a phone it is list -> tap a case -> thread, with an "All cases" back button.
  A case is only marked read once you actually open it on a phone.
- Broadcast: character counters, live "what clients will see" preview, and a confirm step
  ("goes to N clients and can't be unsent") before anything is sent. Logic unchanged: same notifyBulk call.
