# Stage 12a: Emailed confirmation codes (OTP) controlled by the admin

## What it does
A super admin (or anyone with "manage settings") can switch on an emailed 6-digit code for these CLIENT actions:
withdrawal requests, deposit requests, saving the withdrawal wallet, starting an investment session, changing the password.
Admin > Admin Accounts > "Security and email switches" > "Ask clients for an emailed code (OTP) before...".

## How it works (for learning)
1. Client presses the button as usual. The server sees the switch is on and no code came with the request, emails a code, and answers "otpRequired".
2. The website (src/api/client.js) catches that answer, opens the code dialog (src/components/OtpHost.jsx), then REPEATS the same request with the code in a header. No page needed changes.
3. The server (middleware/otp.js) checks the code: single use, 15 minutes, 5 wrong tries, max 5 emails per hour.
Clients need a verified email. Admin accounts are never asked. Every switch change is in the Audit Log.

## Apply
1. Copy the files from the zip (same paths).
2. Run the new database step once: `cd server` then `npm run migrate` (adds file sql/025_otp_purposes.sql).
3. Restart the server and the site.

## Real emails (Resend), needed before you can switch OTP on in production
1. Make a free account at resend.com, add and verify your domain, create an API key.
2. In server/.env set:
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=your key
   EMAIL_FROM="Pulse <noreply@yourdomain.com>"
3. Restart the server. In Admin Accounts press "Send me a test email". If it arrives, codes will too.
Without a provider in production the OTP switches refuse to turn on, so clients can never be locked out.

# Stage 12b: Terms, Privacy, Cookie policy and cookie consent
- New public pages: /terms, /privacy, /cookies (footer links added; signup shows "By creating an account you agree to...").
- Until you write your own, a standard TEMPLATE is shown. Edit it in Admin > Business Settings > Terms / Privacy / Cookie policy ("Load the standard template to edit"). It is a general template, not legal advice: have a lawyer review it.
- Cookie banner on first visit: Essential only / Customize / Accept all. "Cookie settings" in the footer reopens it.
- Theme, colours and favourites are only saved in the browser when the visitor allows "Preferences". The sign-in cookie is essential and always on.
- You do not run analytics or ad cookies today; if you add them later, add them behind this consent.
