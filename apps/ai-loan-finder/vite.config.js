import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Base path for production - app will be served from /app/ai-search/
  base: '/app/ai-search/',
  server: {
    proxy: {
      '/app/ai-search/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/app\/ai-search/, '')
      }
    }
  }
})
