import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Backend API'yi proxy'le (CORS sorununu önler).
    // Frontend Docker container'i icinde backend ayri network/compose'da olabilir;
    // host port map'i uzerinden host.docker.internal ile erisilir. Bare-metal local
    // dev icin VITE_PROXY_TARGET=http://localhost:3000 verin.
    proxy: {
      '/v1': {
        target: process.env.VITE_PROXY_TARGET || 'http://host.docker.internal:3000',
        changeOrigin: true,
      },
      // ML servisi (FastAPI, :8001). Frontend '/api/ml/*' cagirir; ML rotalari
      // kokte (/health, /predict/*, /models/*, /v1/*) oldugundan '/api/ml' prefix'i
      // rewrite ile siyrilir. Bare-metal dev icin VITE_ML_PROXY_TARGET verin.
      '/api/ml': {
        target: process.env.VITE_ML_PROXY_TARGET || 'http://host.docker.internal:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ml/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
