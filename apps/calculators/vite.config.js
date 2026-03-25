import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        // Build as a self-contained IIFE (Immediately Invoked Function Expression).
        // This avoids the cross-origin type="module" issues when embedding in Webflow.
        format: 'iife',
        name: 'MtgCalculators',
        // Single output file — no code splitting
        inlineDynamicImports: true,
        // Fixed filename — no content hash so the Webflow embed URL never needs updating
        entryFileNames: 'index.js',
      }
    }
  }
})
