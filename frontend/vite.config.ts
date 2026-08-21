import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_API_PROXY lets the containerised dev server reach the API by service name.
const apiTarget = process.env.VITE_API_PROXY || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Sourcemaps for a production bundle would publish the whole readable
    // frontend source next to it. Off unless you deliberately want that.
    sourcemap: false,
    // Vendor split: React, the router and the chart library change far less
    // often than the app does, so a deploy does not invalidate them.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
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
