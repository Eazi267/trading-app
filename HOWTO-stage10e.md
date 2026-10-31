# Stage 10e — Business Settings

Files: src/pages/AdminBusinessSettings.jsx, src/components/Modal.jsx, src/styles/dash.css

Apply: unzip over your project, `npm run dev`, open Admin > Business Settings.

What changed
- The long list of rows is now a grid of cards in four groups (Brand and company, Money, Messages and content, Verification and other).
  Each card shows a one-line live status (brand name, tier counts, deposit/withdrawal limits, signup bonus on/off, ...).
- Dialogs: all 14 open exactly as before, with all their logic untouched. Inputs and Save buttons got the new look.
- Modal.jsx (shared dialog): Escape now closes it, it announces itself as a dialog to screen readers, and on a phone it slides up as a bottom sheet.
