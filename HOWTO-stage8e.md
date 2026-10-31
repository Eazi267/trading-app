# Stage 8e – Notifications, Verification, sign-up pages (+ Statements hidden)

Needs Stages 7 to 8d applied first.

Files (all REPLACE your copies):
- src/App.jsx
- src/components/navModel.jsx
- src/pages/Notifications.jsx, KycVerification.jsx, VerifyEmail.jsx
- src/pages/Login.jsx, Signup.jsx, ForgotPassword.jsx
- src/styles/dash.css, redesign.css
- src/styles/auth.css   (NEW file)

Steps (PowerShell, in your project folder)
1. Unzip into your project folder, choose Replace.
2. npm run dev. Check Login, Signup, Forgot password (log out first), then Notifications, Verification and Verify email.

What changed
- Statements: removed from the client and admin menus. /statement now sends people to the Dashboard.
  Nothing was deleted: src/pages/Statement.jsx is still in your project, ready to bring back later
  (re-add the two menu lines in navModel.jsx and the route in App.jsx).
- Notifications: All / Unread tabs, grouped under Today / Yesterday / Earlier, tap to mark read, Mark all as read.
- Verification: status card (In review / Verified / Rejected with the reason), a progress list, and cleaner upload forms.
- Verify email: centred card with a large 6-digit code box.
- Login / Signup / Forgot password: darker gold-glow side panel, rounder fields, and on phones a compact
  logo header instead of the hidden side panel.
No logic was changed.
