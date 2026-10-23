// Run from your project root:  node patch-signup-bonus.mjs
// Removes the browser-side signup-bonus effect from src/context/AppContext.jsx
// (the server grants the bonus now). Makes a .bak first.
import fs from 'fs'
const file = process.argv[2] || 'src/context/AppContext.jsx'
let s = fs.readFileSync(file, 'utf8')
const nl = s.includes('\r\n') ? '\r\n' : '\n'
s = s.replace(/\r\n/g, '\n')
if (s.includes('granted by the SERVER when a client')) { console.log('Already patched. Nothing to do.'); process.exit(0) }
const i = s.indexOf('  // Grants a one-time signup bonus')
const j = s.indexOf('  function getAccountBalance(userId)')
if (i < 0 || j < i) { console.error('Could not find the signup bonus effect (from "// Grants a one-time signup bonus" to "function getAccountBalance"). No changes were made.'); process.exit(1) }
s = s.slice(0, i) + `  // (The one-time signup bonus is now granted by the SERVER when a client
  // signs up — see server/src/utils/signupBonus.js. It used to be created
  // here in the browser, which made phantom transactions that vanished on
  // refetch.)

` + s.slice(j)
fs.writeFileSync(file + '.bak', fs.readFileSync(file))
fs.writeFileSync(file, s.replace(/\n/g, nl))
console.log('Patched ' + file + ' (backup saved as ' + file + '.bak)')
