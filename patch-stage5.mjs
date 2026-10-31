// Idempotent: safe to run more than once.
import fs from 'node:fs'
const p = 'src/pages/Dashboard.jsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('PortfolioPerformance')) {
  s = s.replace("import AdminDashboardView", "import PortfolioPerformance from '../components/PortfolioPerformance.jsx'\nimport '../styles/dashboard.css'\nimport AdminDashboardView")
  const marker = '      <div className="glass-card" style={{ marginBottom: 20, overflow: \'hidden\' }}>\n        <div className="panel-head">\n          <h3>BTC/USD'
  if (!s.includes(marker)) { console.error('Marker not found - Dashboard.jsx was changed; send it to me.'); process.exit(1) }
  s = s.replace(marker, '      <PortfolioPerformance transactions={transactions} userId={currentUser.id} total={total} available={available} />\n\n' + marker)
  fs.writeFileSync(p, s)
  console.log('Dashboard.jsx patched')
} else console.log('Already patched')
