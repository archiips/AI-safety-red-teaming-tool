import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// In dev, seed localStorage with a valid JWT so every request is authenticated.
// In production, the user logs in and the token is set by the auth flow.
if (!localStorage.getItem('crucible_token') && import.meta.env.VITE_DEV_TOKEN) {
  localStorage.setItem('crucible_token', import.meta.env.VITE_DEV_TOKEN)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
