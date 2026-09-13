import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': a new build waits until the app decides to apply it (see
      // main.jsx), instead of activating itself and pulling the page out from
      // under the user mid-set.
      registerType: 'prompt',
      // Registered by hand in main.jsx so the installed app can poll for new
      // builds — the auto-injected script only checks on a cold page load,
      // which a home-screen PWA almost never does.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'FitTrack',
        short_name: 'FitTrack',
        description: 'Personal fitness tracker — log workouts, track progress',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            // Only table reads (/rest/v1/) are cached; auth and storage never are.
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              // On a slow or dead connection (gym basement), fall back to the
              // cached copy after 4 s instead of waiting for the full timeout.
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
    }),
  ],
})
