import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In Docker, VITE_API_HOST is set to http://api:8000 via docker-compose environment.
// Locally it falls back to localhost:8000.
const apiHost = process.env.VITE_API_HOST ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    proxy: {
      '/runs': {
        target: apiHost,
        ws: true,  // upgrade WebSocket on /runs/{id}/stream too
      },
      '/policies': apiHost,
      '/health': apiHost,
    },
  },
})
