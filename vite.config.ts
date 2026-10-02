import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FreeLMS — Free Training Platform',
        short_name: 'FreeLMS',
        description: 'Free for everyone. No ads.',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.youtube.*|^https:\/\/www\.youtube-nocookie.*|^https:\/\/i\.ytimg\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'youtube-embeds', expiration: { maxEntries: 50 } }
          }
        ],
        // Never cache Firestore / Auth traffic
        navigateFallbackDenylist: [/\/__/]
      }
    })
  ],
  server: { port: 5173 }
});
