import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs';
import path from 'path';

function fleetDbPlugin(env) {
  const dbPath = path.resolve(process.cwd(), 'data/fleet-state.json');
  return {
    name: 'fleet-db-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url?.startsWith('/api/fleet/') || req.url?.startsWith('/api/discord')) && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            if (body) {
              try { req.body = JSON.parse(body); } catch (e) {}
            }
            next();
          });
        } else {
          next();
        }
      });

      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/fleet' && req.method === 'GET') {
          if (fs.existsSync(dbPath)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(fs.readFileSync(dbPath, 'utf8'));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'DB not found' }));
          }
          return;
        }
        
        if (req.url === '/api/fleet/log-hours' && req.method === 'POST') {
           const logData = req.body;
           if (logData && logData.id && typeof logData.flightHours === 'number') {
              if (fs.existsSync(dbPath)) {
                 const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                 const ac = db.find(a => a.id === logData.id);
                 if (ac) {
                    ac.totalFlightHours += logData.flightHours;
                    const prevStatus = ac.status;
                    let wentAOG = false;
                    if (ac.totalFlightHours - (ac.lastMaintenanceHour || 0) >= 500) {
                        ac.status = 'AOG';
                        ac.isAOG = true;
                        ac.aogUntilTimeMs = Date.now() + (24 * 60 * 60 * 1000); 
                        wentAOG = true;
                    }
                    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, updated: ac, wentAOG }));
                    return;
                 }
              }
           }
           res.statusCode = 400;
           res.end(JSON.stringify({ error: 'Bad request' }));
           return;
        }
        
        // --- 🤖 DISCORD ROUTER ---
        if (req.url === '/api/discord' && req.method === 'POST') {
           const body = req.body || {};
           const channel = body.channel || 'generic';
           const payload = body.payload;
           
           let webhookUrl = env.VITE_DISCORD_WEBHOOK_URL; // fallback
           if (channel === 'ops') webhookUrl = env.VITE_DISCORD_WEBHOOK_OPS || webhookUrl;
           if (channel === 'fleet') webhookUrl = env.VITE_DISCORD_WEBHOOK_FLEET || webhookUrl;
           if (channel === 'daily') webhookUrl = env.VITE_DISCORD_WEBHOOK_DAILY || webhookUrl;
           
           if (!webhookUrl || !payload) {
             res.statusCode = 400;
             res.end(JSON.stringify({ error: 'Webhook URL non definito o payload mancante' }));
             return;
           }
           
           // Eseguiamo la vera fetch a Discord usando Node
           fetch(webhookUrl, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(payload)
           }).then(r => r.text()).then(t => {
             res.setHeader('Content-Type', 'application/json');
             res.end(JSON.stringify({ success: true, discordResponse: t }));
           }).catch(err => {
             res.statusCode = 500;
             res.end(JSON.stringify({ error: err.message }));
           });
           return;
        }

      });
    }
  };
}
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  const discordUrl = env.VITE_DISCORD_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/dummy';
  let discordOrigin = 'https://discord.com';
  let discordPath = '';
  try {
    const urlObj = new URL(discordUrl);
    discordOrigin = urlObj.origin;
    discordPath = urlObj.pathname + urlObj.search;
  } catch (e) {}

  return {
  plugins: [
    fleetDbPlugin(env),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'plane.svg'],
      manifest: {
        name: 'Skydeck',
        short_name: 'Skydeck',
        description: 'Skydeck — Sim Flight Logger powered by AI',
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
      },
      devOptions: {
        enabled: true
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/checklists\/.+\.pdf$/],
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 4000
  },
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
      },
      '/api/discord-proxy': {
        target: discordOrigin,
        changeOrigin: true,
        rewrite: () => discordPath
      },
      '/api/aria-proxy': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: () => '/v1/messages',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('x-api-key', process.env.ANTHROPIC_API_KEY || '');
            proxyReq.setHeader('anthropic-version', '2023-06-01');
            proxyReq.removeHeader('anthropic-dangerous-direct-browser-access');
          });
        }
      }
    }
  }
};
})

