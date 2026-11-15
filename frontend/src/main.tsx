import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './auth/Auth.css'
import { AuthProvider } from './auth/AuthContext'
import { AuthRouter } from './auth/AuthRouter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AuthRouter />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

if (import.meta.env.PROD && isSecureContext && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .catch((error: unknown) => {
        console.warn('CyberSaathi offline support could not be enabled.', error)
      })
  }, { once: true })
}
