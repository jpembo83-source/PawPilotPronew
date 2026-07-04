import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    // App-shell caching only. The generated service worker precaches the
    // build output (JS/CSS/HTML/fonts/icons) so the app opens instantly and
    // survives reloads while offline. API responses are deliberately NOT
    // cached in v1: stale attendance/check-in data presented as fresh is
    // more dangerous than no data, so every Supabase call is NetworkOnly
    // and fails fast when offline (the connectivity layer explains why to
    // the user).
    //
    // registerType 'autoUpdate': a new deploy activates on the next
    // load/reload without a user-facing prompt (skipWaiting+clientsClaim),
    // so nobody is stranded on a stale shell. Chosen over a "refresh for
    // update" prompt because yard/kennel staff share devices and routinely
    // ignore passive prompts — an ignored prompt IS the stale-shell problem.
    VitePWA({
      registerType: 'autoUpdate',
      // Keep the existing hand-written public/manifest.json (index.html
      // already links it); don't generate a second manifest.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // The app is a single ~2.4 MB bundle (no code splitting yet), which
        // exceeds workbox's 2 MiB default and would silently drop the main
        // chunk from the precache — defeating the entire offline shell.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // SPA offline navigation: serve the precached index.html for any
        // in-app route the SW doesn't have a file for.
        navigateFallback: '/index.html',
        // Never intercept Supabase (auth, edge functions, realtime,
        // storage): network only, no fallback, no caching.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: true,
    strictPort: true,
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
