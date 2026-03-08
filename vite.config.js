import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/metar': {
        target: 'https://aviationweather.gov/api/data/metar',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/metar/, '')
      }
    }
  }
})
