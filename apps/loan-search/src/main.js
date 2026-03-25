// ============================================================
// LOAN SEARCH — Entry Point (v8.0)
// Cloudflare Pages bundle. Replaces:
//   - HTML embed (v7.7) — DOM structure + CSS + UI JS
//   - Before-body script (v4.5) — loader
//   - Worker (v1.7) — loan search logic
// ============================================================

// Import CSS (Vite inlines this into the JS bundle)
import './styles.css'

// Import modules
import { getTemplate } from './template.js'
import { initUI } from './ui.js'
import { initLoanSearch } from './loan-search.js'

// ---------------------------
// Mount the app
// ---------------------------
function mount() {
  const container = document.getElementById('loan-search-app')
  if (!container) {
    console.error('loan-search-app container not found')
    return
  }

  // Inject the HTML template
  container.innerHTML = getTemplate()

  // Initialize UI handlers (filter panel, modal, mobile backdrops)
  initUI()

  // Initialize the loan search logic (fetches data, builds table, etc.)
  initLoanSearch()
}

// ---------------------------
// DOM polling for Webflow async script injection
// (same pattern as AI Loan Finder)
// ---------------------------
function mountApp() {
  const container = document.getElementById('loan-search-app')
  if (container) {
    mount()
  } else {
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      const el = document.getElementById('loan-search-app')
      if (el) {
        clearInterval(interval)
        mount()
      } else if (attempts > 100) {
        clearInterval(interval)
        console.error('loan-search-app container not found after 5 seconds')
      }
    }, 50)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp)
} else {
  mountApp()
}
