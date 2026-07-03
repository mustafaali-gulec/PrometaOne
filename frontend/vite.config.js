import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Docker bind-mount (Windows host → Linux container) üzerinden inotify fs olayları
    // iletilmiyor → Vite dosya değişimini görmez, HMR tetiklenmez, eski transform serve
    // edilir. Polling ile değişiklikler güvenilir algılanır (bare-metal'de de zararsız).
    watch: { usePolling: true, interval: 300 },
    // Backend API'yi proxy'le (CORS sorununu önler).
    // Frontend Docker container'i icinde backend ayri network/compose'da olabilir;
    // host port map'i uzerinden host.docker.internal ile erisilir. Bare-metal local
    // dev icin VITE_PROXY_TARGET=http://localhost:3000 verin.
    proxy: {
      // Şantiye Yönetim BAĞIMSIZ mikroservis (construction-service, :3002).
      // Daha spesifik kural önce gelmeli — /v1/construction/* monolit yerine
      // servise gider; gerisi (/v1/*) monolite. UI değişmez (relative çağrılar).
      '/v1/construction': {
        target: process.env.VITE_CONSTRUCTION_TARGET || 'http://host.docker.internal:3002',
        changeOrigin: true,
      },
      '/v1': {
        target: process.env.VITE_PROXY_TARGET || 'http://host.docker.internal:3000',
        changeOrigin: true,
      },
      // ML servisi (FastAPI :8001). Prod'daki nginx ile aynı sözleşme:
      // /api/ml/x -> /x (ml-service rotaları kökte: /health, /models, /v1/feedback...)
      '/api/ml': {
        target: process.env.VITE_ML_PROXY_TARGET || 'http://host.docker.internal:8001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ml/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
