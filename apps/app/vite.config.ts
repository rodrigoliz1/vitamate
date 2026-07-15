import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: {
      '@vitamate/domain': fileURLToPath(new URL('../../packages/domain/src/index.ts', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'offline.html'],
      manifest: {
        name: 'VITAMATE',
        short_name: 'VITAMATE',
        description: 'Tu coach personal de entrenamiento y nutrición.',
        theme_color: '#2F5233',
        background_color: '#F7F5EF',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'es-MX',
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: { navigateFallback: '/index.html' },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'ui-vendor': ['react', 'react-dom', 'react-router-dom', '@ionic/react', '@ionic/react-router', 'ionicons/icons'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
  },
  // Expone Vite en la red local para probar la PWA desde el iPhone. Cuando
  // se abre mediante un túnel HTTPS, /v1 se reenvía localmente a la API para
  // que WebRTC mantenga un origen seguro sin publicar el puerto 3001.
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'],
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        // The browser's HTTPS tunnel Origin is not a public CORS origin for
        // the API. Vite is the same trusted local development process, so it
        // forwards as its local origin instead.
        headers: { origin: 'http://localhost:5173' },
      },
    },
  },
});
