import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  // Relativer Pfad: funktioniert auf GitHub Pages (Unterordner) und lokal
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'SchachTrainer',
        short_name: 'Schach',
        description: 'Schach zu zweit, gegen den Computer und Schachrätsel – offline.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#2b1d14',
        theme_color: '#2b1d14',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Alles für den Offline-Betrieb vorab cachen, inkl. Rätsel und Engine
        globPatterns: ['**/*.{js,css,html,png,svg,json,wasm}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node', env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } },
} as any);
