import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        // Build as a self-contained IIFE (Immediately Invoked Function Expression).
        // This avoids the cross-origin type="module" issues when embedding in Webflow.
        // The output can be loaded with a plain <script defer src="..."> tag.
        format: 'iife',
        name: 'AiLoanFinder',
        // Single output file — no code splitting
        inlineDynamicImports: true,
      }
    }
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
