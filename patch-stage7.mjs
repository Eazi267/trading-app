// Idempotent: adds the two new stylesheets to redesign.css (which loads after index.css).
import fs from 'node:fs'
const p = 'src/styles/redesign.css'
let s = fs.readFileSync(p, 'utf8')
const lines = ["@import './nav.css';", "@import './dash.css';"]
let changed = false
for (const l of lines) {
  if (!s.includes(l)) {
    s = s.replace("@import './shell.css';", "@import './shell.css';\n" + l)
    changed = true
  }
}
if (!s.includes("@import './nav.css';")) { console.error("Could not find the shell.css import in redesign.css - send me that file."); process.exit(1) }
fs.writeFileSync(p, s)
console.log(changed ? 'redesign.css patched' : 'Already patched')
