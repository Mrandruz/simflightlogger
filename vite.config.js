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
      },
      '/api/taf': {
        target: 'https://aviationweather.gov/api/data/taf',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/taf/, '')
      },
      '/api/aviationstack': {
        target: 'https://api.aviationstack.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/aviationstack/, '')
      }
    }
  }
})
