import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

function publishServiceWorkerState(state: string) {
  window.dispatchEvent(new CustomEvent('risk-lab-sw-state', { detail: state }))
}

async function registerServiceWorker() {
  if (!import.meta.env.PROD) {
    publishServiceWorkerState('development: not registered')
    return
  }

  if (!('serviceWorker' in navigator)) {
    publishServiceWorkerState('unsupported')
    return
  }

  try {
    const registration = await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}sw.js`,
      { scope: import.meta.env.BASE_URL },
    )
    const worker = registration.installing ?? registration.waiting ?? registration.active
    publishServiceWorkerState(worker?.state ?? 'registered')
    worker?.addEventListener('statechange', () => publishServiceWorkerState(worker.state))
  } catch (error) {
    publishServiceWorkerState(
      `failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

window.addEventListener('load', () => void registerServiceWorker())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
