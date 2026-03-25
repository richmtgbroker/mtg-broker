import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: 'src/main.js',
      output: {
        // Build as IIFE — single self-contained file for Webflow embed
        format: 'iife',
        name: 'MtgDashboard',
        inlineDynamicImports: true,
        // Fixed filename — no content hash so the Webflow embed URL never changes
        entryFileNames: 'index.js',
        // Inline CSS into JS (no separate CSS file)
        assetFileNames: '[name][extname]',
      }
    },
    // Inline all CSS into the JS bundle
    cssCodeSplit: false,
  }
})
