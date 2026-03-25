import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Build as a self-contained IIFE (Immediately Invoked Function Expression).
        // This avoids the cross-origin type="module" issues when embedding in Webflow.
        // The output can be loaded with a plain <script defer src="..."> tag.
        format: 'iife',
        name: 'LoanSearch',
        // Single output file — no code splitting
        inlineDynamicImports: true,
        // Fixed filename — no content hash so the Webflow embed URL never needs updating
        entryFileNames: 'index.js',
      }
    }
  }
})
