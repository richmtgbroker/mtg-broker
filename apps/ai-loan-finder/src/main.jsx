import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Mount into the #ai-search-app div that lives inside the Webflow
// Sidebar_App content area on the /app/ai-search Webflow page.
ReactDOM.createRoot(document.getElementById('ai-search-app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
