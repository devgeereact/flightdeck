import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The Google Analytics Measurement ID is public by design. It reaches the page as <meta name="fd-ga-id">, which public/consent.js reads;
// with no ID there is no banner and no Google request. Static public pages get the same value from scripts/build-public.mjs.
const gaMeta = (mode: string) => ({
  name: 'fd-ga-id',
  transformIndexHtml: (html: string) =>
    html.replace('__FD_GA_ID__', loadEnv(mode, process.cwd(), 'VITE_').VITE_GA_ID || ''),
});
// Dev: Vite serves the app (/app/) and its source; everything else (the public site, /api) goes to the PHP dev router, like production.
const devOwnsPath = (req: { url?: string }) => {
  const u = req.url || '/';
  return /^\/(app(\/|$|\?)|@|src\/|content\/[^/]+\.mjs|node_modules\/|__|virtual:|registerSW\.js|sw\.js|workbox-|manifest\.webmanifest|dev-sw)/.test(
    u,
  )
    ? u
    : undefined;
};
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    gaMeta(mode),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'icon.svg',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        id: '/',
        start_url: '/app/',
        scope: '/',
        name: 'Flightdeck: your journey, in view',
        short_name: 'Flightdeck',
        description:
          'Track a flight, check the weather at your destination and keep a packing list you can reuse.',
        theme_color: '#1866ff',
        background_color: '#eef1f6',
        display: 'standalone',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: [
          'assets/**/*.{js,css}',
          'fonts/*.woff2',
          '*.svg',
          'app/index.html',
          'icon-192.png',
          'icon-512.png',
        ],
        navigateFallback: '/app/index.html',
        navigateFallbackAllowlist: [/^\/app(\/|$)/],
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [{ urlPattern: /\/api\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  build: { rollupOptions: { input: 'app/index.html' } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/': { target: 'http://127.0.0.1:3001', bypass: devOwnsPath } },
  },
}));
