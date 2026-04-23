import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Avoid SMHI CORS issues in local dev by proxying via Vite.
      // Usage: fetch('/_proxy/smhi/...') from the app.
      '/_proxy/smhi': {
        target: 'https://opendata-download-metfcst.smhi.se',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/_proxy\/smhi/, ''),
      },
    },
    watch: {
      ignored: ['**/node_modules/**', '**/public/**']
    }
  }
})
