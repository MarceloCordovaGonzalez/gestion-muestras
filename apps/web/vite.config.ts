/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Desarrollo: la Web llama a /v1 en su mismo origen y Vite lo reenvía a la API local
    // (sin CORS ni puertos cruzados). En QA/prod se usa VITE_API_URL.
    proxy: { '/v1': { target: 'http://localhost:8080', changeOrigin: true } },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Separa librerías pesadas para mejorar la caché del navegador.
        manualChunks: {
          graficos: ['echarts', 'echarts-for-react'],
          firebase: ['firebase/app', 'firebase/auth'],
          mapas: ['@vis.gl/react-google-maps', 'leaflet', 'react-leaflet'],
        },
      },
    },
  },
  test: { environment: 'jsdom' },
});
