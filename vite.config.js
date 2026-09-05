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
    host: true
  }
})