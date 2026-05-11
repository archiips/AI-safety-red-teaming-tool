import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// In dev, always use VITE_DEV_TOKEN so stale/invalid localStorage values don't block auth.
// In production VITE_DEV_TOKEN is not set so this is a no-op.
if (import.meta.env.VITE_DEV_TOKEN) {
  localStorage.setItem('crucible_token', import.meta.env.VITE_DEV_TOKEN)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
