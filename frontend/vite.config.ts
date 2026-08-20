import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_API_PROXY lets the containerised dev server reach the API by service name.
const apiTarget = process.env.VITE_API_PROXY || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
