import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // host: true binds to 0.0.0.0 instead of just localhost — this
    // is what makes `npm run dev` reachable from a phone on the same
    // WiFi network (via your computer's LAN IP), not just from the
    // computer itself. See SETUP.md for the actual testing steps.
    host: true,
    // Phones (LAN address or a forwarded/dev-tunnel port) can't reach "localhost:4000",
    // because on a phone "localhost" is the phone itself. So the site asks its OWN
    // address for /api/... and this passes those requests on to the API running on
    // this computer. Only the one site port needs to be reachable.
    // Different API address? Start with VITE_PROXY_TARGET=http://localhost:4010.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        xfwd: true,
        // `node --watch` restarts the API every time a server file changes (for example when you
        // copy in new files). A request that lands in those few seconds used to show a bare 500.
        // Now it gets a clear, retryable message instead.
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (!res || res.headersSent || typeof res.writeHead !== 'function') return
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'The server is restarting or not running. Wait a few seconds and try again.' }))
          })
        }
      },
      '/health': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000' }
    }
  }
})