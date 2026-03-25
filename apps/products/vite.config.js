import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: 'src/main.js',
      output: {
        // IIFE format — loads with a plain <script> tag in Webflow
        format: 'iife',
        name: 'MtgProducts',
        inlineDynamicImports: true,
        // Fixed filename — Webflow embed URL never changes
        entryFileNames: 'index.js',
        // Inline CSS into JS — no separate CSS file to load
        assetFileNames: '[name][extname]',
      }
    },
    // Inline all CSS into the JS bundle
    cssCodeSplit: false,
  },

  server: {
    port: 5174,
  }
})
