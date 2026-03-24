import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Mount the React app into the #lender-directory-app div on the Webflow page.
// We poll for the element because Webflow may render the div after the
// script tag is processed (script tags in Code Embeds can fire early).
function mountApp() {
  const container = document.getElementById('lender-directory-app')

  if (container) {
    ReactDOM.createRoot(container).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  } else {
    // Retry every 50ms until the element appears (max 5 seconds)
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      const el = document.getElementById('lender-directory-app')
      if (el) {
        clearInterval(interval)
        ReactDOM.createRoot(el).render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        )
      } else if (attempts > 100) {
        clearInterval(interval)
        console.error('Lender Directory: #lender-directory-app element not found on page.')
      }
    }, 50)
  }
}

// Run immediately if DOM is ready, otherwise wait for it
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp)
} else {
  mountApp()
}
