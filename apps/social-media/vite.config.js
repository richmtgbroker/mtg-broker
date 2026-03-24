import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Build as a self-contained IIFE (Immediately Invoked Function Expression).
        // This avoids cross-origin type="module" issues when embedding in Webflow.
        // The output can be loaded with a plain <script defer src="..."> tag.
        format: 'iife',
        name: 'SocialMediaGraphics',
        // Single output file — no code splitting
        inlineDynamicImports: true,
        // Fixed filename — no content hash so the Webflow embed URL never needs updating
        entryFileNames: 'index.js',
        // Inline all CSS into JS (Vite's default for IIFE, but explicit for clarity)
        assetFileNames: '[name][extname]',
      }
    },
    // Inline CSS into the JS bundle so there's only one file to load
    cssCodeSplit: false,
  }
})
