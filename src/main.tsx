import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyAppearance } from './lib/appearance'

// Before the first render, not in an effect: an effect would paint the default
// glass first and correct it a frame later, which anyone who has turned the
// panels solid would see as a flash on every single page load.
applyAppearance()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
