import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: 'src/main.js',
      output: {
        // Build as a self-contained IIFE — loaded with a plain <script defer> tag in Webflow.
        format: 'iife',
        name: 'MtgPricing',
        inlineDynamicImports: true,
        // Fixed filename — no content hash so the Webflow embed URL never changes
        entryFileNames: 'index.js',
        // CSS is inlined into JS via Vite — no separate CSS file
        assetFileNames: '[name][extname]',
      }
    }
  }
})
