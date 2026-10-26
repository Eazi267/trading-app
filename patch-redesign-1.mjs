// Pulse redesign, Stage 1 — adds the new design tokens file to the app.
// Safe to run twice. Run from the project root:  node patch-redesign-1.mjs
import fs from 'node:fs'
const f = 'src/main.jsx'
if (!fs.existsSync(f)) { console.error('Run this from the project root (src/main.jsx not found).'); process.exit(1) }
let s = fs.readFileSync(f, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n')
if (s.includes("styles/redesign.css")) { console.log('Already applied — nothing to do.'); process.exit(0) }
if (!s.includes("import './index.css'")) { console.error("Could not find the index.css import in main.jsx — no changes made."); process.exit(1) }
s = s.replace("import './index.css'", "import './index.css'\nimport './styles/redesign.css'")
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('Done: main.jsx now loads src/styles/redesign.css')
