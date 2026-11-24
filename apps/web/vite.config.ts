/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
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
