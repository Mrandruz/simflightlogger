import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'plane.svg'],
      manifest: {
        name: 'Simulator Flight Logger',
        short_name: 'SimLogger',
        description: 'Advanced flight logging for flight simulator enthusiasts',
        theme_color: '#0d151e',
        background_color: '#0d151e',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
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
      },
      '/api/simbrief': {
        target: 'https://www.simbrief.com/api/xml.fetcher.php',
        changeOrigin: true,
        rewrite: (path) => {
          const separator = path.includes('?') ? '&' : '?';
          return path.replace(/^\/api\/simbrief/, '') + separator + 'json=v2';
        }
      }
    }
  }
})
