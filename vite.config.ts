/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-48.png', 'brand/logo-mark.png'],
      manifest: {
        name: 'مَدَد MADAD',
        short_name: 'مَدَد',
        description: 'أين أُبلغ عن توفر دوائك، ومتى كان آخر تحديث',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        // A website, not an app (SPEC §1): adding a home-screen shortcut stays optional and opens in the browser.
        display: 'browser',
        background_color: '#F3F7F5',
        theme_color: '#174C43',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: '/index.html',
        // Reloads open pages once when a new version replaces an older one (public/sw-reload.js).
        importScripts: ['sw-reload.js'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // e2e/ is Playwright's (npm run e2e).
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'dist-supabase/**'],
  },
});
