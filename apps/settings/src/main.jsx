import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Mount the Settings app into #settings-app.
 * Uses DOM polling to handle Webflow's async script injection.
 */
function mountApp() {
  var container = document.getElementById('settings-app')

  if (container) {
    ReactDOM.createRoot(container).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  } else {
    var attempts = 0
    var interval = setInterval(function () {
      attempts++
      var el = document.getElementById('settings-app')
      if (el) {
        clearInterval(interval)
        ReactDOM.createRoot(el).render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        )
      } else if (attempts > 100) {
        clearInterval(interval)
        console.error('settings-app container not found after 5s')
      }
    }, 50)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp)
} else {
  mountApp()
}
